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

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>
  if (!profileData) return <div className="text-center py-10 text-gray-500">User not found</div>

  return (
    <div>
      <div className="card text-center mb-4">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold mx-auto mb-3 overflow-hidden">
          {profileData.avatar_url ? <img src={profileData.avatar_url} className="w-full h-full object-cover" /> : profileData.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <h2 className="text-lg font-bold">{profileData.name}</h2>
        {profileData.bio && <p className="text-sm text-gray-500 mt-1">{profileData.bio}</p>}

        {user?.id !== id && (
          <button onClick={startConversation} className="btn-primary text-sm mt-3">Send Message</button>
        )}
      </div>

      <h3 className="text-sm font-semibold mb-3">Active Posts</h3>
      {userPosts.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">No active posts.</div>
      ) : (
        userPosts.map(post => (
          <div key={post.id} className="card mb-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${post.type === 'lost' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {post.type}
            </span>
            {post.image_url && <img src={post.image_url} className="w-full h-32 object-cover rounded-lg mt-2 mb-2" />}
            <p className="text-sm text-gray-700 mt-1">{post.description}</p>
            <div className="text-xs text-gray-400 mt-1">{timeAgo(post.created_at)}</div>
          </div>
        ))
      )}
    </div>
  )
}
