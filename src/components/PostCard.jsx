import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LikeButton from './LikeButton'
import PostForm from './PostForm'
import { timeAgo } from '../utils/constants'

export default function PostCard({ post, type, onDelete }) {
  const { user } = useAuth()
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const isOwner = user?.id === post.user_id

  useEffect(() => {
    loadCounts()
  }, [post.id])

  async function loadCounts() {
    const { count: lc } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    const { count: cc } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    setLikeCount(lc || 0)
    setCommentCount(cc || 0)

    if (user) {
      const { data } = await supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle()
      setLiked(!!data)
    }
  }

  async function handleDelete(e) {
    e.stopPropagation()
    await supabase.from('posts').delete().eq('id', post.id)
    onDelete?.(post.id)
  }

  return (
    <div className="card mb-4 relative cursor-pointer hover:shadow-md transition" onClick={() => window.location.href = `/post/${post.id}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold overflow-hidden">
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} className="w-full h-full object-cover" />
          ) : (
            post.profiles?.name?.charAt(0)?.toUpperCase() || '?'
          )}
        </div>
        <div>
          <span className="text-sm font-semibold">{post.profiles?.name}</span>
          <div className="text-xs text-gray-500">{timeAgo(post.created_at)}</div>
        </div>
        <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${type === 'lost' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {type === 'lost' ? 'Lost' : 'Found'}
        </span>
      </div>

      {post.image_url && (
        <img src={post.image_url} className="w-full h-48 object-cover rounded-lg mb-3" />
      )}

      <p className="text-sm text-gray-800 line-clamp-2">{post.description}</p>

      {post.location && <div className="text-xs text-gray-500 mt-1">📍 {post.location}</div>}

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <div onClick={e => e.stopPropagation()}>
          <LikeButton postId={post.id} liked={liked} count={likeCount} onToggle={(l, c) => { setLiked(l); setLikeCount(c) }} />
        </div>
        <span>💬 {commentCount}</span>
      </div>

      {isOwner && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
          <button onClick={e => { e.stopPropagation(); setShowEdit(true) }} className="text-xs text-blue-600 hover:underline cursor-pointer">Edit</button>
          <button onClick={handleDelete} className="text-xs text-red-600 hover:underline cursor-pointer">Delete</button>
        </div>
      )}

      {showEdit && (
        <PostForm type={type} editPost={post} onClose={() => setShowEdit(false)} onSuccess={() => { setShowEdit(false); onDelete?.() }} />
      )}
    </div>
  )
}
