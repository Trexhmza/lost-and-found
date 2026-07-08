import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'
import PostForm from '../components/PostForm'

export default function FoundFeed() {
  const [posts, setPosts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPosts()
    const channel = supabase
      .channel('found-feed')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts', filter: `type=eq.found` }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(name, avatar_url)')
      .eq('type', 'found')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Found Items</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Post</button>
      </div>
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No found items reported yet.</div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} type="found" onDelete={() => loadPosts()} />)
      )}
      {showForm && <PostForm type="found" onClose={() => setShowForm(false)} onSuccess={loadPosts} />}
    </div>
  )
}
