'use client';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL, socket, useAppState } from '@/App';
import { MessageCircle, Send, User, Clock, Check, CheckCheck, Loader2, ShieldAlert, Download, Image as ImageIcon } from 'lucide-react';
import { hasPermission, PERMISSIONS, isAdminRole } from '@/lib/roles';

function MediaMessage({ msgId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchMedia = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API_URL}/whatsapp/chat/media/${msgId}`);
      if (res.data.success && res.data.media) {
        setMedia(res.data);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [msgId]);

  if (media) {
    if (media.mimetype.startsWith('image/')) {
      return <img src={`data:${media.mimetype};base64,${media.media}`} alt="Media" className="w-full max-w-[400px] rounded-md mt-1 mb-1 max-h-[400px] object-contain bg-slate-900/50" />;
    } else if (media.mimetype.startsWith('video/')) {
      return <video controls src={`data:${media.mimetype};base64,${media.media}`} className="w-full max-w-[400px] rounded-md mt-1 mb-1 max-h-[400px] bg-slate-900/50" />;
    } else if (media.mimetype.startsWith('audio/')) {
      return <audio controls src={`data:${media.mimetype};base64,${media.media}`} className="w-full mt-1 mb-1 max-w-[200px]" />;
    }
    return (
      <a href={`data:${media.mimetype};base64,${media.media}`} download={media.filename || 'berkas'} className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 underline text-xs mt-1 mb-1 p-2 bg-slate-800/50 rounded">
        <Download size={14} /> Unduh {media.filename || 'Berkas'}
      </a>
    );
  }

  return (
    <div className="text-xs mb-1 border border-slate-500/30 p-2 rounded bg-slate-800/50 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="italic flex items-center gap-1 text-slate-300">
          <ImageIcon size={14} /> {loading ? 'Memuat media...' : 'Terdapat media'}
        </span>
        {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
      </div>
      {error && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-red-400 text-[10px]">Gagal memuat media.</span>
          <button onClick={fetchMedia} className="text-[10px] bg-slate-600 px-2 py-1 rounded text-white">Coba lagi</button>
        </div>
      )}
    </div>
  );
}

export default function LiveChatPage() {
  const { showToast, sessionUser } = useAppState();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChats();

    if (socket) {
      socket.on('wa_message_received', handleNewMessage);
      socket.on('wa_message_sent', handleNewMessage);
      socket.on('wa_message_ack', handleAck);
    }

    return () => {
      if (socket) {
        socket.off('wa_message_received', handleNewMessage);
        socket.off('wa_message_sent', handleNewMessage);
        socket.off('wa_message_ack', handleAck);
      }
    };
  }, []);

  const handleAck = ({ id, ack }) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ack } : m));
  };

  const handleNewMessage = (msg) => {
    // Apabila pesan milik chat yang sedang dibuka
    setSelectedChat(prevChat => {
      if (prevChat && (msg.from === prevChat.id || msg.to === prevChat.id)) {
        setMessages(prev => {
          // Cegah duplikasi
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 100);
      }
      return prevChat;
    });

    // Perbarui daftar chat
    setChats(prev => {
      const chatIndex = prev.findIndex(c => c.id === msg.from || c.id === msg.to);
      if (chatIndex > -1) {
        const newChats = [...prev];
        newChats[chatIndex].lastMessage = { body: msg.body, timestamp: msg.timestamp, fromMe: msg.fromMe };
        newChats[chatIndex].timestamp = msg.timestamp;
        if (!msg.fromMe && (!selectedChat || selectedChat.id !== msg.from)) {
          newChats[chatIndex].unreadCount = (newChats[chatIndex].unreadCount || 0) + 1;
        }
        // Pindahkan ke atas
        const [movedChat] = newChats.splice(chatIndex, 1);
        newChats.unshift(movedChat);
        return newChats;
      }
      // Jika chat belum ada, bisa fetch ulang
      fetchChats();
      return prev;
    });
  };

  const fetchChats = async () => {
    try {
      const res = await axios.get(`${API_URL}/whatsapp/chat`);
      setChats(res.data);
    } catch (e) {
      console.error('Failed to get chats', e);
      // Mungkin WA belum connect
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChat = async (chat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    try {
      const res = await axios.get(`${API_URL}/whatsapp/chat/${encodeURIComponent(chat.id)}`);
      setMessages(res.data);
      setTimeout(scrollToBottom, 100);
      
      // Reset unread
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
    } catch (e) {
      showToast('Gagal memuat pesan', 'error');
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedChat) return;

    const text = inputText;
    setInputText('');
    setSending(true);

    try {
      const res = await axios.post(`${API_URL}/whatsapp/chat/send`, {
        chatId: selectedChat.id,
        text
      });
      if (res.data.success) {
        // Tambahkan secara optimis, tapi sudah ditangani oleh 'wa_message_sent' melalui socket
      }
    } catch (e) {
      showToast('Gagal mengirim pesan', 'error');
      setInputText(text); // kembalikan text jika gagal
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const getAckIcon = (ack) => {
    if (ack === 1) return <Check size={12} />; // terkirim ke server
    if (ack === 2) return <CheckCheck size={12} />; // delivered
    if (ack === 3 || ack === 4) return <CheckCheck size={12} className="text-blue-400" />; // read
    return <Clock size={10} />; // 0 or undefined = pending
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl">
      <div className="flex-none p-4 border-b border-slate-700/50 bg-slate-800 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <MessageCircle className="text-emerald-400" /> Live Chat Omnichannel
          </h1>
          <p className="text-xs text-slate-400 mt-1">Satu nomor WhatsApp, dikelola bersama</p>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Chat List Sidebar */}
        <div className="w-1/3 md:w-80 flex flex-col border-r border-slate-700/50 bg-slate-800/50 min-h-0">
          <div className="p-3 border-b border-slate-700/50">
            <input 
              type="text" 
              placeholder="Cari chat..." 
              className="w-full bg-slate-900 border border-slate-700 p-2 text-sm text-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {loadingChats ? (
              <div className="p-5 text-center text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="animate-spin" /> Memuat obrolan...
              </div>
            ) : chats.length === 0 ? (
              <div className="p-5 text-center text-slate-500 text-sm">
                Tidak ada obrolan atau WhatsApp belum terhubung.
              </div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.id} 
                  onClick={() => loadChat(chat)}
                  className={`flex items-start gap-3 p-3 border-b border-slate-700/30 cursor-pointer transition ${selectedChat?.id === chat.id ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-slate-400">
                    <User size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-sm font-bold text-slate-200 truncate pr-2">{chat.name}</h3>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatTime(chat.timestamp)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs text-slate-400 truncate flex-1">
                        {chat.lastMessage ? (
                          <>
                            {chat.lastMessage.fromMe && <span className="text-blue-400 mr-1">✓</span>}
                            {chat.lastMessage.body}
                          </>
                        ) : 'Pesan media/sistem'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900 min-h-0 relative">
          {selectedChat ? (
            <>
              {/* Header */}
              <div className="p-3 bg-slate-800 border-b border-slate-700/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selectedChat.name}</h3>
                  <p className="text-xs text-slate-400">{selectedChat.id.replace('@c.us', '')}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                {loadingMessages ? (
                  <div className="flex-1 flex justify-center items-center text-slate-500">
                    <Loader2 className="animate-spin" size={30} />
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.fromMe;
                    return (
                      <div key={msg.id} className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                        <div className={`p-2.5 rounded-xl text-sm shadow-md ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-700 text-slate-100 rounded-tl-sm'}`}>
                          {msg.hasMedia && <MediaMessage msgId={msg.id} />}
                          {msg.body && <div className="whitespace-pre-wrap break-words">{msg.body}</div>}
                        </div>
                        <div className={`text-[10px] ${isMe ? 'text-slate-400' : 'text-slate-500'} mt-1 flex items-center gap-1`}>
                          {formatTime(msg.timestamp)} {isMe && getAckIcon(msg.ack)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              {hasPermission(sessionUser, PERMISSIONS.CHAT_LIVE) || isAdminRole(sessionUser) ? (
                <div className="p-3 bg-slate-800 border-t border-slate-700/50">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ketik pesan..." 
                      className="flex-1 bg-slate-900 border border-slate-700 p-3 text-sm text-slate-100 rounded-xl outline-none focus:border-emerald-500 transition"
                    />
                    <button 
                      type="submit" 
                      disabled={sending || !inputText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl flex items-center justify-center transition disabled:opacity-50"
                    >
                      {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-4 bg-slate-800 border-t border-slate-700/50 flex items-center justify-center text-slate-500 text-sm gap-2">
                  <ShieldAlert size={16} /> Anda tidak memiliki hak akses untuk membalas pesan.
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-500 p-10 text-center">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4 border-4 border-slate-700/50">
                <MessageCircle size={40} className="text-emerald-500/50" />
              </div>
              <h2 className="text-xl font-bold text-slate-400 mb-2">Live Chat NOCR</h2>
              <p className="text-sm">Pilih kontak di sebelah kiri untuk mulai membalas pesan.</p>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}
