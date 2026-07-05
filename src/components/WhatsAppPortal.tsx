import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft, BarChart2, Bell, Camera, Check, CheckCheck, ChevronDown, CircleDashed, Compass,
  FileText, HelpCircle, Image, Info, Lock, LogOut, MessageSquareText, Mic, MoreVertical,
  Paperclip, Pen, Phone, Plus, Search, SendHorizontal, Settings, Smartphone, Smile,
  SquarePen, Users, Video, X,
} from 'lucide-react';
import {
  callWhatsAppTool,
  disconnectWhatsApp,
  getBackendUrl,
  getWhatsAppAdminOverview,
  startWhatsAppPairing,
} from '../lib/whatsappClient';

interface ChatItem { id: string; name: string; lastMessage: string; timestamp: number; unreadCount: number; isGroup: boolean; }
interface ContactItem { id: string; number: string; savedName: string; whatsappProfileName: string; verifiedName?: string; }
interface MessageItem { id: string; chatId: string; from: string; body: string; timestamp: number; fromMe: boolean; isGroup: boolean; isMedia: boolean; mediaMimeType?: string; mediaCaption?: string; }

interface WhatsAppPortalProps { user: User; onBack: () => void; onLogout: () => void; }

const LIMIT = 9999;

function fmt(ts: number): string {
  const d = new Date(ts); const n = new Date();
  if (n.getTime() - d.getTime() < 60000) return 'Now';
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const y = new Date(n); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtShort(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function dateSep(ts: number): string {
  const d = new Date(ts); const n = new Date();
  if (d.toDateString() === n.toDateString()) return 'Today';
  const y = new Date(n); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function init(name: string): string { return name?.trim().charAt(0).toUpperCase() || '?'; }
function avatarColor(id: string): string {
  const c = ['#00a884','#5b66a8','#6a9e5b','#d4a25c','#c97b5e','#a069c4','#5fb0b0','#c4628a'];
  let h = 0; for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return c[Math.abs(h) % c.length];
}
function profilePicUrl(uid: string, jid: string): string {
  return `${getBackendUrl()}/api/whatsapp/profile-pic/${encodeURIComponent(uid)}?jid=${encodeURIComponent(jid)}`;
}

export function WhatsAppPortal({ user, onBack, onLogout }: WhatsAppPortalProps) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [groups, setGroups] = useState<ChatItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [allMessages, setAllMessages] = useState<Record<string, MessageItem[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'groups'>('all');
  const [showSlide, setShowSlide] = useState(false);
  const [slideTitle, setSlideTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [waStatus, setWaStatus] = useState('not_found');
  const [waPhone, setWaPhone] = useState('');
  const [error, setError] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const mcRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allMessagesRef = useRef<Record<string, MessageItem[]>>({});

  const perms = { send_messages: true, read_chats: true, access_contacts: true, manage_contacts: true, access_groups: true, send_group_messages: true, read_group_chats: true, view_message_history: true };

  const contactName = (id: string) => {
    const c = contacts.find(c => c.id === id || c.number === id.split('@')[0]);
    return c ? (c.savedName || c.whatsappProfileName || c.number) : id.split('@')[0];
  };

  const activeChat = chats.find(c => c.id === activeChatId) || groups.find(g => g.id === activeChatId);

  const loadAll = useCallback(async (prefetchMessages = false) => {
    try {
      const [cr, cor, gr] = await Promise.all([
        callWhatsAppTool(user.uid, 'readChats', { limit: LIMIT }, perms),
        callWhatsAppTool(user.uid, 'getContacts', { limit: LIMIT }, perms),
        callWhatsAppTool(user.uid, 'getGroups', {}, perms),
      ]);
      if (cr?.ok) setChats(cr.chats || []);
      if (cor?.ok) setContacts(cor.contacts || []);
      if (gr?.ok) setGroups(gr.groups || []);
      if (prefetchMessages && cr?.ok && cr.chats.length > 0) {
        const results = await Promise.allSettled(
          cr.chats.map((chat: ChatItem) =>
            callWhatsAppTool(user.uid, 'getMessageHistory', { chatId: chat.id, limit: LIMIT }, perms)
              .then(r => ({ chatId: chat.id, messages: r?.ok ? r.messages || [] : [] }))
          )
        );
        const msgMap: Record<string, MessageItem[]> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') msgMap[r.value.chatId] = r.value.messages;
        }
        setAllMessages(prev => ({ ...prev, ...msgMap }));
        allMessagesRef.current = { ...allMessagesRef.current, ...msgMap };
      }
    } catch {}
  }, [user.uid]);

  const loadStatus = useCallback(async () => {
    try {
      const o = await getWhatsAppAdminOverview(user.uid);
      setWaStatus(o.status?.status || 'not_found');
      setWaPhone(o.status?.phone || '');
    } catch {}
  }, [user.uid]);

  useEffect(() => {
    (async () => {
      const o = await getWhatsAppAdminOverview(user.uid);
      setWaStatus(o.status?.status || 'not_found');
      setWaPhone(o.status?.phone || '');
      if (o.status?.status === 'paired') {
        const syncKey = `wa_full_synced_v2_${user.uid}`;
        const needsSync = !localStorage.getItem(syncKey);
        if (needsSync) {
          setSyncing(true);
          try {
            await callWhatsAppTool(user.uid, 'syncFullHistory', {}, perms);
          } catch {}
        }
        // Poll until data arrives (from fresh sync or existing data)
        for (let i = 0; i < 30; i++) {
          const check = await getWhatsAppAdminOverview(user.uid);
          if (check.chats?.length > 0) {
            if (needsSync) localStorage.setItem(syncKey, '1');
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        setSyncing(false);
      }
      await loadAll(true);
      setLoading(false);
    })();
  }, [loadAll, user.uid]);

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadAll();
      loadStatus();
      const cached = allMessagesRef.current[activeChatId || ''];
      if (cached) setMessages(cached);
    }, 10000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [user.uid, loadAll, loadStatus, activeChatId]);

  useEffect(() => { if (mcRef.current) mcRef.current.scrollTop = mcRef.current.scrollHeight; }, [messages]);

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    if (window.innerWidth < 768) { document.getElementById('leftP')?.classList.add('hidden'); document.getElementById('rightP')?.classList.remove('hidden'); }
    const cached = allMessagesRef.current[chatId];
    if (cached) setMessages(cached);
  };

  const closeChat = (e?: any) => { e?.stopPropagation?.(); setActiveChatId(null); setMessages([]); if (window.innerWidth < 768) { document.getElementById('leftP')?.classList.remove('hidden'); document.getElementById('rightP')?.classList.add('hidden'); } };

  const sendMsg = async () => {
    const t = messageInput.trim(); if (!t || !activeChatId) return;
    setMessageInput('');
    const tmpId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tmpId, chatId: activeChatId, from: '', body: t, timestamp: Date.now(), fromMe: true, isGroup: !!activeChat?.isGroup, isMedia: false }]);
    try {
      const isG = activeChat?.isGroup;
      const r = await callWhatsAppTool(user.uid, isG ? 'sendGroupMessage' : 'sendMessage', { to: activeChatId, groupId: isG ? activeChatId : undefined, text: t }, perms);
      if (!r?.ok) setMessages(prev => prev.map(m => m.id === tmpId ? { ...m, body: `${t} (failed)` } : m));
    } catch { setMessages(prev => prev.map(m => m.id === tmpId ? { ...m, body: `${t} (failed)` } : m)); }
    if (inputRef.current) inputRef.current.style.height = '40px';
  };

  const syncFull = async () => {
    setSyncing(true); setError('');
    try {
      await callWhatsAppTool(user.uid, 'syncFullHistory', {}, perms);
      setTimeout(async () => { await loadAll(); setSyncing(false); }, 5000);
    } catch (err: any) { setError(err.message); setSyncing(false); }
  };

  const handlePair = async () => {
    try { await startWhatsAppPairing(user.uid); } catch {}
  };

  const handleDisconnect = async () => {
    try { await disconnectWhatsApp(user.uid); setWaStatus('not_found'); setWaPhone(''); setChats([]); setContacts([]); setGroups([]); setActiveChatId(null); setMessages([]); } catch {}
  };

  const mediaUrl = (msg: MessageItem) => `${getBackendUrl()}/api/whatsapp/media/${encodeURIComponent(user.uid)}/${encodeURIComponent(msg.chatId)}/${encodeURIComponent(msg.id)}`;

  const filteredChats = chats.filter(c => { if (filterMode === 'unread' && c.unreadCount === 0) return false; return c.name.toLowerCase().includes(searchQuery.toLowerCase()); }).sort((a, b) => b.timestamp - a.timestamp);
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredContacts = contacts.filter(c => (c.savedName || c.whatsappProfileName || c.number).toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  const showPanel = (title: string) => { setSlideTitle(title); setShowSlide(true); };

  const avatar = (jid: string, name: string, size = 48) => (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full flex items-center justify-center font-semibold overflow-hidden" style={{ backgroundColor: avatarColor(jid), fontSize: size * 0.4 }}>
        {init(name)}
      </div>
      <img src={profilePicUrl(user.uid, jid)} alt="" className="absolute inset-0 w-full h-full rounded-full object-cover z-10" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
    </div>
  );

  const msgStatus = (m: MessageItem) => m.fromMe && <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb] ml-1 inline" />;

  if (loading) return <div className="min-h-[100dvh] bg-[#111b21] text-[#e9edef] flex flex-col items-center justify-center gap-4"><div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" /><span className="text-sm text-[#8696a0]">{syncing ? 'Syncing all WhatsApp data...' : 'Loading...'}</span></div>;

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#111b21] text-[#e9edef] flex select-none" onClick={() => { document.getElementById('mainDrop')?.classList.add('hidden'); document.getElementById('chatDrop')?.classList.add('hidden'); document.getElementById('attachMenu')?.classList.add('hidden'); }}>

      {/* ── LEFT NAV ── */}
      <nav className="hidden md:flex w-[64px] bg-[#202c33] border-r border-[#222d34] flex-col justify-between items-center py-4 flex-shrink-0 z-20">
        <div className="flex flex-col gap-6 items-center w-full">
          <div className="relative group"><button className="text-[#e9edef] p-3 bg-[#2a3942] rounded-xl"><MessageSquareText className="w-6 h-6 fill-[#e9edef]/20" /></button><div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-500 absolute left-14 top-2 bg-[#e9edef] text-[#111b21] text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md z-50">Chats</div></div>
          <div className="relative group"><button className="text-[#8696a0] hover:text-[#e9edef] p-2" onClick={() => showPanel('Status')}><CircleDashed className="w-6 h-6" /></button><div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-500 absolute left-12 top-1 bg-[#e9edef] text-[#111b21] text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md z-50">Status</div></div>
          <div className="relative group"><button className="text-[#8696a0] hover:text-[#e9edef] p-2" onClick={() => showPanel('Channels')}><Compass className="w-6 h-6" /></button><div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-500 absolute left-12 top-1 bg-[#e9edef] text-[#111b21] text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md z-50">Channels</div></div>
          <div className="relative group"><button className="text-[#8696a0] hover:text-[#e9edef] p-2" onClick={() => showPanel('Communities')}><Users className="w-6 h-6" /></button><div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-500 absolute left-12 top-1 bg-[#e9edef] text-[#111b21] text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md z-50">Communities</div></div>
        </div>
        <div className="flex flex-col gap-6 items-center w-full">
          <div className="relative group"><button className="text-[#8696a0] hover:text-[#e9edef] p-2" onClick={() => showPanel('Settings')}><Settings className="w-6 h-6" /></button><div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-500 absolute left-12 top-1 bg-[#e9edef] text-[#111b21] text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md z-50">Settings</div></div>
          <div className="relative group">
            {avatar(user.uid, user.email || 'U', 32)}
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-500 absolute left-12 top-1 bg-[#e9edef] text-[#111b21] text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md z-50">Profile</div>
          </div>
        </div>
      </nav>

      {/* ── LEFT PANEL ── */}
      <div id="leftP" className="w-full md:w-[380px] lg:w-[420px] bg-[#111b21] border-r border-[#222d34] flex flex-col flex-shrink-0 h-full relative overflow-hidden">
        
        {/* Slide-over panel */}
        <div id="slideP" className={`absolute inset-0 bg-[#111b21] z-40 flex flex-col transition-transform duration-300 ${showSlide ? '' : '-translate-x-full'}`}>
          <div className="h-[108px] bg-[#202c33] flex items-end px-6 pb-4 gap-6 flex-shrink-0">
            <button onClick={() => setShowSlide(false)} className="mb-1"><ArrowLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-medium">{slideTitle}</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            {slideTitle === 'Settings' ? (
              <div className="w-full space-y-2">
                <div className="flex items-center gap-4 p-4 border-b border-[#222d34]"><Smartphone className="w-5 h-5 text-[#8696a0]" /><span className="text-sm">{waStatus === 'paired' ? `Connected (${waPhone})` : waStatus.replace(/_/g, ' ')}</span></div>
                {waStatus !== 'paired' && <button onClick={handlePair} className="w-full bg-[#00a884] text-black font-semibold rounded-lg py-3 text-sm mt-2">Pair WhatsApp</button>}
                {waStatus === 'paired' && <button onClick={handleDisconnect} className="w-full bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg py-3 text-sm">Disconnect</button>}
                <button onClick={syncFull} disabled={syncing} className="w-full bg-[#00a884] text-black font-semibold rounded-lg py-3 text-sm disabled:opacity-50">{syncing ? 'Syncing...' : 'Full Sync'}</button>
                <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg py-3 text-sm mt-4"><LogOut className="w-4 h-4" /> Sign Out</button>
                <button onClick={onBack} className="w-full flex items-center justify-center gap-2 bg-[#202c33] rounded-lg py-3 text-sm"><ArrowLeft className="w-4 h-4" /> Back to Assistant</button>
                {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mt-2">{error}</div>}
              </div>
            ) : (
              <div className="mt-20 text-[#8696a0] text-center flex flex-col items-center gap-3"><Info className="w-12 h-12 opacity-50" /><span className="text-sm">{slideTitle}</span></div>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-semibold">Chats</h1>
          <div className="flex gap-4 text-[#8696a0]">
            <button className="hover:text-[#e9edef]"><Camera className="w-5 h-5" /></button>
            <button className="hover:text-[#e9edef]"><SquarePen className="w-5 h-5" /></button>
            <div className="relative">
              <button className="hover:text-[#e9edef] p-1 rounded-full focus:bg-[#2a3942]" onClick={e => { e.stopPropagation(); document.getElementById('mainDrop')?.classList.toggle('hidden'); }}>
                <MoreVertical className="w-5 h-5" />
              </button>
              <div id="mainDrop" className="hidden absolute right-0 top-10 w-48 bg-[#233138] shadow-lg rounded-lg py-2 z-50 text-[15px]">
                <div className="text-[#e9edef]">
                  <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer">New group</div>
                  <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer">Starred messages</div>
                  <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer" onClick={() => showPanel('Settings')}>Settings</div>
                  <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer" onClick={onLogout}>Log out</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="p-3 border-b border-[#222d34] flex flex-col gap-3 flex-shrink-0">
          <div className="bg-[#202c33] rounded-lg flex items-center px-4 py-1.5 gap-4">
            <Search className="w-4 h-4 text-[#8696a0]" />
            <input type="text" placeholder="Search or start a new chat" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent text-sm w-full outline-none text-[#e9edef] placeholder-[#8696a0] h-6" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[#8696a0] hover:text-[#e9edef]"><X className="w-4 h-4" /></button>}
          </div>
          {!searchQuery && <div className="flex gap-2">
            {(['all', 'unread', 'groups'] as const).map(f => (
              <button key={f} onClick={() => setFilterMode(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filterMode === f ? 'bg-[#2a3942] text-[#00a884]' : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'all' ? ` (${chats.length})` : f === 'unread' ? ` (${chats.filter(c => c.unreadCount > 0).length})` : ` (${groups.length})`}
              </button>
            ))}
          </div>}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#8696a0] text-sm">Loading...</div>
          ) : (!searchQuery && filterMode !== 'groups') && filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#8696a0] text-sm gap-3">
              <MessageSquareText className="w-12 h-12 opacity-30" />
              {waStatus === 'paired' ? 'No chats yet. Use Full Sync to load all data.' : 'Pair WhatsApp to see your chats.'}
            </div>
          ) : (filterMode === 'groups' || searchQuery) && filteredGroups.length > 0 ? (
            filteredGroups.map(g => (
              <div key={g.id} onClick={() => selectChat(g.id)} className={`flex items-center gap-3 px-3 h-[72px] cursor-pointer transition hover:bg-[#2a3942] ${activeChatId === g.id ? 'bg-[#2a3942]' : ''}`}>
                <div className="w-[48px] h-[48px] rounded-full bg-[#2a3942] flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-[#00a884]" /></div>
                <div className="flex-1 min-w-0 border-b border-[#222d34] h-full flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-baseline mb-0.5"><h4 className="text-[17px] truncate">{g.name}</h4><span className="text-xs text-[#8696a0] ml-2">{fmt(g.timestamp)}</span></div>
                  <p className="text-sm text-[#8696a0] truncate">Group</p>
                </div>
              </div>
            ))
          ) : (searchQuery && filterMode !== 'groups') && filteredContacts.length > 0 ? (
            filteredContacts.map(c => (
              <div key={c.id} onClick={() => selectChat(c.id)} className={`flex items-center gap-3 px-3 h-[72px] cursor-pointer transition hover:bg-[#2a3942] ${activeChatId === c.id ? 'bg-[#2a3942]' : ''}`}>
                {avatar(c.id, c.savedName || c.whatsappProfileName || '?', 48)}
                <div className="flex-1 min-w-0 border-b border-[#222d34] h-full flex flex-col justify-center pr-2">
                  <h4 className="text-[17px] truncate">{c.savedName || c.whatsappProfileName || c.number}</h4>
                  <p className="text-sm text-[#8696a0] truncate">{c.number}{c.whatsappProfileName ? ` ~ ${c.whatsappProfileName}` : ''}</p>
                </div>
              </div>
            ))
          ) : filteredChats.length > 0 && filteredChats.map(chat => {
            const lastMsg = chat.lastMessage;
            return (
              <div key={chat.id} onClick={() => selectChat(chat.id)} className={`flex items-center gap-3 px-3 h-[72px] cursor-pointer transition hover:bg-[#2a3942] ${activeChatId === chat.id ? 'bg-[#2a3942]' : ''}`}>
                {avatar(chat.id, chat.name, 48)}
                <div className={`flex-1 min-w-0 h-full flex flex-col justify-center pr-2 ${activeChatId === chat.id ? '' : 'border-b border-[#222d34]'}`}>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="text-[17px] truncate">{chat.name}</h4>
                    <span className={`text-xs ml-2 ${chat.unreadCount > 0 ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}`}>{fmt(chat.timestamp)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-[#8696a0]">
                    <p className="truncate flex-1"><span className="truncate">{lastMsg}</span></p>
                    {chat.unreadCount > 0 && <div className="bg-[#00a884] text-[#111b21] text-[11px] w-[22px] h-[22px] flex items-center justify-center rounded-full font-bold ml-2 flex-shrink-0">{chat.unreadCount}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div id="rightP" className="hidden md:flex flex-1 flex-col bg-[#0b141a] relative h-full">
        {!activeChatId ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202c33] px-8 border-l border-[#222d34]">
            <div className="max-w-md flex flex-col items-center text-center">
              <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669aeRcpe.png" alt="" className="w-[300px] mb-8 opacity-80" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
              <h2 className="text-3xl font-light mb-4">WhatsApp for Web</h2>
              <p className="text-sm text-[#8696a0] leading-relaxed mb-10">Send and receive messages without keeping your phone online.</p>
              <div className="flex items-center gap-1.5 text-xs text-[#8696a0] absolute bottom-10"><Lock className="w-3.5 h-3.5" /> End-to-end encrypted</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full relative">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: `url('https://static.whatsapp.net/rsrc.php/v3/yl/r/r_QZ3OA1N5i.png')`, backgroundRepeat: 'repeat' }} />

            {/* Chat header */}
            <div className="h-[60px] bg-[#202c33] px-4 border-b border-[#222d34] flex items-center justify-between z-10 flex-shrink-0 cursor-pointer hover:bg-[#2a3942]">
              <div className="flex items-center gap-3 w-full" onClick={() => showPanel('Contact Info')}>
                <button className="md:hidden mr-1" onClick={closeChat}><ArrowLeft className="w-6 h-6" /></button>
                {avatar(activeChatId, activeChat?.name || '?', 40)}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[15px] truncate">{activeChat?.name || 'Unknown'}</h3>
                  <span className="text-[13px] text-[#8696a0] truncate block">{activeChat?.isGroup ? 'Group' : contactName(activeChatId)}</span>
                </div>
              </div>
              <div className="flex gap-4 text-[#8696a0] items-center ml-4">
                <button className="hover:text-[#e9edef] p-2 hidden sm:block"><Video className="w-5 h-5" /></button>
                <button className="hover:text-[#e9edef] p-2 hidden sm:block"><Phone className="w-5 h-5" /></button>
                <div className="w-[1px] h-6 bg-[#222d34] hidden sm:block mx-1" />
                <button className="hover:text-[#e9edef] p-2"><Search className="w-5 h-5" /></button>
                <div className="relative">
                  <button className="hover:text-[#e9edef] p-2 rounded-full focus:bg-[#2a3942]" onClick={e => { e.stopPropagation(); document.getElementById('chatDrop')?.classList.toggle('hidden'); }}>
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  <div id="chatDrop" className="hidden absolute right-0 top-12 w-52 bg-[#233138] shadow-lg rounded-lg py-2 z-50 text-[15px]">
                    <div className="text-[#e9edef]">
                      <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer" onClick={() => showPanel('Contact Info')}>Contact info</div>
                      <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer">Select messages</div>
                      <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer" onClick={closeChat}>Close chat</div>
                      <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer">Mute notifications</div>
                      <div className="px-5 py-2.5 hover:bg-[#2a3942] cursor-pointer">Clear chat</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={mcRef} className="flex-1 overflow-y-auto px-[5%] py-4 flex flex-col z-10">
              {sortedMessages.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-[#8696a0] text-sm">No messages yet. Send a message to start.</div>
              )}
              {sortedMessages.map((msg, i) => {
                const prev = i > 0 ? sortedMessages[i - 1] : null;
                const showDate = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                const sameSender = prev && prev.fromMe === msg.fromMe && !showDate;
                const showSender = msg.isGroup && !msg.fromMe && (!prev || prev.from !== msg.from || showDate);
                const isImg = msg.isMedia && msg.mediaMimeType?.startsWith('image/') && !msg.mediaMimeType?.startsWith('image/webp');
                const isVid = msg.isMedia && msg.mediaMimeType?.startsWith('video/');
                const isAud = msg.isMedia && msg.mediaMimeType?.startsWith('audio/');
                const isSticker = msg.mediaMimeType === 'image/webp';
                const medUrl = mediaUrl(msg);
                return (
                  <div key={msg.id}>
                    {showDate && <div className="flex justify-center my-3"><div className="bg-[#182229] text-[#8696a0] px-3 py-1 rounded-lg text-xs shadow-sm uppercase font-medium">{dateSep(msg.timestamp)}</div></div>}
                    <div className={`max-w-[75%] md:max-w-[65%] px-3 py-1.5 shadow-sm text-[15px] relative rounded-lg ${sameSender ? 'mt-0.5' : 'mt-[6px]'} ${
                      msg.fromMe ? 'self-end bg-[#005c4b] rounded-tr-none' : 'self-start bg-[#202c33] rounded-tl-none'
                    }`}>
                      <div className="absolute right-1 top-1 bg-[#202c33] p-0.5 rounded shadow hidden group-hover:block z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronDown className="w-4 h-4 text-[#8696a0]" />
                      </div>
                      {showSender && <div className="text-[13px] font-medium mb-0.5 text-[#00a884]">{(() => { const c = contacts.find(c => c.id === msg.from || c.number === msg.from.split('@')[0]); return c?.savedName || c?.whatsappProfileName || msg.from.split('@')[0]; })()}</div>}
                      <div className="flex flex-col gap-1">
                        {isImg && <img src={medUrl} alt="" className="max-w-full rounded-lg cursor-pointer" onClick={() => window.open(medUrl, '_blank')} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />}
                        {isVid && <video src={medUrl} controls className="max-w-full rounded-lg" style={{ maxHeight: 300 }} />}
                        {isAud && <audio src={medUrl} controls className="w-full" />}
                        {isSticker && <img src={medUrl} alt="sticker" className="max-w-[128px]" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />}
                        {msg.isMedia && !msg.mediaMimeType && <span className="text-[#8696a0] italic text-sm">{msg.body}</span>}
                        {!msg.isMedia && <span className="leading-snug break-words whitespace-pre-wrap">{msg.body}</span>}
                        {msg.mediaCaption && <span className="text-sm leading-snug break-words">{msg.mediaCaption}</span>}
                        <div className="flex items-center justify-end gap-1 text-[11px] text-[#8696a0] mt-1">
                          {fmtShort(msg.timestamp)}
                          {msgStatus(msg)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="min-h-[62px] bg-[#202c33] px-4 py-2 flex items-end gap-3 z-10 relative">
              <div id="attachMenu" className="hidden absolute bottom-16 left-12 w-48 bg-[#233138] shadow-lg rounded-2xl py-3 z-50 text-[14px]">
                <div className="text-[#e9edef] flex flex-col gap-1 px-2">
                  <div className="px-3 py-2 hover:bg-[#2a3942] rounded-lg cursor-pointer flex items-center gap-3"><div className="bg-indigo-500 rounded-full w-8 h-8 flex items-center justify-center"><FileText className="w-4 h-4 text-white" /></div> Document</div>
                  <div className="px-3 py-2 hover:bg-[#2a3942] rounded-lg cursor-pointer flex items-center gap-3"><div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center"><Image className="w-4 h-4 text-white" /></div> Photos & videos</div>
                  <div className="px-3 py-2 hover:bg-[#2a3942] rounded-lg cursor-pointer flex items-center gap-3"><div className="bg-rose-500 rounded-full w-8 h-8 flex items-center justify-center"><Camera className="w-4 h-4 text-white" /></div> Camera</div>
                  <div className="px-3 py-2 hover:bg-[#2a3942] rounded-lg cursor-pointer flex items-center gap-3"><div className="bg-teal-500 rounded-full w-8 h-8 flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div> Contact</div>
                  <div className="px-3 py-2 hover:bg-[#2a3942] rounded-lg cursor-pointer flex items-center gap-3"><div className="bg-yellow-500 rounded-full w-8 h-8 flex items-center justify-center"><BarChart2 className="w-4 h-4 text-white" /></div> Poll</div>
                </div>
              </div>
              <div className="flex gap-2 text-[#8696a0] mb-2">
                <button className="hover:text-[#e9edef] p-1"><Smile className="w-6 h-6" /></button>
                <button className="hover:text-[#e9edef] p-1 rounded-full focus:bg-[#2a3942]" onClick={e => { e.stopPropagation(); document.getElementById('attachMenu')?.classList.toggle('hidden'); }}><Plus className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 bg-[#202c33] rounded-lg flex items-end min-h-[40px] max-h-[120px] overflow-hidden border border-[#222d34]">
                <textarea ref={inputRef} placeholder="Type a message" value={messageInput} onChange={e => { setMessageInput(e.target.value); e.target.style.height = '40px'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  className="w-full bg-transparent outline-none text-[15px] text-[#e9edef] placeholder-[#8696a0] px-4 py-2.5 resize-none max-h-[120px] overflow-y-auto" rows={1} />
              </div>
              <div className="mb-2 flex items-center justify-center">
                {messageInput.trim() ? (
                  <button onClick={sendMsg} className="text-[#00a884] hover:text-[#06cf9c] p-1"><SendHorizontal className="w-6 h-6" /></button>
                ) : (
                  <button className="text-[#8696a0] hover:text-[#e9edef] p-1"><Mic className="w-6 h-6" /></button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
