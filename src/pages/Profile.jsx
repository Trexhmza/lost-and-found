import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../utils/constants'

export default function Profile() {
  const { user, profile, fetchProfile } = useAuth()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [myPosts, setMyPosts] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  useEffect(() => { loadMyPosts() }, [user])

  async function loadMyPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (data) setMyPosts(data)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({ name, bio }).eq('id', user.id)
    await fetchProfile(user.id)
    setSaving(false)
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData })
    const data = await res.json()
    if (data.secure_url) {
      await supabase.from('profiles').update({ avatar_url: data.secure_url }).eq('id', user.id)
      setAvatarUrl(data.secure_url)
      await fetchProfile(user.id)
    }
    setUploading(false)
  }

  async function deletePost(postId) {
    await supabase.from('posts').delete().eq('id', postId)
    loadMyPosts()
  }

  return (
    <div>
      <div className="card mb-4">
        <div className="flex flex-col items-center mb-4">
          <label className="relative cursor-pointer">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{uploading ? '...' : '+'}</div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
          <div className="text-sm text-gray-500 mt-1">{profile?.email}</div>
        </div>

        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" className="w-full border border-gray-300 rounded-lg p-2 text-sm min-h-[60px]" />
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-sm">{saving ? 'Saving...' : 'Save Profile'}</button>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">My Posts ({myPosts.length})</h2>
      {myPosts.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">No posts yet.</div>
      ) : (
        myPosts.map(post => (
          <div key={post.id} className="card mb-2 flex items-center justify-between">
            <div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${post.type === 'lost' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {post.type}
              </span>
              <p className="text-sm text-gray-700 mt-1 line-clamp-1">{post.description}</p>
              <div className="text-xs text-gray-400 mt-1">{timeAgo(post.created_at)}</div>
            </div>
            <button onClick={() => deletePost(post.id)} className="text-xs text-red-600 hover:underline cursor-pointer">Delete</button>
          </div>
        ))
      )}
    </div>
  )
}
