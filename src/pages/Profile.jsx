import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../utils/constants'
import Avatar from '../components/Avatar'

export default function Profile() {
  const { user, profile, fetchProfile } = useAuth()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [myPosts, setMyPosts] = useState([])
  const [matchedPostIds, setMatchedPostIds] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

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
    if (data) {
      setMyPosts(data)
      const postIds = data.map(p => p.id)
      if (postIds.length) {
        const { data: matches } = await supabase
          .from('matches')
          .select('lost_post_id, found_post_id')
          .or(`lost_post_id.in.(${postIds.join(',')}),found_post_id.in.(${postIds.join(',')})`)
        const locked = new Set()
        if (matches) {
          for (const m of matches) {
            locked.add(m.lost_post_id)
            locked.add(m.found_post_id)
          }
        }
        setMatchedPostIds(locked)
      }
    }
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({ name, bio }).eq('id', user.id)
    await fetchProfile(user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
      {/* Profile Header */}
      <div className="card mb-6 animate-slideUp">
        <div className="flex flex-col items-center mb-5">
          <label className="relative cursor-pointer group">
            <Avatar src={avatarUrl} name={profile?.name} size="xl" className="group-hover:ring-accent/20 transition-all" />
            <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-lg ring-2 ring-surface group-hover:scale-110 transition-transform">
              {uploading ? (
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
          <h2 className="text-xl font-extrabold text-text mt-3">{profile?.name}</h2>
          <p className="text-sm text-text-muted">{profile?.email}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="input" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." className="input min-h-[70px]" />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center py-3">
          <div className="text-2xl font-extrabold text-accent">{myPosts.length}</div>
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mt-0.5">Posts</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-extrabold text-lost">{myPosts.filter(p => p.type === 'lost').length}</div>
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mt-0.5">Lost</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-extrabold text-found">{myPosts.filter(p => p.type === 'found').length}</div>
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mt-0.5">Found</div>
        </div>
      </div>

      {/* My Posts */}
      <h2 className="text-lg font-extrabold text-text mb-3">My Posts</h2>
      {myPosts.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-text-muted">No posts yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {myPosts.map(post => (
            <div key={post.id} className="card flex items-center gap-3 animate-slideUp">
              {post.image_url && <img src={post.image_url} className="w-14 h-14 rounded-xl object-cover shrink-0" alt="" />}
              <div className="flex-1 min-w-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${post.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
                  {post.type.toUpperCase()}
                </span>
                <p className="text-sm text-text mt-1 line-clamp-1">{post.description}</p>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {timeAgo(post.updated_at || post.created_at)}
                    {post.updated_at && post.updated_at !== post.created_at && <span className="text-accent font-medium ml-1">(edited)</span>}
                </div>
              </div>
              {matchedPostIds.has(post.id) ? (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-dark"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="text-[10px] font-bold text-accent-dark">Locked</span>
                </div>
              ) : (
                <button onClick={() => deletePost(post.id)} className="text-xs font-semibold text-lost hover:text-lost/80 cursor-pointer bg-transparent border-none shrink-0">Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
