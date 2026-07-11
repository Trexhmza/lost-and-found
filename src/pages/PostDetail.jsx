import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LikeButton from '../components/LikeButton'
import Avatar from '../components/Avatar'
import { timeAgo } from '../utils/constants'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [comments, setComments] = useState([])
  const [likedBy, setLikedBy] = useState([])
  const [showLikedBy, setShowLikedBy] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMatched, setIsMatched] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    loadPost()
    loadComments()
  }, [id])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function loadPost() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(name, avatar_url)')
      .eq('id', id)
      .single()
    if (data) {
      setPost(data)
      if (user) {
        const { data: like } = await supabase.from('likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle()
        setLiked(!!like)
        if (user.id === data.user_id) checkMatchStatus()
      }
      const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id)
      setLikeCount(count || 0)
    }
    setLoading(false)
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(name, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  async function checkMatchStatus() {
    const { data } = await supabase
      .from('matches')
      .select('id')
      .or(`lost_post_id.eq.${id},found_post_id.eq.${id}`)
      .limit(1)
    setIsMatched(!!data?.length)
  }

  async function handleDelete() {
    setMenuOpen(false)
    await supabase.from('posts').delete().eq('id', id)
    navigate(-1)
  }

  async function handleComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    await supabase.from('comments').insert({
      post_id: id,
      user_id: user.id,
      content: newComment,
      parent_id: replyTo?.id || null
    })
    setNewComment('')
    setReplyTo(null)
    loadComments()
  }

  async function deleteComment(c) {
    await supabase.from('comments').update({ content: 'comment deleted' }).eq('id', c.id)
    setComments(prev => prev.map(cm => cm.id === c.id ? { ...cm, content: 'comment deleted' } : cm))
  }

  async function showLikes() {
    const { data } = await supabase
      .from('likes')
      .select('*, profiles(name, avatar_url)')
      .eq('post_id', id)
    if (data) setLikedBy(data)
    setShowLikedBy(true)
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-20 mb-4" />
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="skeleton w-10 h-10 rounded-full" />
          <div className="flex-1"><div className="skeleton h-4 w-24 mb-1.5" /><div className="skeleton h-3 w-16" /></div>
        </div>
        <div className="skeleton h-56 w-full rounded-xl mb-3" />
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    </div>
  )

  if (!post) return <div className="card text-center py-12"><p className="text-text-muted">Post not found</p></div>

  const isOwner = user?.id === post.user_id
  const isEdited = post.updated_at && post.updated_at !== post.created_at

  return (
    <div className="animate-fadeIn">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-accent mb-4 cursor-pointer bg-transparent border-none p-0 transition">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div className="card">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link to={`/profile/${post.user_id}`}>
            <Avatar src={post.profiles?.avatar_url} name={post.profiles?.name} />
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/profile/${post.user_id}`} className="text-sm font-bold text-text hover:text-accent transition no-underline">{post.profiles?.name}</Link>
            <div className="text-xs text-text-muted mt-0.5">
              {timeAgo(post.updated_at || post.created_at)}
              {isEdited && <span className="text-accent font-medium ml-1">(edited)</span>}
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${post.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
            {post.type === 'lost' ? 'LOST' : 'FOUND'}
          </span>
          {isOwner && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-warm transition cursor-pointer bg-transparent border-none text-text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-2xl shadow-xl py-1.5 w-36 z-20 animate-scaleIn">
                  {!isMatched && (
                    <button onClick={() => { setMenuOpen(false); navigate('/') }} className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-warm transition cursor-pointer bg-transparent border-none">
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
          <div className="rounded-xl overflow-hidden mb-4 -mx-1">
            <img src={post.image_url} className="w-full max-h-[400px] object-contain bg-bg-warm" alt="" />
          </div>
        )}

        {/* Description */}
        <p className="text-[15px] text-text leading-relaxed mb-4">{post.description}</p>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.category && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-warm text-xs font-semibold text-text-secondary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              {post.category}
            </span>
          )}
          {post.location && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-warm text-xs font-semibold text-text-secondary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {post.location}
            </span>
          )}
          {post.date && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-warm text-xs font-semibold text-text-secondary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {post.date}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <LikeButton postId={id} liked={liked} count={likeCount} onToggle={(l, c) => { setLiked(l); setLikeCount(c) }} />
          {isOwner && likeCount > 0 && (
            <button onClick={showLikes} className="text-xs font-semibold text-accent hover:underline cursor-pointer bg-transparent border-none">See who liked</button>
          )}
          <span className="flex items-center gap-1.5 px-2 py-1 text-sm text-text-muted ml-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {comments.length}
          </span>

          {isMatched && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span className="text-[11px] font-bold text-accent-dark">Locked</span>
            </div>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="card mt-4">
        <h3 className="text-sm font-bold text-text mb-4">Comments</h3>
        <form onSubmit={handleComment} className="flex gap-2 mb-5">
          {replyTo && (
            <div className="w-full mb-2 text-[11px] text-accent font-medium flex items-center gap-1">
              Replying to {replyTo.profiles?.name}
              <button type="button" onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text cursor-pointer bg-transparent border-none p-0 ml-1">x</button>
            </div>
          )}
          <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={replyTo ? `Reply to ${replyTo.profiles?.name}...` : 'Write a comment...'} className="input flex-1" />
          <button type="submit" disabled={!newComment.trim()} className="btn-primary px-4">Post</button>
        </form>

        {comments.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No comments yet. Start the conversation!</p>
        ) : (
          <div className="space-y-4">
            {comments.filter(c => !c.parent_id).map(c => {
              const replies = comments.filter(r => r.parent_id === c.id)
              const isDeleted = c.content === 'comment deleted'
              return (
                <div key={c.id} className="animate-slideUp">
                  <div className="flex gap-3">
                    <Link to={`/profile/${c.user_id}`} className="shrink-0">
                      <Avatar src={c.profiles?.avatar_url} name={c.profiles?.name} size="sm" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link to={`/profile/${c.user_id}`} className="text-xs font-bold text-text hover:text-accent transition no-underline">{c.profiles?.name}</Link>
                        <span className="text-[10px] text-text-muted">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className={`text-sm leading-relaxed ${isDeleted ? 'text-text-muted italic' : 'text-text-secondary'}`}>{c.content}</p>
                      {!isDeleted && (
                        <div className="flex items-center gap-3 mt-1.5">
                          {user && (
                            <button onClick={() => setReplyTo(replyTo?.id === c.id ? null : c)} className="text-[11px] font-semibold text-accent hover:underline cursor-pointer bg-transparent border-none p-0">
                              Reply
                            </button>
                          )}
                          {user?.id === c.user_id && (
                            <button onClick={() => deleteComment(c)} className="text-[11px] font-semibold text-text-muted hover:text-lost transition cursor-pointer bg-transparent border-none p-0">
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                      {replyTo?.id === c.id && (
                        <div className="mt-2 text-[11px] text-accent font-medium flex items-center gap-1">
                          Replying to {c.profiles?.name}
                          <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text cursor-pointer bg-transparent border-none p-0 ml-1">x</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Replies */}
                  {replies.length > 0 && (
                    <div className="ml-8 mt-3 space-y-3 border-l-2 border-border pl-4">
                      {replies.map(r => {
                        const rDeleted = r.content === 'comment deleted'
                        return (
                          <div key={r.id} className="flex gap-3 animate-slideUp">
                            <Link to={`/profile/${r.user_id}`} className="shrink-0">
                              <Avatar src={r.profiles?.avatar_url} name={r.profiles?.name} size="sm" />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <Link to={`/profile/${r.user_id}`} className="text-xs font-bold text-text hover:text-accent transition no-underline">{r.profiles?.name}</Link>
                                <span className="text-[10px] text-text-muted">{timeAgo(r.created_at)}</span>
                              </div>
                              <p className={`text-sm leading-relaxed ${rDeleted ? 'text-text-muted italic' : 'text-text-secondary'}`}>{r.content}</p>
                              {!rDeleted && user?.id === r.user_id && (
                                <button onClick={() => deleteComment(r)} className="text-[11px] font-semibold text-text-muted hover:text-lost transition cursor-pointer bg-transparent border-none p-0 mt-1">
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Liked By Modal */}
      {showLikedBy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLikedBy(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />
          <div className="relative bg-surface w-full sm:w-80 sm:rounded-2xl rounded-t-2xl p-5 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-0 pb-3">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <h3 className="text-sm font-bold text-text mb-4">Liked by</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {likedBy.map(l => (
                <div key={l.user_id} className="flex items-center gap-3">
                  <Avatar src={l.profiles?.avatar_url} name={l.profiles?.name} size="sm" />
                  <Link to={`/profile/${l.user_id}`} className="text-sm font-semibold text-text hover:text-accent transition no-underline">{l.profiles?.name}</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
