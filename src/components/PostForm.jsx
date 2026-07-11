import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES, POST_LIMIT_PER_SECTION } from '../utils/constants'

export default function PostForm({ type, onClose, onSuccess, editPost }) {
  const { user } = useAuth()
  const [description, setDescription] = useState(editPost?.description || '')
  const [category, setCategory] = useState(editPost?.category || '')
  const [location, setLocation] = useState(editPost?.location || '')
  const [date, setDate] = useState(editPost?.date || '')
  const [image, setImage] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const isEditing = !!editPost

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitted) return
    setSubmitted(true)
    setError('')

    if (!isEditing) {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('status', 'active')

      if (count >= POST_LIMIT_PER_SECTION) {
        setError(`You can only have ${POST_LIMIT_PER_SECTION} active ${type} posts. Delete one first.`)
        setSubmitted(false)
        return
      }
    }

    setUploading(true)
    let imageUrl = editPost?.image_url || ''

    if (image) {
      setStatus('Compressing image...')
      const compressed = await compressImage(image)
      setStatus('Uploading image...')
      const formData = new FormData()
      formData.append('file', compressed)
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      imageUrl = data.secure_url || ''
    }

    const payload = { description, category, location, date, image_url: imageUrl }

    if (isEditing) {
      setStatus('Saving changes...')
      const { error: dbError } = await supabase.from('posts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editPost.id)
      if (dbError) { setUploading(false); setStatus(''); setError(dbError.message); setSubmitted(false); return }

      setStatus('Finding matches...')
      await supabase.functions.invoke('match-items', {
        body: { postId: editPost.id, type, rematch: true }
      }).catch(() => {})

      setUploading(false)
      setStatus('')
      onSuccess()
      onClose()
      return
    }

    setStatus('Saving post...')
    const { data: newPost, error: dbError } = await supabase.from('posts').insert({
      ...payload,
      user_id: user.id,
      type
    }).select()

    if (dbError) {
      setUploading(false)
      setStatus('')
      setError(dbError.message)
      setSubmitted(false)
      return
    }

    if (newPost?.[0]?.id) {
      setStatus('Finding matches with AI...')
      const { data: matchRes, error: fnErr } = await supabase.functions.invoke('match-items', {
        body: { postId: newPost[0].id, type }
      })
      if (fnErr) {
        console.error('Match invoke error:', fnErr)
        setUploading(false)
        setStatus('')
        setError('Posted, but auto-matching failed. Open the Matches tab to retry.')
        setSubmitted(false)
      } else if (matchRes?.matched > 0) {
        setUploading(false)
        setStatus('')
        setSuccess(`${matchRes.matched} match${matchRes.matched > 1 ? 'es' : ''} found! Check the Matches tab.`)
        setTimeout(() => { onSuccess(); onClose() }, 1800)
        return
      }
    }

    setUploading(false)
    setStatus('')
    onSuccess()
    onClose()
  }

  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 512
          let { width, height } = img
          if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim }
          else if (height > maxDim) { width *= maxDim / height; height = maxDim }
          canvas.width = width; canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.7)
        }
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={uploading ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />
      <div className="relative bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
        {uploading && (
          <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm rounded-t-2xl sm:rounded-2xl z-10 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 rounded-lg bg-accent/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold text-text">{status || 'Processing...'}</p>
          </div>
        )}

        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-extrabold text-text">
              {isEditing ? 'Edit' : 'Report'} {type === 'lost' ? 'Lost' : 'Found'} Item
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-warm transition cursor-pointer bg-transparent border-none text-text-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {image && (
              <div className="relative rounded-xl overflow-hidden">
                <img src={URL.createObjectURL(image)} className="w-full h-40 object-cover" alt="" />
                <button type="button" onClick={() => setImage(null)} className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white rounded-full w-7 h-7 flex items-center justify-center text-sm cursor-pointer border-none hover:bg-black/70 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}

            <label className="block cursor-pointer">
              <div className="flex items-center gap-3 p-3 border-2 border-dashed border-border rounded-xl hover:border-accent/40 hover:bg-accent/5 transition">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{image ? 'Change photo' : 'Add a photo'}</p>
                  <p className="text-xs text-text-muted">Optional but helps with matching</p>
                </div>
              </div>
              <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} className="hidden" />
            </label>

            <textarea required placeholder="Describe the item — what does it look like? Where was it lost/found?" value={description} onChange={e => setDescription(e.target.value)} className="input min-h-[100px]" />

            {!isEditing && description.trim().length < 20 && !image && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/5 border border-accent/10 text-xs text-accent font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Add details like color, brand, or distinguishing marks for better matching.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select required value={category} onChange={e => setCategory(e.target.value)} className="input">
                <option value="">Category *</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input required placeholder="Location *" value={location} onChange={e => setLocation(e.target.value)} className="input" />
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-lost-light text-lost text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-found-light text-found text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {success}
              </div>
            )}

            <button type="submit" disabled={uploading || submitted || !description.trim() || !category || !location.trim() || !date} className="btn-primary w-full py-3 text-[15px]">
              {uploading ? 'Saving...' : isEditing ? 'Save Changes' : 'Post Item'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
