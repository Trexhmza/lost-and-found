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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">Found Items</h1>
          <p className="text-sm text-text-muted mt-0.5">Turn something in? Post it here.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Post
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="flex-1"><div className="skeleton h-4 w-24 mb-1.5" /><div className="skeleton h-3 w-16" /></div>
              </div>
              <div className="skeleton h-48 w-full rounded-xl mb-3" />
              <div className="skeleton h-4 w-3/4 mb-2" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-12 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-found-light flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-found"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <h3 className="font-bold text-text mb-1">No found items yet</h3>
          <p className="text-sm text-text-muted">Be the first to report a found item</p>
        </div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} type="found" onDelete={() => loadPosts()} />)
      )}

      {showForm && <PostForm type="found" onClose={() => setShowForm(false)} onSuccess={loadPosts} />}
    </div>
  )
}
