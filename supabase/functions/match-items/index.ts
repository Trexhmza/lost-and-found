import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const hfKey = Deno.env.get('HF_API_KEY')!
const groqKey = Deno.env.get('GROQ_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

const HF_MINI_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

serve(async (req) => {
  try {
    const body = await req.json()

    const { postId, type } = body
    if (!postId || !type) return new Response('Missing postId or type', { status: 400 })

    const { data: post, error: postErr } = await supabase
      .from('posts').select('*').eq('id', postId).single()
    if (postErr || !post) return new Response('Post not found', { status: 404 })

  const imageVector = post.image_url ? await getImageHash(post.image_url) : null
  const textVector = await getMiniLMVector(post.description)

  await supabase.from('posts').update({
    image_vector: imageVector ? arrayToPgVector([parseInt(imageVector.slice(0, 8), 16) / 0xFFFFFFFF]) : null,
    text_vector: textVector ? arrayToPgVector(textVector) : null
  }).eq('id', postId)

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
    let oppImgVec = opp.image_vector
    let oppTxtVec = opp.text_vector

    if (!oppTxtVec && textVector) {
      oppTxtVec = await getMiniLMVector(opp.description)
      if (oppTxtVec) {
        await supabase.from('posts').update({ text_vector: arrayToPgVector(oppTxtVec) }).eq('id', opp.id)
      }
    }
    if ((!oppImgVec || Array.isArray(oppImgVec)) && imageVector && opp.image_url) {
      oppImgVec = await getImageHash(opp.image_url)
      if (oppImgVec) {
        await supabase.from('posts').update({ image_vector: arrayToPgVector([parseInt(oppImgVec.slice(0, 8), 16) / 0xFFFFFFFF]) }).eq('id', opp.id)
      }
    }

    let imgScore = null
    let txtScore = null

    if (post.image_url && opp.image_url) {
      const imgHash = typeof imageVector === 'string' ? imageVector : null
      const oppHash = Array.isArray(oppImgVec) ? null : oppImgVec
      imgScore = (imgHash && oppHash && imgHash === oppHash) ? 1.0 : 0.30
    }
    if (textVector && oppTxtVec?.length > 100) {
      txtScore = cosineSimilarity(textVector, oppTxtVec)
    }

    let final = combineScores(imgScore, txtScore, type === 'lost')

    if (imgScore === null && txtScore === null) {
      final = keywordScore(post.description, opp.description)
    }

    let llmAdjust = 0

    if (final >= 0.20 && final <= 0.60) {
      llmAdjust = await groqRerank(post.description, opp.description, imgScore, txtScore)
    }

    final = Math.min(1, Math.max(0, final + llmAdjust))

    if (final >= 0.20) {
      matches.push({
        [type === 'lost' ? 'lost_post_id' : 'found_post_id']: postId,
        [type === 'lost' ? 'found_post_id' : 'lost_post_id']: opp.id,
        confidence: Math.round(final * 100)
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

async function getImageHash(imageUrl) {
  for (let i = 0; i < 3; i++) {
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) { await delay(1000 * (i + 1)); continue }
      const blob = await imgRes.arrayBuffer()
      const hash = await crypto.subtle.digest('SHA-256', blob)
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
      return hex
    } catch { await delay(1000 * (i + 1)) }
  }
  return null
}

async function getMiniLMVector(text) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(HF_MINI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
      })
      if (!res.ok) { await delay(1000 * (i + 1)); continue }
      const data = await res.json()
      return data[0] || data
    } catch { await delay(1000 * (i + 1)) }
  }
  return null
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

function combineScores(img, txt, isLost) {
  if (img !== null && txt !== null) return 0.45 * img + 0.40 * txt
  if (img !== null) return 0.80 * img
  return 0.80 * (txt || 0)
}

async function groqRerank(descA, descB, imgScore, txtScore) {
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [{
          role: 'user',
          content: `Two items might match. Item description A: "${descA}". Item description B: "${descB}". ${imgScore !== null ? `Image similarity: ${Math.round(imgScore*100)}%. ` : ''}Text similarity: ${txtScore !== null ? Math.round(txtScore*100) : 'N/A'}%. Return ONLY a number: +5 if it's a clear match, +10 if it's very likely, -5 if it's likely NOT a match, 0 if uncertain. Just the number.`
        }],
        temperature: 0.1,
        max_tokens: 5
      })
    })
    const data = await res.json()
    const val = parseFloat(data?.choices?.[0]?.message?.content)
    return isNaN(val) ? 0 : val / 100
  } catch { return 0 }
}

function keywordScore(a, b) {
  const wordsA = a.toLowerCase().split(/\W+/).filter(Boolean)
  const wordsB = b.toLowerCase().split(/\W+/).filter(Boolean)
  if (!wordsA.length || !wordsB.length) return 0
  const setA = new Set(wordsA)
  const setB = new Set(wordsB)
  let intersect = 0
  for (const w of setA) { if (setB.has(w)) intersect++ }
  const union = new Set([...setA, ...setB]).size
  return intersect / union
}

function arrayToPgVector(arr) {
  return `[${arr.join(',')}]`
}
