import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LikeButton from '../components/LikeButton'
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
      .eq('status', 'confirmed')
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
    await supabase.from('comments').insert({ post_id: id, user_id: user.id, content: newComment })
    setNewComment('')
    loadComments()
  }

  async function showLikes() {
    const { data } = await supabase
      .from('likes')
      .select('*, profiles(name, avatar_url)')
      .eq('post_id', id)
    if (data) setLikedBy(data)
    setShowLikedBy(true)
  }

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>
  if (!post) return <div className="text-center py-10 text-gray-500">Post not found</div>

  const isOwner = user?.id === post.user_id

  return (
    <div>
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Link to={`/profile/${post.user_id}`}>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold overflow-hidden">
              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : post.profiles?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </Link>
          <div>
            <Link to={`/profile/${post.user_id}`} className="text-sm font-semibold hover:underline">{post.profiles?.name}</Link>
            <div className="text-xs text-gray-500">{timeAgo(post.updated_at || post.created_at)}{post.updated_at && post.updated_at !== post.created_at ? ' (edited)' : ''}</div>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${post.type === 'lost' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {post.type === 'lost' ? 'Lost' : 'Found'}
          </span>
          {isOwner && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-400 hover:text-gray-600 text-lg px-1 cursor-pointer">&hellip;</button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32 z-20">
                  {!isMatched && (
                    <button onClick={() => { setMenuOpen(false); navigate('/') }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer">Edit</button>
                  )}
                  <button onClick={handleDelete} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer">Delete</button>
                </div>
              )}
            </div>
          )}
        </div>

        {post.image_url && <img src={post.image_url} className="w-full max-h-96 object-contain rounded-lg mb-3 bg-gray-100" />}

        <p className="text-sm text-gray-800">{post.description}</p>

        {post.category && <div className="text-xs text-gray-500 mt-1">🏷️ {post.category}</div>}
        {post.location && <div className="text-xs text-gray-500 mt-1">📍 {post.location}</div>}
        {post.date && <div className="text-xs text-gray-500 mt-1">📅 {post.date}</div>}

        <div className="flex items-center gap-4 mt-3 text-sm">
          <LikeButton postId={id} liked={liked} count={likeCount} onToggle={(l, c) => { setLiked(l); setLikeCount(c) }} />
          {isOwner && likeCount > 0 && (
            <button onClick={showLikes} className="text-xs text-blue-600 hover:underline cursor-pointer">See who liked</button>
          )}
          <span>💬 {comments.length} comments</span>
        </div>

        {isMatched && isOwner && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-[11px] text-amber-600 font-medium">Locked — confirmed match active</span>
          </div>
        )}
      </div>

      <div className="card mt-4">
        <h3 className="text-sm font-semibold mb-3">Comments</h3>
        <form onSubmit={handleComment} className="flex gap-2 mb-4">
          <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Write a comment..." className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
          <button type="submit" disabled={!newComment.trim()} className="btn-primary text-sm">Post</button>
        </form>
        {comments.length === 0 ? (
          <p className="text-xs text-gray-500">No comments yet.</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-2 mb-3">
              <Link to={`/profile/${c.user_id}`}>
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                  {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : c.profiles?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link to={`/profile/${c.user_id}`} className="text-xs font-semibold hover:underline">{c.profiles?.name}</Link>
                  <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Liked By Modal */}
      {showLikedBy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowLikedBy(false)}>
          <div className="bg-white rounded-xl p-4 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Liked by</h3>
            {likedBy.map(l => (
              <div key={l.user_id} className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold overflow-hidden">
                  {l.profiles?.avatar_url ? <img src={l.profiles.avatar_url} className="w-full h-full object-cover" /> : l.profiles?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <Link to={`/profile/${l.user_id}`} className="text-sm hover:underline">{l.profiles?.name}</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
