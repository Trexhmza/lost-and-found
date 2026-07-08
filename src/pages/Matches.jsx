import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Matches() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    const { data: userPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', user.id)

    if (!userPosts?.length) { setLoading(false); setMatches([]); return }

    const postIds = userPosts.map(p => p.id)

    const { data } = await supabase
      .from('matches')
      .select('*, lost:lost_post_id(id, description, image_url, user_id, profiles!lost_post_id(name, avatar_url)), found:found_post_id(id, description, image_url, user_id, profiles!found_post_id(name, avatar_url))')
      .or(`lost_post_id.in.(${postIds.join(',')}),found_post_id.in.(${postIds.join(',')})`)
      .order('created_at', { ascending: false })

    if (data) setMatches(data)
    setLoading(false)
  }

  async function handleConfirm(matchId, side) {
    const update = side === 'lost' ? { lost_confirmed: true } : { found_confirmed: true }
    await supabase.from('matches').update(update).eq('id', matchId)
    loadMatches()
  }

  async function handleReject(matchId) {
    await supabase.from('matches').update({ status: 'rejected' }).eq('id', matchId)
    loadMatches()
  }

  const filtered = matches.filter(m => filter === 'all' || m.status === filter)

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Matches</h1>

      <div className="flex gap-2 mb-4 text-sm">
        {['pending', 'confirmed', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'} cursor-pointer`}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No matches yet.</div>
      ) : (
        filtered.map(m => {
          const isLostOwner = m.lost?.user_id === user.id
          const myPost = isLostOwner ? m.lost : m.found
          const otherPost = isLostOwner ? m.found : m.lost
          const myConfirmed = isLostOwner ? m.lost_confirmed : m.found_confirmed
          const otherConfirmed = isLostOwner ? m.found_confirmed : m.lost_confirmed

          return (
            <div key={m.id} className="card mb-4">
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">{isLostOwner ? 'Your Lost Item' : 'Your Found Item'}</div>
                  {myPost?.image_url && <img src={myPost.image_url} className="w-full h-24 object-cover rounded-lg mb-1" />}
                  <p className="text-xs text-gray-700 line-clamp-2">{myPost?.description}</p>
                </div>
                <div className="flex items-center text-gray-400">↔</div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">{isLostOwner ? 'Matched Found Item' : 'Matched Lost Item'}</div>
                  {otherPost?.image_url && <img src={otherPost.image_url} className="w-full h-24 object-cover rounded-lg mb-1" />}
                  <p className="text-xs text-gray-700 line-clamp-2">{otherPost?.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${m.confidence >= 80 ? 'text-green-600' : m.confidence >= 70 ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {m.confidence}% match
                </span>

                {m.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleConfirm(m.id, isLostOwner ? 'lost' : 'found')} className={`btn-primary text-xs ${myConfirmed ? 'opacity-50' : ''}`} disabled={myConfirmed}>
                      {myConfirmed ? 'Waiting for other' : 'Confirm'}
                    </button>
                    <button onClick={() => handleReject(m.id)} className="btn-outline text-xs">Reject</button>
                  </div>
                )}

                {m.status === 'confirmed' && (
                  <div className="text-right">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Matched!</span>
                    <div className="text-xs text-gray-600 mt-1">
                      {otherPost?.profiles?.name} — {otherPost?.profiles?.email || 'email@umt.edu.pk'}
                    </div>
                  </div>
                )}

                {m.status === 'rejected' && (
                  <span className="text-xs text-gray-500">Rejected</span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
