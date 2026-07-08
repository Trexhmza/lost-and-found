import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'
import PostForm from '../components/PostForm'

export default function LostFeed() {
  const [posts, setPosts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPosts() }, [])

  async function loadPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(name, avatar_url)')
      .eq('type', 'lost')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Lost Items</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Post</button>
      </div>
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No lost items reported yet. Be the first!</div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} type="lost" />)
      )}
      {showForm && <PostForm type="lost" onClose={() => setShowForm(false)} onSuccess={loadPosts} />}
    </div>
  )
}
