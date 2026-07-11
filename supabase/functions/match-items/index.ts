import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const groqKey = Deno.env.get('GROQ_API_KEY')!
const hfKey = Deno.env.get('HF_API_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const VISION_MODEL = 'llama-3.2-11b-vision-preview'
const HF_URL = 'https://api-inference.huggingface.co/models'
const TEXT_EMBED_MODEL = 'Alibaba-NLP/gte-small'
const IMG_EMBED_MODEL = 'openai/clip-vit-base-patch32'

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

    const { postId, type, rematch } = body
    if (!postId || !type) return new Response('Missing postId or type', { status: 400, headers: corsHeaders })

    if (rematch) {
      await supabase.from('matches').delete().eq('lost_post_id', postId).eq('status', 'pending')
      await supabase.from('matches').delete().eq('found_post_id', postId).eq('status', 'pending')
    }

    const { data: post, error: postErr } = await supabase
      .from('posts').select('*').eq('id', postId).single()
    if (postErr || !post) return new Response('Post not found', { status: 404, headers: corsHeaders })

    // Generate and store embeddings for this post
    const [textVec, imgVec] = await Promise.all([
      post.description?.trim() ? getTextEmbedding(post.description) : null,
      post.image_url ? getImageEmbedding(post.image_url) : null,
    ])

    const updateFields: Record<string, any> = {}
    if (textVec) updateFields.text_vector = textVec
    if (imgVec) updateFields.image_vector = imgVec
    if (Object.keys(updateFields).length > 0) {
      await supabase.from('posts').update(updateFields).eq('id', postId)
    }

    const oppositeType = type === 'lost' ? 'found' : 'lost'

    // Try pgvector pre-filter first (top 25 candidates)
    let candidates = await vectorPreFilter(post, oppositeType, textVec, imgVec)

    // Fallback: if no vector candidates or embedding failed, fetch all
    if (!candidates || candidates.length === 0) {
      const { data: allOpposites } = await supabase
        .from('posts')
        .select('*')
        .eq('type', oppositeType)
        .eq('status', 'active')
        .neq('user_id', post.user_id)
      candidates = allOpposites || []
    }

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ matched: 0, matches: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const matches = []
    for (const opp of candidates) {
      const rawScore = await groqMatch(post, opp)
      const confidence = Math.min(rawScore, 90)
      if (confidence >= 30) {
        matches.push({
          [type === 'lost' ? 'lost_post_id' : 'found_post_id']: postId,
          [type === 'lost' ? 'found_post_id' : 'lost_post_id']: opp.id,
          confidence,
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

// --- Hugging Face Embedding Functions ---

async function getTextEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${HF_URL}/${TEXT_EMBED_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    })
    if (!res.ok) {
      console.error(`HF text embedding failed: ${res.status} ${await res.text()}`)
      return null
    }
    const data = await res.json()
    const vec = Array.isArray(data[0]) ? data[0] : data
    if (vec.length !== 384) {
      console.error(`HF text embedding wrong dim: ${vec.length}`)
      return null
    }
    return vec
  } catch (e) {
    console.error('HF text embedding error:', e)
    return null
  }
}

async function getImageEmbedding(imageUrl: string): Promise<number[] | null> {
  try {
    const downscaled = imageUrl.replace('/upload/', '/upload/w_224,c_limit,q_60/')
    const imgRes = await fetch(downscaled)
    if (!imgRes.ok) return null
    const imgBuf = await imgRes.arrayBuffer()

    const res = await fetch(`${HF_URL}/${IMG_EMBED_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imgBuf,
    })
    if (!res.ok) {
      console.error(`HF image embedding failed: ${res.status} ${await res.text()}`)
      return null
    }
    const data = await res.json()
    const vec = Array.isArray(data[0]) ? data[0] : data
    if (vec.length !== 512) {
      console.error(`HF image embedding wrong dim: ${vec.length}`)
      return null
    }
    return vec
  } catch (e) {
    console.error('HF image embedding error:', e)
    return null
  }
}

// --- Vector Pre-Filter ---

async function vectorPreFilter(
  post: any,
  oppositeType: string,
  textVec: number[] | null,
  imgVec: number[] | null,
): Promise<any[] | null> {
  try {
    if (!textVec && !imgVec) return null

    // Increased from 15 to 25 candidates
    let rpcArgs: Record<string, any> = {
      p_type: oppositeType,
      p_user_id: post.user_id,
      p_limit: 25,
    }

    if (textVec && imgVec) {
      rpcArgs.p_text_vec = `[${textVec.join(',')}]`
      rpcArgs.p_img_vec = `[${imgVec.join(',')}]`
      rpcArgs.p_use_both = true
    } else if (textVec) {
      rpcArgs.p_text_vec = `[${textVec.join(',')}]`
      rpcArgs.p_img_vec = null
      rpcArgs.p_use_both = false
    } else if (imgVec) {
      rpcArgs.p_text_vec = null
      rpcArgs.p_img_vec = `[${imgVec.join(',')}]`
      rpcArgs.p_use_both = false
    }

    const { data, error } = await supabase.rpc('vector_search_candidates', rpcArgs)
    if (error) {
      console.error('Vector search error:', error.message)
      return null
    }
    return data || []
  } catch (e) {
    console.error('Vector pre-filter error:', e)
    return null
  }
}

// --- Groq Matching ---

async function groqMatch(postA: any, postB: any): Promise<number> {
  const hasDescA = !!postA.description?.trim()
  const hasDescB = !!postB.description?.trim()

  const imgA = postA.image_url ? await fetchImageB64(downscale(postA.image_url)) : null
  const imgB = postB.image_url ? await fetchImageB64(downscale(postB.image_url)) : null

  if (!hasDescA && !imgA) return 0
  if (!hasDescB && !imgB) return 0

  const content: any[] = []
  const photoCount = (imgA ? 1 : 0) + (imgB ? 1 : 0)

  const descA = postA.description?.trim() || '[no description]'
  const descB = postB.description?.trim() || '[no description]'
  const catA = postA.category || 'unknown'
  const catB = postB.category || 'unknown'
  const locA = postA.location || 'unknown'
  const locB = postB.location || 'unknown'

  let text = `You are matching lost & found items at a university campus. Think LOGICALLY — could these be the SAME physical item?

Don't just match words. Think like a human:
- "black iPhone 14" lost vs "found a phone, dark colored" — likely the same, even though words differ
- "water bottle" lost vs "red bottle with yellow cap" found — NOT a strong match. The lost post is too vague — we can't confirm the details match. Maybe 30-40.
- "red bottle with yellow cap" lost vs "red bottle with yellow cap" found — strong match, same specific details
- "ID card with name Ahmed" lost vs "found student ID" — likely the same
- "blue wallet" lost vs "red wallet" found — NOT a match, details contradict
- "phone" lost vs "water bottle" found — completely different items, not a match
- "Jacob and Co watch, black straps" lost vs "found a wrist watch" — weak match at best, one is detailed, other is vague

CRITICAL RULE: If one post has specific details (color, brand, size, marks) and the other is generic/vague, that's a WEAK match. The vague post could match ANY item of that type. Only score high when BOTH posts have enough detail to confirm they describe the same thing.

Consider ALL evidence together:
1. Do descriptions align logically? (not just keyword matching)
2. Do images show the same type of item?
3. Same category + same location + same day = strong signal, BUT only if descriptions don't contradict
4. Generic/vague descriptions with no unique details = low confidence, could be coincidence

Be HONEST and STRICT. Never score above 90 — even perfect matches leave room for error.
Never score a generic description match above 50. Specific details must be confirmed on both sides for high scores.

Post A (${postA.type}):
- Description: "${descA}"
- Category: ${catA}
- Location: ${locA}
- Date: ${postA.date || 'unknown'}

Post B (${postB.type}):
- Description: "${descB}"
- Category: ${catB}
- Location: ${locB}
- Date: ${postB.date || 'unknown'}`

  if (photoCount === 2) {
    text += `\n\nThe FIRST photo is Post A. The SECOND photo is Post B. Compare both photos and descriptions carefully.`
  } else if (imgA) {
    text += `\n\nThe attached photo belongs to Post A. Compare it with Post B's description.`
  } else if (imgB) {
    text += `\n\nThe attached photo belongs to Post B. Compare it with Post A's description.`
  }

  text += `\n\nReturn ONLY a number 0-90. Never score above 90.`
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
          messages: [
            { role: 'system', content: 'You are a matching engine. You MUST respond with ONLY a single number between 0 and 90. No words, no explanation, no punctuation. Just the number. Never score above 90.' },
            { role: 'user', content }
          ],
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

async function groqMatchText(postA: any, postB: any): Promise<number> {
  const descA = postA.description?.trim() || '[no description]'
  const descB = postB.description?.trim() || '[no description]'
  const catA = postA.category || 'unknown'
  const catB = postB.category || 'unknown'
  const locA = postA.location || 'unknown'
  const locB = postB.location || 'unknown'

  const prompt = `You are matching lost & found items at a university campus. Think LOGICALLY — could these be the SAME physical item?

Don't just match words. Think like a human:
- "black iPhone 14" lost vs "found a phone, dark colored" — likely the same, even though words differ
- "water bottle" lost vs "red bottle with yellow cap" found — NOT a strong match. The lost post is too vague. Maybe 30-40.
- "red bottle with yellow cap" lost vs "red bottle with yellow cap" found — strong match, same specific details
- "ID card with name Ahmed" lost vs "found student ID" — likely the same
- "blue wallet" lost vs "red wallet" found — NOT a match, details contradict
- "phone" lost vs "water bottle" found — completely different items, not a match
- "Jacob and Co watch, black straps" lost vs "found a wrist watch" — weak match at best

CRITICAL RULE: If one post has specific details (color, brand, size, marks) and the other is generic/vague, that's a WEAK match. The vague post could match ANY item of that type. Only score high when BOTH posts have enough detail to confirm they describe the same thing.

Consider ALL evidence together:
1. Do descriptions align logically? (not just keyword matching)
2. Same category + same location + same day = strong signal, BUT only if descriptions don't contradict
3. Generic/vague descriptions with no unique details = low confidence, could be coincidence
4. Missing details in one post doesn't mean mismatch — but it means we can't confirm

Be HONEST and STRICT. Never score above 90 — even perfect matches leave room for error.
Never score a generic description match above 50. Specific details must be confirmed on both sides for high scores.

Post A (${postA.type}):
- Description: "${descA}"
- Category: ${catA}
- Location: ${locA}
- Date: ${postA.date || 'unknown'}

Post B (${postB.type}):
- Description: "${descB}"
- Category: ${catB}
- Location: ${locB}
- Date: ${postB.date || 'unknown'}

Return ONLY a number 0-90. Never score above 90.`

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are a matching engine. You MUST respond with ONLY a single number between 0 and 90. No words, no explanation, no punctuation. Just the number. Never score above 90.' },
            { role: 'user', content: prompt }
          ],
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

// --- Helpers ---

function downscale(url: string) {
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
