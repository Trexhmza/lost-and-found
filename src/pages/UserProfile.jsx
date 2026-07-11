import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../utils/constants'

export default function UserProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState(null)
  const [userPosts, setUserPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
    loadPosts()
  }, [id])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) setProfileData(data)
    setLoading(false)
  }

  async function loadPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (data) setUserPosts(data)
  }

  async function startConversation() {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      navigate('/dms')
    } else {
      await supabase.from('conversations').insert({ user1_id: user.id, user2_id: id })
      navigate('/dms')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="card text-center py-8">
        <div className="skeleton w-20 h-20 rounded-full mx-auto mb-3" />
        <div className="skeleton h-5 w-32 mx-auto mb-2" />
        <div className="skeleton h-3 w-40 mx-auto" />
      </div>
    </div>
  )

  if (!profileData) return <div className="card text-center py-12"><p className="text-text-muted">User not found</p></div>

  return (
    <div>
      {/* Profile Header */}
      <div className="card text-center mb-6 animate-slideUp">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/10 to-accent/20 flex items-center justify-center text-2xl font-extrabold text-accent mx-auto mb-3 overflow-hidden ring-4 ring-accent/10">
          {profileData.avatar_url ? <img src={profileData.avatar_url} className="w-full h-full object-cover" alt="" /> : profileData.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <h2 className="text-xl font-extrabold text-text">{profileData.name}</h2>
        {profileData.bio && <p className="text-sm text-text-muted mt-1.5 max-w-xs mx-auto">{profileData.bio}</p>}

        {user?.id !== id && (
          <button onClick={startConversation} className="btn-primary mt-4 px-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Send Message
          </button>
        )}
      </div>

      {/* User's Posts */}
      <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Active Posts</h3>
      {userPosts.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-text-muted">No active posts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {userPosts.map(post => (
            <div key={post.id} className="card animate-slideUp">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${post.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
                  {post.type.toUpperCase()}
                </span>
                <span className="text-[11px] text-text-muted">{timeAgo(post.created_at)}</span>
              </div>
              {post.image_url && <img src={post.image_url} className="w-full h-36 object-cover rounded-xl mb-2" alt="" />}
              <p className="text-sm text-text leading-relaxed">{post.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
