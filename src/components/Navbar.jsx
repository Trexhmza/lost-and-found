import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

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
          <Link to="/matches" className="hover:text-blue-600 transition">Matches</Link>
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
