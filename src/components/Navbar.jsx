import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/lost', label: 'Lost', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  )},
  { to: '/found', label: 'Found', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  )},
  { to: '/matches', label: 'Matches', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
  )},
  { to: '/dms', label: 'DMs', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )},
]

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [matchCount, setMatchCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

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
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:block sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/lost" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <span className="text-lg font-extrabold text-text tracking-tight">Lost<text fill="currentColor" className="text-primary"> &</text>Found</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map(item => {
              const active = location.pathname === item.to
              return (
                <Link key={item.to} to={item.to} className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all no-underline ${active ? 'bg-primary-50 text-primary' : 'text-text-secondary hover:bg-bg-warm hover:text-text'}`}>
                  {item.label}
                  {item.to === '/matches' && matchCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-lost text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{matchCount}</span>
                  )}
                </Link>
              )
            })}

            <div className="ml-3 pl-3 border-l border-border relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 cursor-pointer bg-transparent border-none p-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-primary-light/20 flex items-center justify-center text-sm font-bold text-primary overflow-hidden ring-2 ring-surface">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    profile?.name?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </div>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-surface border border-border rounded-2xl shadow-xl py-2 w-48 z-50 animate-slideDown">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-bold text-text truncate">{profile?.name}</p>
                      <p className="text-xs text-text-muted truncate">{profile?.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-warm transition no-underline">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Profile
                    </Link>
                    <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-lost hover:bg-lost-light transition cursor-pointer w-full bg-transparent border-none text-left">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <nav className="md:hidden sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="px-4 flex items-center justify-between h-14">
          <Link to="/lost" className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <span className="text-base font-extrabold text-text tracking-tight">Lost<text fill="currentColor" className="text-primary"> &</text>Found</span>
          </Link>
          <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/10 to-primary-light/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden ring-2 ring-surface cursor-pointer border-none">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" /> : profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <div className="bottom-nav md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(item => {
            const active = location.pathname === item.to
            return (
              <Link key={item.to} to={item.to} className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all no-underline ${active ? 'text-primary' : 'text-text-muted'}`}>
                <div className="relative">
                  {item.icon}
                  {item.to === '/matches' && matchCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-lost text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5">{matchCount}</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold">{item.label}</span>
                {active && <div className="absolute -bottom-1 w-5 h-0.5 rounded-full bg-primary" />}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
