import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Matches() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadMatches()
    const channel = supabase
      .channel('matches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadMatches())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadMatches() {
    const { data: userPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', user.id)

    if (!userPosts?.length) { setLoading(false); setMatches([]); return }

    const postIds = userPosts.map(p => p.id)

    const { data } = await supabase
      .from('matches')
      .select('*, lost:lost_post_id(id, description, image_url, user_id, category, location), found:found_post_id(id, description, image_url, user_id, category, location)')
      .or(`lost_post_id.in.(${postIds.join(',')}),found_post_id.in.(${postIds.join(',')})`)
      .order('confidence', { ascending: false })

    if (data) {
      for (const m of data) {
        if (m.lost_confirmed && m.found_confirmed && m.status === 'pending') {
          await supabase.from('matches').update({ status: 'confirmed' }).eq('id', m.id)
          m.status = 'confirmed'
        }
      }
      const userIds = [...new Set(data.flatMap(m => [m.lost?.user_id, m.found?.user_id].filter(Boolean)))]
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', userIds)
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setMatches(data.map(m => ({
          ...m,
          lost: m.lost ? { ...m.lost, profiles: profileMap[m.lost.user_id] } : null,
          found: m.found ? { ...m.found, profiles: profileMap[m.found.user_id] } : null
        })))
      } else {
        setMatches(data)
      }
    }
    setLoading(false)
  }

  async function handleConfirm(matchId, side) {
    const update = side === 'lost' ? { lost_confirmed: true } : { found_confirmed: true }
    await supabase.from('matches').update(update).eq('id', matchId)
    const { data: m } = await supabase.from('matches').select('lost_confirmed, found_confirmed').eq('id', matchId).single()
    if (m?.lost_confirmed && m?.found_confirmed) {
      await supabase.from('matches').update({ status: 'confirmed' }).eq('id', matchId)
    }
    loadMatches()
  }

  async function handleReject(matchId) {
    await supabase.from('matches').update({ status: 'rejected' }).eq('id', matchId)
    loadMatches()
  }

  async function startConversation(otherUserId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .or(`user1_id.eq.${otherUserId},user2_id.eq.${otherUserId}`)
      .maybeSingle()
    if (existing) { navigate('/dms'); return }
    const { error } = await supabase.from('conversations').insert({ user1_id: user.id, user2_id: otherUserId })
    if (error) console.error('Create conv error:', error)
    navigate('/dms')
  }

  const filtered = matches.filter(m => {
    if (filter === 'all') return true
    return m.status === filter
  })

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-text tracking-tight mb-1">Matches</h1>
      <p className="text-sm text-text-muted mb-5">AI-powered item matching</p>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border-none ${filter === f.key ? 'bg-accent text-white shadow-md shadow-accent/20' : 'bg-surface text-text-secondary hover:bg-bg-warm border border-border'}`}>
            {f.label}
            {f.key === 'pending' && <span className="ml-1.5 bg-surface/20 px-1.5 py-0.5 rounded-md text-[10px]">{matches.filter(m => m.status === 'pending').length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => (
            <div key={i} className="card">
              <div className="flex gap-3 mb-3">
                <div className="flex-1"><div className="skeleton h-3 w-20 mb-2" /><div className="skeleton h-24 w-full rounded-xl" /></div>
                <div className="flex items-center"><div className="skeleton w-8 h-8 rounded-full" /></div>
                <div className="flex-1"><div className="skeleton h-3 w-20 mb-2" /><div className="skeleton h-24 w-full rounded-xl" /></div>
              </div>
              <div className="skeleton h-8 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h3 className="font-bold text-text mb-1">No matches yet</h3>
          <p className="text-sm text-text-muted">Post a lost or found item to get AI-powered matches</p>
        </div>
      ) : (
        filtered.map(m => {
          const isLostOwner = m.lost?.user_id === user.id
          const myPost = isLostOwner ? m.lost : m.found
          const otherPost = isLostOwner ? m.found : m.lost
          const myConfirmed = isLostOwner ? m.lost_confirmed : m.found_confirmed
          const otherConfirmed = isLostOwner ? m.found_confirmed : m.lost_confirmed

          const tier = m.confidence >= 80 ? 'certain' : m.confidence >= 60 ? 'good' : 'basic'
          const tierLabel = tier === 'certain' ? 'Almost certain' : tier === 'good' ? 'Good match' : 'Basic match'
          const tierColor = tier === 'certain' ? 'text-amber-400 bg-amber-400/10' : tier === 'good' ? 'text-primary bg-primary/10' : 'text-lost bg-lost/10'

          return (
            <div key={m.id} className="card mb-4 animate-slideUp">
              <div className="flex gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{isLostOwner ? 'Your Post' : 'Their Post'}</div>
                  {myPost?.image_url && <img src={myPost.image_url} className="w-full h-28 object-cover rounded-xl mb-1.5" alt="" />}
                  <p className="text-xs text-text-secondary line-clamp-2">{myPost?.description}</p>
                </div>

                <div className="flex flex-col items-center justify-center gap-1 px-1">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{isLostOwner ? 'Their Post' : 'Your Post'}</div>
                  {otherPost?.image_url && <img src={otherPost.image_url} className="w-full h-28 object-cover rounded-xl mb-1.5" alt="" />}
                  <p className="text-xs text-text-secondary line-clamp-2">{otherPost?.description}</p>
                </div>
              </div>

              {/* Confidence + Tier */}
              <div className="mb-3 pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-text-secondary whitespace-nowrap">Confidentiality score</span>
                  <span className={`text-lg font-extrabold ${tier === 'certain' ? 'text-amber-400' : tier === 'good' ? 'text-primary' : 'text-lost'}`}>{m.confidence}%</span>
                  <div className="confidence-bar flex-1 max-w-[120px]">
                    <div className={`h-full rounded-full ${tier === 'certain' ? 'bg-amber-400' : tier === 'good' ? 'bg-primary' : 'bg-lost'}`} style={{ width: `${m.confidence}%` }} />
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${tierColor}`}>
                    {tierLabel}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                {m.status === 'pending' && (
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => handleConfirm(m.id, isLostOwner ? 'lost' : 'found')} className={`btn-primary text-xs py-2 px-4 ${myConfirmed ? 'opacity-50' : ''}`} disabled={myConfirmed}>
                      {myConfirmed ? 'Waiting...' : 'Confirm'}
                    </button>
                    <button onClick={() => handleReject(m.id)} className="btn-outline text-xs py-2 px-4">Reject</button>
                  </div>
                )}

                {m.status === 'confirmed' && (
                  <div className="text-right ml-auto">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-found-light text-found px-3 py-1.5 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Matched!
                    </span>
                    <div className="text-xs text-text-secondary mt-2">
                      {otherPost?.profiles?.name} — {otherPost?.profiles?.email || 'email@umt.edu.pk'}
                    </div>
                    <button onClick={() => startConversation(otherPost?.user_id)} className="btn-primary text-xs mt-2 py-2 px-4">Send Message</button>
                  </div>
                )}

                {m.status === 'rejected' && (
                  <span className="text-xs font-medium text-text-muted ml-auto">Rejected</span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
