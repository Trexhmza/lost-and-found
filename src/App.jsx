import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import LostFeed from './pages/LostFeed'
import FoundFeed from './pages/FoundFeed'
import Matches from './pages/Matches'
import DMs from './pages/DMs'
import Profile from './pages/Profile'
import UserProfile from './pages/UserProfile'
import PostDetail from './pages/PostDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-[100dvh] bg-bg">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<><Navbar /><main className="max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8"><Outlet /></main></>}>
                <Route path="/" element={<Navigate to="/lost" />} />
                <Route path="/lost" element={<LostFeed />} />
                <Route path="/found" element={<FoundFeed />} />
                <Route path="/matches" element={<Matches />} />
                <Route path="/dms" element={<DMs />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:id" element={<UserProfile />} />
                <Route path="/post/:id" element={<PostDetail />} />
              </Route>
            </Route>
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
