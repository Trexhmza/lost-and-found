import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const groqKey = Deno.env.get('GROQ_API_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

serve(async (req) => {
  try {
    const body = await req.json()

    if (body.clear) {
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      return new Response(JSON.stringify({ cleared: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { postId, type } = body
    if (!postId || !type) return new Response('Missing postId or type', { status: 400 })

    const { data: post, error: postErr } = await supabase
      .from('posts').select('*').eq('id', postId).single()
    if (postErr || !post) return new Response('Post not found', { status: 404 })

    const oppositeType = type === 'lost' ? 'found' : 'lost'
    const { data: opposites } = await supabase
      .from('posts')
      .select('*')
      .eq('type', oppositeType)
      .eq('status', 'active')
      .neq('user_id', post.user_id)

    if (!opposites?.length) return new Response('No items to match', { status: 200 })

    const matches = []
    for (const opp of opposites) {
      const confidence = await groqMatch(post, opp)
      if (confidence >= 20) {
        matches.push({
          [type === 'lost' ? 'lost_post_id' : 'found_post_id']: postId,
          [type === 'lost' ? 'found_post_id' : 'lost_post_id']: opp.id,
          confidence
        })
      }
    }

    if (matches.length > 0) {
      await supabase.from('matches').upsert(matches, { onConflict: 'lost_post_id,found_post_id' })
    }

    return new Response(JSON.stringify({ matched: matches.length }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 })
  }
})

async function groqMatch(postA, postB) {
  let prompt = `You are matching lost & found items. Compare these two posts and decide match confidence (0-100).

Post A (${postA.type}): "${postA.description}"
Post B (${postB.type}): "${postB.description}"

`
  if (postA.image_url) prompt += `Post A image URL: ${postA.image_url}\n`
  if (postB.image_url) prompt += `Post B image URL: ${postB.image_url}\n`
  prompt += `Return ONLY a number 0-100. 0 = completely different, 100 = definitely the same item. Just the number.`

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
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
      const data = await res.json()
      const val = parseInt(data?.choices?.[0]?.message?.content)
      if (!isNaN(val) && val >= 0 && val <= 100) return val
    } catch { await delay(1000 * (i + 1)) }
  }
  return 0
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
