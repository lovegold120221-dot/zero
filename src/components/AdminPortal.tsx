import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import {
  disconnectWhatsApp,
  getBackendUrl,
  getWhatsAppAdminOverview,
  saveWhatsAppAdminConfig,
  sendWhatsAppTestMessage,
  setBackendUrl,
  startWhatsAppPairing,
} from '../lib/whatsappClient';
import { supabase } from '../lib/supabase';

type PermissionKey =
  | 'send_messages'
  | 'read_chats'
  | 'access_contacts'
  | 'manage_contacts'
  | 'access_groups'
  | 'send_group_messages'
  | 'read_group_chats'
  | 'view_message_history';

type Provider = 'linked_device' | 'cloud_api';

const permissionOptions: { key: PermissionKey; label: string; note: string }[] = [
  { key: 'send_messages', label: 'Send messages', note: 'Allows Beatrice to send direct WhatsApp messages.' },
  { key: 'read_chats', label: 'Read chats', note: 'Allows chat summaries and recent direct messages.' },
  { key: 'access_contacts', label: 'Access contacts', note: 'Allows Beatrice to list known WhatsApp contacts.' },
  { key: 'manage_contacts', label: 'Manage contacts', note: 'Reserved for contact workflows that WhatsApp exposes reliably.' },
  { key: 'access_groups', label: 'Access groups', note: 'Allows group listing from linked-device sessions.' },
  { key: 'send_group_messages', label: 'Send group messages', note: 'Allows Beatrice to send to group JIDs.' },
  { key: 'read_group_chats', label: 'Read group chats', note: 'Allows recent group-message history.' },
  { key: 'view_message_history', label: 'View history', note: 'Allows message lookup by chat ID.' },
];

const emptyPermissions = permissionOptions.reduce((acc, item) => {
  acc[item.key] = true;
  return acc;
}, {} as Record<PermissionKey, boolean>);

interface AdminPortalProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
}

