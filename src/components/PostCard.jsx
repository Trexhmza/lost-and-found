import { supabase } from '../lib/supabase'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import LikeButton from './LikeButton'
import PostForm from './PostForm'
import Avatar from './Avatar'
import { timeAgo } from '../utils/constants'

export default function PostCard({ post, type, onDelete }) {
  const { user } = useAuth()
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMatched, setIsMatched] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
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
      .select('id, confidence')
      .or(`lost_post_id.eq.${post.id},found_post_id.eq.${post.id}`)
    setIsMatched(!!data?.length)
    setMatchCount(data?.length || 0)
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

  const isEdited = post.updated_at && post.updated_at !== post.created_at

  return (
    <>
      <div className="card card-interactive mb-4 animate-slideUp" onClick={() => window.location.href = `/post/${post.id}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar src={post.profiles?.avatar_url} name={post.profiles?.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-text truncate">{post.profiles?.name}</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
                {type === 'lost' ? 'LOST' : 'FOUND'}
              </span>
              {post.category && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {post.category}
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {timeAgo(post.updated_at || post.created_at)}
              {isEdited && <span className="text-accent font-medium ml-1">(edited)</span>}
            </div>
          </div>

          {isOwner && (
            <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-warm transition cursor-pointer bg-transparent border-none text-text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-2xl shadow-xl py-1.5 w-36 z-20 animate-scaleIn">
                  {!isMatched && (
                    <button onClick={handleEdit} className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-warm transition cursor-pointer bg-transparent border-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  )}
                  <button onClick={handleDelete} className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-medium text-lost hover:bg-lost-light transition cursor-pointer bg-transparent border-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="post-image-wrapper mb-3 -mx-1">
            <img src={post.image_url} className="w-full h-52 object-cover" alt="" loading="lazy" />
          </div>
        )}

        {/* Content */}
        <p className="text-sm text-text leading-relaxed line-clamp-2 mb-2">{post.description}</p>

        {post.location && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {post.location}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1 pt-2 border-t border-border" onClick={e => e.stopPropagation()}>
          <LikeButton postId={post.id} liked={liked} count={likeCount} onToggle={(l, c) => { setLiked(l); setLikeCount(c) }} />
          <span className="flex items-center gap-1.5 px-2 py-1 text-sm text-text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {commentCount}
          </span>

          {isOwner && (
            isMatched ? (
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-found/10 text-found">
                <span className="text-sm">&#128522;</span>
                <span className="text-[11px] font-bold">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface text-text-muted border border-border">
                <span className="text-sm">&#128543;</span>
                <span className="text-[11px] font-medium">No matches</span>
              </div>
            )
          )}
        </div>
      </div>

      {showEdit && (
        <PostForm type={type} editPost={post} onClose={() => setShowEdit(false)} onSuccess={() => { setShowEdit(false); onDelete?.() }} />
      )}
    </>
  )
}
