import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Users,
  User,
  Lock,
  AlertCircle,
  MessageSquare,
  CheckCheck,
} from 'lucide-react';
import {
  fetchWhatsAppChats,
  fetchWhatsAppHistory,
  type WaChatSummary,
  type WaMessageRecord,
} from '../lib/whatsappClient';

interface WhatsAppChatListProps {
  userId: string;
  /** The owner's own WhatsApp number (digits, from session status). */
  ownerPhone: string | null;
  permissions: Record<string, boolean>;
  onClose: () => void;
  /** Enable a specific WhatsApp permission toggle (persists in settings). */
  onEnablePermission: (key: string) => void;
}

// ── Helpers ──

const AVATAR_COLORS = ['#0a7d6b', '#4b6fb5', '#9b59b6', '#c0843a', '#a14d57', '#3a8d9e', '#7a8b3a'];

function jidDigits(jid: string): string {
  return (jid.split('@')[0] || '').replace(/\D/g, '');
}

function formatPhone(digits: string): string {
  const clean = (digits || '').replace(/\D/g, '');
  return clean ? `+${clean}` : '';
}

function isJidLike(value: string): boolean {
  return /@/.test(value) || /^\+?\d[\d\s-]{4,}$/.test(value.trim());
}

function initialsFor(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed || isJidLike(trimmed)) return '';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function displayName(chat: WaChatSummary): string {
  if (chat.name && !isJidLike(chat.name)) return chat.name;
  const digits = jidDigits(chat.id);
  return digits ? formatPhone(digits) : chat.name || chat.id;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatListTime(ms: number): string {
  if (!ms) return '';
  const today = startOfDay(Date.now());
  const day = startOfDay(ms);
  const oneDay = 86_400_000;
  if (day === today) return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (day === today - oneDay) return 'Yesterday';
  return new Date(ms).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatBubbleTime(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDaySeparator(ms: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ms);
  const oneDay = 86_400_000;
  if (day === today) return 'Today';
  if (day === today - oneDay) return 'Yesterday';
  return new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function Avatar({ name, seed, isGroup, size = 49 }: { name: string; seed: string; isGroup: boolean; size?: number }) {
  const initials = initialsFor(name);
  const bg = avatarColor(seed || name || 'wa');
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold select-none"
      style={{ width: size, height: size, background: initials ? bg : '#2a3942', fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials ? initials : isGroup ? <Users style={{ width: size * 0.5, height: size * 0.5 }} /> : <User style={{ width: size * 0.5, height: size * 0.5 }} />}
    </div>
  );
}

// ── Permission / info gate card ──

function GateCard({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="text-center max-w-xs">
        <div className="w-14 h-14 rounded-full bg-[#202c33] flex items-center justify-center mx-auto mb-4 text-[#8696a0]">
          {icon}
        </div>
        <h3 className="text-[15px] font-semibold text-[#e9edef] mb-1.5">{title}</h3>
        <p className="text-[13px] text-[#8696a0] leading-relaxed mb-4">{body}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] text-[13px] font-semibold transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function WhatsAppChatList({ userId, ownerPhone, permissions, onClose, onEnablePermission }: WhatsAppChatListProps) {
  const [chats, setChats] = useState<WaChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [activeChat, setActiveChat] = useState<WaChatSummary | null>(null);
  const [messages, setMessages] = useState<WaMessageRecord[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgsError, setMsgsError] = useState<string | null>(null);

  const canReadChats = !!permissions.read_chats;
  const canReadHistory = !!permissions.view_message_history;

  const loadChats = useCallback(async () => {
    if (!canReadChats) return;
    setLoadingChats(true);
    setChatsError(null);
    try {
      const res = await fetchWhatsAppChats(userId, permissions, 40);
      if (res.ok) setChats(res.chats);
      else setChatsError(res.error || 'Failed to load chats');
    } catch (e: any) {
      setChatsError(e?.message || 'Failed to load chats');
    } finally {
      setLoadingChats(false);
    }
  }, [userId, permissions, canReadChats]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const openChat = useCallback(async (chat: WaChatSummary) => {
    setActiveChat(chat);
    setMessages([]);
    setMsgsError(null);
    if (!canReadHistory) return;
    setLoadingMsgs(true);
    try {
      const res = await fetchWhatsAppHistory(userId, chat.id, permissions, 50);
      if (res.ok) {
        // Backend returns newest-first; show chronological (oldest at top).
        setMessages([...res.messages].sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setMsgsError(res.error || 'Failed to load conversation');
      }
    } catch (e: any) {
      setMsgsError(e?.message || 'Failed to load conversation');
    } finally {
      setLoadingMsgs(false);
    }
  }, [userId, permissions, canReadHistory]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(c => displayName(c).toLowerCase().includes(q) || jidDigits(c.id).includes(q.replace(/\D/g, '')));
  }, [chats, search]);

  const ownerLabel = ownerPhone ? formatPhone(ownerPhone) : null;

  // ── Conversation thread view ──
  if (activeChat) {
    const name = displayName(activeChat);
    const numberLabel = activeChat.isGroup ? 'Group chat' : formatPhone(jidDigits(activeChat.id));
    let lastDay = 0;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex flex-col h-[100dvh] bg-[#0b141a]"
      >
        {/* Thread header */}
        <header className="shrink-0 flex items-center gap-3 px-2 sm:px-3 h-[60px] bg-[#202c33] border-b border-black/20">
          <button
            onClick={() => setActiveChat(null)}
            className="p-2 -ml-1 rounded-full text-[#aebac1] hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Back to chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar name={name} seed={activeChat.id} isGroup={activeChat.isGroup} size={40} />
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-medium text-[#e9edef] truncate leading-tight">{name}</span>
            <span className="text-[12px] text-[#8696a0] truncate">{numberLabel}</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-1.5" style={{ background: '#0b141a' }}>
          {!canReadHistory ? (
            <GateCard
              icon={<Lock className="w-6 h-6" />}
              title="Message history is off"
              body="Enable “View Message History” so Beatrice (and this view) can read past messages in this conversation."
              actionLabel="Enable View Message History"
              onAction={() => onEnablePermission('view_message_history')}
            />
          ) : loadingMsgs ? (
            <div className="flex-1 flex items-center justify-center pt-16">
              <RefreshCw className="w-5 h-5 text-[#8696a0] animate-spin" />
            </div>
          ) : msgsError ? (
            <GateCard icon={<AlertCircle className="w-6 h-6" />} title="Couldn’t load conversation" body={msgsError} actionLabel="Retry" onAction={() => openChat(activeChat)} />
          ) : messages.length === 0 ? (
            <GateCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="No messages yet"
              body="Recent messages sync from your phone as they arrive. Older history may not be available."
            />
          ) : (
            messages.map((m) => {
              const day = startOfDay(m.timestamp);
              const showDay = day !== lastDay;
              lastDay = day;
              const senderDigits = jidDigits(m.from);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex justify-center my-3">
                      <span className="px-3 py-1 rounded-lg bg-[#1d282f] text-[#8696a0] text-[11px] uppercase tracking-wide shadow-sm">
                        {formatDaySeparator(m.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[80%] sm:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm"
                      style={{ background: m.fromMe ? '#005c4b' : '#202c33' }}
                    >
                      {!m.fromMe && activeChat.isGroup && (
                        <span className="block text-[12px] font-medium mb-0.5" style={{ color: avatarColor(m.from) }}>
                          {senderDigits ? formatPhone(senderDigits) : 'Member'}
                        </span>
                      )}
                      <div className="flex items-end gap-2 flex-wrap">
                        <span className="text-[14px] text-[#e9edef] whitespace-pre-wrap break-words leading-snug">
                          {m.isMedia && !m.body ? '📎 Media' : m.body}
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-[#ffffff8c] shrink-0 translate-y-0.5">
                          {formatBubbleTime(m.timestamp)}
                          {m.fromMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: read-only notice (sending is via Beatrice / voice) */}
        <footer className="shrink-0 px-4 py-2.5 bg-[#202c33] border-t border-black/20 text-center">
          <p className="text-[11px] text-[#8696a0]">
            Read-only preview · Ask Beatrice to reply{numberLabel && !activeChat.isGroup ? ` (${numberLabel})` : ''}
          </p>
        </footer>
      </motion.div>
    );
  }

  // ── Chat list view ──
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col h-[100dvh] bg-[#111b21]"
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 h-[60px] bg-[#202c33]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="p-2 -ml-1 rounded-full text-[#aebac1] hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close WhatsApp chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-[16px] font-semibold text-[#e9edef] leading-tight">Chats</span>
            {ownerLabel && (
              <span className="text-[11px] text-[#8696a0] truncate">Your WhatsApp · {ownerLabel}</span>
            )}
          </div>
        </div>
        <button
          onClick={loadChats}
          disabled={loadingChats || !canReadChats}
          className="p-2 rounded-full text-[#aebac1] hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
          aria-label="Refresh chats"
          title="Refresh chats"
        >
          <RefreshCw className={`w-5 h-5 ${loadingChats ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Search */}
      {canReadChats && (
        <div className="shrink-0 px-3 py-2 bg-[#111b21]">
          <div className="flex items-center gap-3 bg-[#202c33] rounded-lg px-3 h-9">
            <Search className="w-4 h-4 text-[#8696a0] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="flex-1 bg-transparent text-[14px] text-[#e9edef] placeholder-[#8696a0] focus:outline-none min-w-0"
            />
          </div>
        </div>
      )}

      {/* Body */}
      {!canReadChats ? (
        <GateCard
          icon={<Lock className="w-6 h-6" />}
          title="Read Chats is off"
          body="Enable “Read Chats” so Beatrice can see your conversations and clearly tell who is who."
          actionLabel="Enable Read Chats"
          onAction={() => onEnablePermission('read_chats')}
        />
      ) : loadingChats && chats.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-[#8696a0] animate-spin" />
        </div>
      ) : chatsError ? (
        <GateCard icon={<AlertCircle className="w-6 h-6" />} title="Couldn’t load chats" body={chatsError} actionLabel="Retry" onAction={loadChats} />
      ) : filteredChats.length === 0 ? (
        <GateCard
          icon={<MessageSquare className="w-6 h-6" />}
          title={search ? 'No matches' : 'No conversations yet'}
          body={search ? 'Try a different name or number.' : 'Recent chats sync from your phone as messages arrive. Keep WhatsApp connected.'}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => {
            const name = displayName(chat);
            return (
              <button
                key={chat.id}
                onClick={() => openChat(chat)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#202c33] active:bg-[#202c33] transition-colors text-left cursor-pointer"
              >
                <Avatar name={name} seed={chat.id} isGroup={chat.isGroup} />
                <div className="flex-1 min-w-0 border-b border-[#222d34] pb-2.5 -mb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[16px] text-[#e9edef] truncate">{name}</span>
                    <span className={`text-[12px] shrink-0 ${chat.unreadCount > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                      {formatListTime(chat.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13px] text-[#8696a0] truncate">
                      {chat.isGroup && <Users className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />}
                      {chat.lastMessage || ' '}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#00a884] text-[#111b21] text-[11px] font-bold flex items-center justify-center">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          <div className="px-4 py-3 text-center">
            <p className="text-[11px] text-[#667781]">
              Showing recent conversations synced from your phone · names only (no profile photos)
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
