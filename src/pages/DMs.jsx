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
  }, [])

  useEffect(() => {
    if (!selectedConv) return
    loadMessages()
    const channel = supabase
      .channel(`msgs-${selectedConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` }, (payload) => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
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
    if (data) setMessages(data)
  }

  async function openConversation(conv) {
    setSelectedConv(conv)
    setPage('chat')
  }

  async function sendMessage() {
    if (!newMsg.trim() || !selectedConv) return
    const { data } = await supabase.from('messages').insert({
      conversation_id: selectedConv.id,
      sender_id: user.id,
      content: newMsg
    }).select().single()
    setNewMsg('')
    if (data) setMessages(prev => [...prev, data])
  }

  function otherUser(conv) {
    return conv.user1_id === user.id ? conv.user2 : conv.user1
  }

  if (page === 'chat' && selectedConv) {
    const other = otherUser(selectedConv)
    return (
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 140px)' }}>
        {/* Chat header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border-light mb-4">
          <button onClick={() => { setPage('list'); setSelectedConv(null) }} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-warm transition cursor-pointer bg-transparent border-none text-text-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary-light/20 flex items-center justify-center text-sm font-bold text-primary overflow-hidden ring-2 ring-white shrink-0">
            {other?.avatar_url ? <img src={other.avatar_url} className="w-full h-full object-cover" alt="" /> : other?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-text block truncate">{other?.name}</span>
            <span className="text-[11px] text-found font-medium">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted">No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 text-sm ${m.sender_id === user.id
                ? 'bg-primary text-white rounded-2xl rounded-br-md'
                : 'bg-bg-warm text-text rounded-2xl rounded-bl-md'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex gap-2 pt-3 border-t border-border-light">
          <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." className="input flex-1" />
          <button type="submit" disabled={!newMsg.trim()} className="btn-primary px-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-text tracking-tight mb-1">Messages</h1>
      <p className="text-sm text-text-muted mb-5">Chat with matched users</p>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card flex items-center gap-3">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1"><div className="skeleton h-4 w-24 mb-1.5" /><div className="skeleton h-3 w-16" /></div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="card text-center py-12 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h3 className="font-bold text-text mb-1">No conversations yet</h3>
          <p className="text-sm text-text-muted">Confirm a match to start chatting</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => {
            const other = otherUser(conv)
            return (
              <button key={conv.id} onClick={() => openConversation(conv)} className="card w-full text-left cursor-pointer hover:shadow-md transition flex items-center gap-3 animate-slideUp">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary-light/20 flex items-center justify-center text-sm font-bold text-primary overflow-hidden ring-2 ring-white shrink-0">
                  {other?.avatar_url ? <img src={other.avatar_url} className="w-full h-full object-cover" alt="" /> : other?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-text truncate">{other?.name}</div>
                  <div className="text-xs text-text-muted">Tap to chat</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
