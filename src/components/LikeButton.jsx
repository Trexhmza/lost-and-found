import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function LikeButton({ postId, liked, count, onToggle }) {
  const { user } = useAuth()

  async function toggle() {
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      onToggle(false, count - 1)
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
      onToggle(true, count + 1)
    }
  }

  return (
    <button onClick={e => { e.preventDefault(); toggle() }} className="flex items-center gap-1 cursor-pointer">
      <span>{liked ? '❤️' : '🤍'}</span>
      <span>{count}</span>
    </button>
  )
}
