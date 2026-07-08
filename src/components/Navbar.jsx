import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [matchCount, setMatchCount] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('match-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchMatchCount())
      .subscribe()
    fetchMatchCount()
    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchMatchCount() {
    const { data: userPosts } = await supabase.from('posts').select('id').eq('user_id', user.id)
    if (!userPosts?.length) { setMatchCount(0); return }
    const postIds = userPosts.map(p => p.id)
    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .or(`lost_post_id.in.(${postIds.join(',')}),found_post_id.in.(${postIds.join(',')})`)
      .eq('status', 'pending')
    setMatchCount(count || 0)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/lost" className="text-xl font-bold text-blue-600">Lost & Found</Link>
        <div className="flex items-center gap-5 text-sm font-medium">
          <Link to="/lost" className="hover:text-blue-600 transition">Lost</Link>
          <Link to="/found" className="hover:text-blue-600 transition">Found</Link>
          <Link to="/matches" className="hover:text-blue-600 transition relative">Matches{matchCount > 0 && <span className="absolute -top-1.5 -right-3 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{matchCount}</span>}</Link>
          <Link to="/dms" className="hover:text-blue-600 transition">DMs</Link>
          <div className="relative group">
            <button className="flex items-center gap-2 cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  profile?.name?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <span className="hidden sm:inline text-gray-700">{profile?.name}</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40 hidden group-hover:block">
              <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-gray-50">Profile</Link>
              <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer">Logout</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