export function AdminPortal({ user, onBack, onLogout }: AdminPortalProps) {
  const [backendInput, setBackendInput] = useState(getBackendUrl());
  const [provider, setProvider] = useState<Provider>('linked_device');
  const [displayName, setDisplayName] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [apiVersion, setApiVersion] = useState('v23.0');
  const [defaultCountryCode, setDefaultCountryCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [hasAppSecret, setHasAppSecret] = useState(false);
  const [hasWebhookVerifyToken, setHasWebhookVerifyToken] = useState(false);
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(emptyPermissions);
  const [waStatus, setWaStatus] = useState('not_found');
  const [waPhone, setWaPhone] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [contactsCount, setContactsCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testText, setTestText] = useState('Beatrice WhatsApp test message.');
  const [testing, setTesting] = useState(false);

  const webhookUrl = useMemo(() => {
    return `${backendInput.replace(/\/+$/, '')}/api/whatsapp/webhook/${encodeURIComponent(user.uid)}`;
  }, [backendInput, user.uid]);

  const enabledCount = useMemo(() => {
    return permissionOptions.filter(item => permissions[item.key]).length;
  }, [permissions]);

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const overview = await getWhatsAppAdminOverview(user.uid);
      const config = overview.config || {};
      setProvider(config.provider || 'linked_device');
      setDisplayName(config.displayName || '');
      setBusinessAccountId(config.businessAccountId || '');
      setPhoneNumberId(config.phoneNumberId || '');
      setApiVersion(config.apiVersion || 'v23.0');
      setDefaultCountryCode(config.defaultCountryCode || '');
      setHasAccessToken(!!config.hasAccessToken);
      setHasAppSecret(!!config.hasAppSecret);
      setHasWebhookVerifyToken(!!config.hasWebhookVerifyToken);
      setPermissions({ ...emptyPermissions, ...(config.permissions || {}) });
      setWaStatus(overview.status?.status || 'not_found');
      setWaPhone(overview.status?.phone || '');
      setQrCode(overview.status?.qrCode || '');
      setMessages(overview.messages || []);
      setChats(overview.chats || []);
      setContactsCount(overview.contactsCount || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin portal');
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const saveConfig = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const backend = setBackendUrl(backendInput);
      setBackendInput(backend);
      const saved = await saveWhatsAppAdminConfig(user.uid, {
        provider,
        displayName,
        businessAccountId,
        phoneNumberId,
        apiVersion,
        defaultCountryCode,
        accessToken,
        appSecret,
        webhookVerifyToken,
        permissions,
      });
      const config = saved.config || {};
      setHasAccessToken(!!config.hasAccessToken);
      setHasAppSecret(!!config.hasAppSecret);
      setHasWebhookVerifyToken(!!config.hasWebhookVerifyToken);
      setAccessToken('');
      setAppSecret('');
      setWebhookVerifyToken('');
      await supabase.from('user_settings').upsert({
        user_id: user.uid,
        whatsapp_permissions: permissions,
        whatsapp_paired: waStatus === 'paired' || (provider === 'cloud_api' && !!config.hasAccessToken && !!phoneNumberId),
        whatsapp_phone: waPhone || phoneNumberId || null,
        updated_at: new Date().toISOString(),
      });
      setNotice('WhatsApp admin settings saved.');
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to save WhatsApp settings');
    } finally {
      setSaving(false);
    }
  };

  const pairLinkedDevice = async () => {
    setPairing(true);
    setError('');
    setNotice('');
    try {
      setBackendUrl(backendInput);
      await startWhatsAppPairing(user.uid);
      setNotice('Pairing started. Scan the QR code when it appears.');
      await loadOverview();
      const started = Date.now();
      const timer = window.setInterval(async () => {
        const overview = await getWhatsAppAdminOverview(user.uid);
        const status = overview.status?.status || 'not_found';
        setWaStatus(status);
        setWaPhone(overview.status?.phone || '');
        setQrCode(overview.status?.qrCode || '');
        setMessages(overview.messages || []);
        setChats(overview.chats || []);
        setContactsCount(overview.contactsCount || 0);
        if (Date.now() - started > 120_000 || status === 'paired' || status === 'disconnected' || overview.status?.error) {
          window.clearInterval(timer);
          setPairing(false);
        }
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to start WhatsApp pairing');
      setPairing(false);
    }
  };

  const disconnect = async () => {
    setError('');
    setNotice('');
    try {
      await disconnectWhatsApp(user.uid);
      setWaStatus('not_found');
      setWaPhone('');
      setQrCode('');
      setNotice('Linked-device session disconnected.');
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect WhatsApp');
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError('');
    setNotice('');
    try {
      const result = await sendWhatsAppTestMessage(user.uid, testTo, testText);
      if (!result.ok) throw new Error(result.error || 'WhatsApp test failed');
      setNotice(`Test message sent${result.messageId ? ` (${result.messageId})` : ''}.`);
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0908] text-zinc-100">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(208,167,139,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_34%)]" />
      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b lg:border-b-0 lg:border-r border-white/10 bg-black/25 backdrop-blur-xl p-5 lg:min-h-screen">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#d0a78b]/60">Beatrice</p>
              <h1 className="text-2xl font-semibold tracking-tight">Admin Portal</h1>
            </div>
            <button onClick={onBack} className="lg:hidden p-2 rounded-lg bg-white/5 border border-white/10" aria-label="Back to assistant">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <nav className="mt-8 grid gap-2 text-sm">
            {[
              ['Dashboard', Activity],
              ['WhatsApp', Smartphone],
              ['Permissions', ShieldCheck],
              ['Messages', MessageSquare],
            ].map(([label, Icon]) => (
              <a key={String(label)} href={`#${String(label).toLowerCase()}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                <Icon className="w-4 h-4 text-[#d0a78b]" />
                {String(label)}
              </a>
            ))}
          </nav>

          <div className="mt-8 hidden lg:grid gap-3">
            <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Assistant
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-sm text-red-200">
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="p-4 sm:p-6 lg:p-8 space-y-6">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{user.email}</p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Operations dashboard</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={loadOverview} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button onClick={saveConfig} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d0a78b] text-black font-semibold hover:bg-[#ebd0bc] disabled:opacity-60 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </header>

          {(error || notice) && (
            <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}>
              {error ? <X className="w-4 h-4 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{error || notice}</span>
            </div>
          )}

          <section id="dashboard" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ['Status', waStatus === 'paired' ? 'Linked' : provider === 'cloud_api' && hasAccessToken ? 'Cloud ready' : waStatus.replace(/_/g, ' ')],
              ['Permissions', `${enabledCount}/8 enabled`],
              ['Chats', String(chats.length)],
              ['Contacts', String(contactsCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</p>
                <p className="mt-2 text-xl font-semibold capitalize">{value}</p>
              </div>
            ))}
          </section>

          <section id="whatsapp" className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-[#d0a78b]" />
                <div>
                  <h3 className="text-lg font-semibold">WhatsApp credentials</h3>
                  <p className="text-xs text-zinc-500">Server-side storage per Firebase user. Secret fields are never returned to the browser.</p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">Backend API URL</span>
                  <input value={backendInput} onChange={e => setBackendInput(e.target.value)} className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                </label>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/25 border border-white/10 p-1">
                  <button onClick={() => setProvider('linked_device')} className={`rounded-lg px-3 py-2 text-sm ${provider === 'linked_device' ? 'bg-[#d0a78b] text-black font-semibold' : 'text-zinc-400 hover:bg-white/5'}`}>
                    Linked Device
                  </button>
                  <button onClick={() => setProvider('cloud_api')} className={`rounded-lg px-3 py-2 text-sm ${provider === 'cloud_api' ? 'bg-[#d0a78b] text-black font-semibold' : 'text-zinc-400 hover:bg-white/5'}`}>
                    Cloud API
                  </button>
                </div>

                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">Connection label</span>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Master E WhatsApp" className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                </label>

                {provider === 'cloud_api' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Phone Number ID</span>
                      <input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Business Account ID</span>
                      <input value={businessAccountId} onChange={e => setBusinessAccountId(e.target.value)} className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Access Token {hasAccessToken ? '(saved)' : ''}</span>
                      <input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder={hasAccessToken ? 'Leave blank to keep saved token' : 'Permanent or system-user token'} type="password" className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">App Secret {hasAppSecret ? '(saved)' : ''}</span>
                      <input value={appSecret} onChange={e => setAppSecret(e.target.value)} placeholder="Optional" type="password" className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Webhook Verify Token {hasWebhookVerifyToken ? '(saved)' : ''}</span>
                      <input value={webhookVerifyToken} onChange={e => setWebhookVerifyToken(e.target.value)} placeholder={hasWebhookVerifyToken ? 'Leave blank to keep saved token' : 'Choose a private verify token'} type="password" className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">API Version</span>
                      <input value={apiVersion} onChange={e => setApiVersion(e.target.value)} placeholder="v23.0" className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Default Country Code</span>
                      <input value={defaultCountryCode} onChange={e => setDefaultCountryCode(e.target.value)} placeholder="32, 1, 44..." className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                    </label>
                    <div className="md:col-span-2 rounded-xl bg-black/25 border border-white/10 p-3">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Webhook URL</p>
                      <p className="text-xs text-zinc-300 break-all">{webhookUrl}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Linked-device session</h3>
                  <p className="text-xs text-zinc-500">Best for personal WhatsApp tasks, reads, contacts, and groups.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${waStatus === 'paired' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {waStatus}
                </span>
              </div>

              {qrCode ? (
                <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/25 p-4">
                  <img src={qrCode} alt="WhatsApp pairing QR" className="w-60 h-60 rounded-2xl bg-white p-3" />
                  <p className="mt-3 text-xs text-zinc-500 text-center">Open WhatsApp, go to Linked Devices, then scan this QR code.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm text-zinc-300">{waStatus === 'paired' ? `Connected${waPhone ? ` to ${waPhone}` : ''}.` : 'No active linked-device session.'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={pairLinkedDevice} disabled={pairing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d0a78b] text-black px-4 py-3 font-semibold hover:bg-[#ebd0bc] disabled:opacity-60">
                  {pairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                  Pair
                </button>
                <button onClick={disconnect} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-red-500/10 hover:border-red-500/30">
                  <X className="w-4 h-4" />
                  Disconnect
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Send test</p>
                <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="Recipient number with country code" className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60" />
                <textarea value={testText} onChange={e => setTestText(e.target.value)} className="w-full min-h-20 rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#d0a78b]/60 resize-none" />
                <button onClick={sendTest} disabled={testing || !testTo || !testText} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-3 hover:bg-white/15 disabled:opacity-50">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Test
                </button>
              </div>
            </div>
          </section>

          <section id="permissions" className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-[#d0a78b]" />
              <div>
                <h3 className="text-lg font-semibold">Delegated permissions</h3>
                <p className="text-xs text-zinc-500">These server-side toggles decide what Beatrice can do for this user.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              {permissionOptions.map(item => (
                <button
                  key={item.key}
                  onClick={() => setPermissions(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className={`text-left rounded-2xl border p-4 transition-colors ${permissions[item.key] ? 'border-[#d0a78b]/50 bg-[#d0a78b]/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.05]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.label}</span>
                    <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${permissions[item.key] ? 'bg-[#d0a78b]' : 'bg-zinc-700'}`}>
                      <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${permissions[item.key] ? 'translate-x-4' : ''}`} />
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{item.note}</p>
                </button>
              ))}
            </div>
          </section>

          <section id="messages" className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-[#d0a78b]" />
                <h3 className="text-lg font-semibold">Recent chats</h3>
              </div>
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#d0a78b]" /> : chats.length === 0 ? (
                  <p className="text-sm text-zinc-500">No chats synced yet.</p>
                ) : chats.map(chat => (
                  <div key={chat.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-sm font-medium truncate">{chat.name || chat.id}</p>
                    <p className="text-xs text-zinc-500 truncate">{chat.lastMessage || chat.id}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-[#d0a78b]" />
                <h3 className="text-lg font-semibold">Message activity</h3>
              </div>
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {messages.length === 0 ? (
                  <p className="text-sm text-zinc-500">Messages will appear after pairing or webhook ingestion.</p>
                ) : messages.map(message => (
                  <div key={`${message.chatId}:${message.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-500 truncate">{message.chatId}</p>
                      <span className="text-[10px] uppercase tracking-widest text-zinc-600">{message.fromMe ? 'sent' : 'received'}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-200">{message.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
