import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const groqKey = Deno.env.get('GROQ_API_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const VISION_MODEL = 'llama-3.2-11b-vision-preview'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    if (body.check) {
      const { data } = await supabase.from('matches').select('*, lost:lost_post_id(*), found:found_post_id(*)')
      return new Response(JSON.stringify({ matches: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.clear) {
      await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('likes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      return new Response(JSON.stringify({ cleared: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { postId, type } = body
    if (!postId || !type) return new Response('Missing postId or type', { status: 400, headers: corsHeaders })

    const { data: post, error: postErr } = await supabase
      .from('posts').select('*').eq('id', postId).single()
    if (postErr || !post) return new Response('Post not found', { status: 404, headers: corsHeaders })

    const oppositeType = type === 'lost' ? 'found' : 'lost'
    const { data: opposites } = await supabase
      .from('posts')
      .select('*')
      .eq('type', oppositeType)
      .eq('status', 'active')

    if (!opposites?.length) return new Response(JSON.stringify({ matched: 0, matches: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const matches = []
    for (const opp of opposites) {
      const confidence = await groqMatch(post, opp)
      if (confidence >= 70) {
        matches.push({
          [type === 'lost' ? 'lost_post_id' : 'found_post_id']: postId,
          [type === 'lost' ? 'found_post_id' : 'lost_post_id']: opp.id,
          confidence
        })
      }
    }

    if (matches.length > 0) {
      const { error: upsertErr } = await supabase.from('matches').upsert(matches, { onConflict: 'lost_post_id,found_post_id' })
      if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`)
    }

    return new Response(JSON.stringify({ matched: matches.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500, headers: corsHeaders })
  }
})

async function groqMatch(postA, postB) {
  const hasDescA = !!postA.description?.trim()
  const hasDescB = !!postB.description?.trim()

  const imgA = postA.image_url ? await fetchImageB64(downscale(postA.image_url)) : null
  const imgB = postB.image_url ? await fetchImageB64(downscale(postB.image_url)) : null

  if (!hasDescA && !imgA) return 0
  if (!hasDescB && !imgB) return 0

  const content: any[] = []
  const photoCount = (imgA ? 1 : 0) + (imgB ? 1 : 0)

  let text = `You are matching lost & found items. Decide how likely these two posts refer to the SAME physical item. Reply with ONLY a number 0-100 (higher = same item).\n`

  if (hasDescA) {
    text += `\nPost A (${postA.type}): "${postA.description}"`
  } else {
    text += `\nPost A (${postA.type}): [no description provided]`
  }

  if (hasDescB) {
    text += `\nPost B (${postB.type}): "${postB.description}"`
  } else {
    text += `\nPost B (${postB.type}): [no description provided]`
  }

  if (photoCount === 2) {
    text += `\n\nThe FIRST photo is Post A. The SECOND photo is Post B. Compare both photos and descriptions carefully.`
  } else if (imgA) {
    text += `\n\nThe attached photo belongs to Post A. Compare it with Post B's description.`
  } else if (imgB) {
    text += `\n\nThe attached photo belongs to Post B. Compare it with Post A's description.`
  }

  text += `\nReturn ONLY a number 0-100.`
  content.push({ type: 'text', text })

  if (imgA) content.push({ type: 'image_url', image_url: { url: imgA } })
  if (imgB) content.push({ type: 'image_url', image_url: { url: imgB } })

  const useVision = !!(imgA || imgB)
  const model = useVision ? VISION_MODEL : 'llama-3.1-8b-instant'

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content }],
          temperature: 0.1,
          max_tokens: 5
        })
      })
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
      const data = await res.json()
      const val = parseInt(data?.choices?.[0]?.message?.content)
      if (!isNaN(val) && val >= 0 && val <= 100) return val
    } catch { await delay(1000 * (i + 1)) }
  }

  if (useVision) return await groqMatchText(postA, postB)
  return 0
}

async function groqMatchText(postA, postB) {
  const descA = postA.description?.trim() || '[no description]'
  const descB = postB.description?.trim() || '[no description]'
  const prompt = `You are matching lost & found items. Compare these two posts and decide match confidence (0-100).
Post A (${postA.type}): "${descA}"
Post B (${postB.type}): "${descB}"
If either post has no description, rely only on what's available. Return ONLY a number 0-100.`
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 5
        })
      })
      if (!res.ok) throw new Error(`Groq ${res.status}`)
      const data = await res.json()
      const val = parseInt(data?.choices?.[0]?.message?.content)
      if (!isNaN(val) && val >= 0 && val <= 100) return val
    } catch { await delay(1000 * (i + 1)) }
  }
  return 0
}

function downscale(url: string) {
  // Insert a Cloudinary transform to shrink the image before sending to the vision model
  return url.replace('/upload/', '/upload/w_384,c_limit,q_70/')
}

async function fetchImageB64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return `data:image/jpeg;base64,${btoa(binary)}`
  } catch {
    return null
  }
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
