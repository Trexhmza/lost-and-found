import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function LikeButton({ postId, liked, count, onToggle }) {
  const { user } = useAuth()
  const [animating, setAnimating] = useState(false)

  async function toggle() {
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      onToggle(false, count - 1)
    } else {
      setAnimating(true)
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
      onToggle(true, count + 1)
      setTimeout(() => setAnimating(false), 600)
    }
  }

  return (
    <button onClick={e => { e.preventDefault(); toggle() }} className="flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-1 rounded-lg hover:bg-lost-light transition group">
      <span className={`text-lg transition-transform ${animating ? 'animate-[heartBeat_0.6s_ease-in-out]' : 'group-hover:scale-110'}`}>
        {liked ? '❤️' : '🤍'}
      </span>
      <span className={`text-sm font-semibold ${liked ? 'text-lost' : 'text-text-muted group-hover:text-lost'} transition-colors`}>{count}</span>
    </button>
  )
}
