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
  const isEditing = !!editPost

  async function handleSubmit(e) {
    e.preventDefault()
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
      if (dbError) { setUploading(false); setStatus(''); setError(dbError.message); return }

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={uploading ? undefined : onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
        {uploading && (
          <div className="absolute inset-0 bg-white/90 rounded-xl z-10 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">{status || 'Processing...'}</p>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{isEditing ? 'Edit' : 'Report'} {type === 'lost' ? 'Lost' : 'Found'} Item</h2>
          <button onClick={onClose} className="text-gray-500 text-xl cursor-pointer">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {image && (
            <div className="relative">
              <img src={URL.createObjectURL(image)} className="w-full h-40 object-cover rounded-lg" />
              <button type="button" onClick={() => setImage(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 text-sm cursor-pointer">&times;</button>
            </div>
          )}
          <label className="block">
            <span className="text-sm text-gray-600">{image ? 'Change' : 'Add'} Photo (optional)</span>
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} className="block w-full text-sm mt-1" />
          </label>
          <textarea required placeholder="Describe the item..." value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px]" />
          <div className="flex gap-3">
            <select value={category} onChange={e => setCategory(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm flex-1">
              <option value="">Category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm flex-1" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm flex-1" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm font-medium">{success}</p>}
          <button type="submit" disabled={uploading || !description.trim()} className="btn-primary w-full">{uploading ? 'Saving...' : isEditing ? 'Save' : 'Post'}</button>
        </form>
      </div>
    </div>
  )
}
