import { supabase } from '../lib/supabase'
import { useState, useEffect, useRef } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMatched, setIsMatched] = useState(false)
  const menuRef = useRef(null)
  const isOwner = user?.id === post.user_id

  useEffect(() => {
    loadCounts()
    if (isOwner) checkMatchStatus()
  }, [post.id])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

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

  async function checkMatchStatus() {
    const { data } = await supabase
      .from('matches')
      .select('id')
      .or(`lost_post_id.eq.${post.id},found_post_id.eq.${post.id}`)
      .eq('status', 'confirmed')
      .limit(1)
    setIsMatched(!!data?.length)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    setMenuOpen(false)
    await supabase.from('posts').delete().eq('id', post.id)
    onDelete?.(post.id)
  }

  function handleEdit(e) {
    e.stopPropagation()
    setMenuOpen(false)
    setShowEdit(true)
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
          <div className="text-xs text-gray-500">{timeAgo(post.updated_at || post.created_at)}{post.updated_at && post.updated_at !== post.created_at ? ' (edited)' : ''}</div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${type === 'lost' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {type === 'lost' ? 'Lost' : 'Found'}
        </span>
        {isOwner && (
          <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-400 hover:text-gray-600 text-lg px-1 cursor-pointer">&hellip;</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32 z-20">
                {!isMatched && (
                  <button onClick={handleEdit} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer">Edit</button>
                )}
                <button onClick={handleDelete} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer">Delete</button>
              </div>
            )}
          </div>
        )}
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

      {isMatched && isOwner && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-[11px] text-amber-600 font-medium">Locked — confirmed match active</span>
        </div>
      )}

      {showEdit && (
        <PostForm type={type} editPost={post} onClose={() => setShowEdit(false)} onSuccess={() => { setShowEdit(false); onDelete?.() }} />
      )}
    </div>
  )
}
