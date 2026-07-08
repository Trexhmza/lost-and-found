import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function DMs() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const [page, setPage] = useState('list')

  useEffect(() => {
    loadConversations()
    const channel = supabase
      .channel('dm-convs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { if (page === 'list') loadConversations() })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [page])

  useEffect(() => {
    if (!selectedConv) return
    const channel = supabase
      .channel(`msgs-${selectedConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          if (payload.new.sender_id !== user.id) {
            supabase.from('messages').update({ status: 'delivered' }).eq('id', payload.new.id).then(() => loadMessages())
          }
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [selectedConv?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*, user1:user1_id(id, name, avatar_url), user2:user2_id(id, name, avatar_url)')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (data) setConversations(data)
    setLoading(false)
  }

  async function loadMessages() {
    if (!selectedConv) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', selectedConv.id)
      .order('created_at', { ascending: true })
    if (data) {
      const unreadIds = data.filter(m => m.sender_id !== user.id && m.status === 'sent').map(m => m.id)
      if (unreadIds.length) {
        await supabase.from('messages').update({ status: 'delivered' }).in('id', unreadIds)
      }
      setMessages(data.map(m => unreadIds.includes(m.id) ? { ...m, status: 'delivered' } : m))
    }
  }

  async function openConversation(conv) {
    setSelectedConv(conv)
    setPage('chat')
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (data) {
      const unreadIds = data.filter(m => m.sender_id !== user.id && m.status === 'sent').map(m => m.id)
      if (unreadIds.length) {
        await supabase.from('messages').update({ status: 'delivered' }).in('id', unreadIds)
      }
      setMessages(data.map(m => unreadIds.includes(m.id) ? { ...m, status: 'delivered' } : m))
    }
  }

  async function sendMessage() {
    if (!newMsg.trim() || !selectedConv) return
    const { data } = await supabase.from('messages').insert({
      conversation_id: selectedConv.id,
      sender_id: user.id,
      content: newMsg,
      status: 'sent'
    }).select().single()
    setNewMsg('')
    if (data) setMessages(prev => [...prev, data])
  }

  function markAsRead(msgId) {
    supabase.from('messages').update({ status: 'read' }).eq('id', msgId).then(() => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'read' } : m))
    })
  }

  function statusIcon(m) {
    if (m.sender_id !== user.id) return null
    if (m.status === 'read') return <span className="text-[10px] text-blue-400 ml-1">✓✓</span>
    if (m.status === 'delivered') return <span className="text-[10px] text-gray-400 ml-1">✓✓</span>
    return <span className="text-[10px] text-gray-400 ml-1">✓</span>
  }

  function otherUser(conv) {
    return conv.user1_id === user.id ? conv.user2 : conv.user1
  }

  if (page === 'chat' && selectedConv) {
    const other = otherUser(selectedConv)
    return (
      <div>
        <button onClick={() => { setPage('list'); setSelectedConv(null) }} className="text-sm text-blue-600 hover:underline mb-3 cursor-pointer">&larr; Back to DMs</button>
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold overflow-hidden">
              {other?.avatar_url ? <img src={other.avatar_url} className="w-full h-full object-cover" /> : other?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="font-semibold text-sm">{other?.name}</span>
          </div>

          <div className="h-80 overflow-y-auto mb-4 space-y-2" onMouseEnter={() => {
            const unseen = messages.filter(m => m.sender_id !== user.id && m.status !== 'read')
            unseen.forEach(m => markAsRead(m.id))
          }}>
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                onMouseEnter={() => { if (m.sender_id !== user.id && m.status !== 'read') markAsRead(m.id) }}>
                <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.sender_id === user.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                  {m.sender_id === user.id && <span className="inline-flex items-center">{statusIcon(m)}</span>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex gap-2">
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
            <button type="submit" disabled={!newMsg.trim()} className="btn-primary text-sm">Send</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Messages</h1>
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No conversations yet.</div>
      ) : (
        conversations.map(conv => {
          const other = otherUser(conv)
          return (
            <button key={conv.id} onClick={() => openConversation(conv)} className="card w-full text-left mb-2 cursor-pointer hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold overflow-hidden">
                  {other?.avatar_url ? <img src={other.avatar_url} className="w-full h-full object-cover" /> : other?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="text-sm font-semibold">{other?.name}</div>
                  <div className="text-xs text-gray-500">Tap to chat</div>
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
