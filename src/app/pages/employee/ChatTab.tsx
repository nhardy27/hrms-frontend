import { useState, useEffect, useRef, useCallback } from 'react';
import config from '../../../config/global.json';
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';

type ChatType = 'private';

interface Message {
  id?: number;
  sender: string;
  sender_id?: number;
  message: string;
  timestamp?: string;
}

interface EmployeeOption {
  user_id: number;
  username: string;
  name: string;
  emp_code?: string;
  department?: string;
  designation?: string;
}

interface ChatTabProps {
  employee: {
    id: string;
    username?: string;
    first_name?: string;
    department_name?: string;
    department_id?: string;
    designation?: string;
    designation_id?: string;
  } | null;
  pendingChatUserId?: number | null;
  onPendingChatHandled?: () => void;
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColor = (name: string) => {
  const colors = ['#3b5998', '#e74c3c', '#16a085', '#8e44ad', '#e67e22', '#2980b9', '#27ae60'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatTime = (ts?: string) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

const formatDateLabel = (ts?: string) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Design tokens ──
const C = {
  sidebarBg: '#1e2d3d',
  sidebarHover: '#263545',
  sidebarActive: '#2b3d4f',
  sidebarBorder: 'rgba(255,255,255,0.07)',
  headerBg: '#2b3d4f',
  chatBg: '#f4f6f9',
  myBubble: '#2b3d4f',
  myBubbleText: '#ffffff',
  theirBubble: '#ffffff',
  theirBubbleText: '#1a2533',
  inputBg: '#ffffff',
  inputBorder: '#e2e8f0',
  accent: '#3d8ef8',
  mutedText: 'rgba(255,255,255,0.55)',
  datePill: 'rgba(43,61,79,0.12)',
  datePillText: '#4a6080',
};

export function ChatTab({ employee, pendingChatUserId, onPendingChatHandled }: ChatTabProps) {
  const [chatType] = useState<ChatType>('private');
  const [roomId, setRoomId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [search, setSearch] = useState('');
  const [showChat, setShowChat] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const wsHost = (config as any).ws?.host ||
    config.api.host.replace('https://', 'wss://').replace('http://', 'ws://');

  useEffect(() => {
    makeAuthenticatedRequest(`${config.api.host}${(config.api as any).chatEmployees}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setEmployees(data.results ?? data); })
      .catch(() => {});
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setConnecting(false);
    setMessages([]);
  }, []);

  const connect = useCallback((rid: string, type: ChatType) => {
    if (!rid.trim()) return;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnecting(true);
    setMessages([]);
    const token = localStorage.getItem('token');
    const ws = new WebSocket(`${wsHost}/ws/chat/${type}/${rid}/?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setConnecting(false); setTimeout(() => inputRef.current?.focus(), 100); };
    ws.onclose = () => { setConnected(false); setConnecting(false); };
    ws.onerror = () => { setConnected(false); setConnecting(false); };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'history') setMessages(data.messages ?? []);
        else if (data.type === 'message') setMessages(prev => [...prev, data]);
      } catch { /* ignore */ }
    };
  }, [wsHost]);

  useEffect(() => {
    disconnect();
    setSelectedEmployee(null);
    setSearch('');
    setShowChat(false);
    setRoomId('');
  }, [chatType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingChatUserId || employees.length === 0) return;
    const emp = employees.find(e => e.user_id === pendingChatUserId);
    if (emp) { setSelectedEmployee(emp); onPendingChatHandled?.(); }
  }, [pendingChatUserId, employees]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatType === 'private' && selectedEmployee) {
      const rid = String(selectedEmployee.user_id);
      setRoomId(rid);
      connect(rid, 'private');
      setShowChat(true);
    }
  }, [selectedEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => disconnect(), [disconnect]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ message: input.trim() }));
    setInput('');
  }, [input]);

  const filteredEmployees = employees
    .filter(e =>
      e.user_id !== Number(employee?.id) &&
      `${e.name} ${e.username} ${e.department ?? ''} ${e.designation ?? ''}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.user_id === selectedEmployee?.user_id) return -1;
      if (b.user_id === selectedEmployee?.user_id) return 1;
      return 0;
    });

  const messageGroups: { dateLabel: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const label = formatDateLabel(msg.timestamp);
    const last = messageGroups[messageGroups.length - 1];
    if (!last || last.dateLabel !== label) messageGroups.push({ dateLabel: label, msgs: [msg] });
    else last.msgs.push(msg);
  });

  const myId = Number(employee?.id);
  const chatTitle = selectedEmployee?.name || '';
  const chatSubtitle = [selectedEmployee?.designation, selectedEmployee?.department].filter(Boolean).join(' · ');

  // ── Sidebar header ──
  const SidebarHeader = (
    <div style={{ background: C.sidebarBg, padding: '0 16px', height: 60, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, borderBottom: `1px solid ${C.sidebarBorder}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="bi bi-chat-square-text-fill" style={{ fontSize: 15, color: '#fff' }} />
      </div>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: 0.2 }}>Messages</span>
    </div>
  );

  // ── Search bar ──
  const SearchBar = (
    <div style={{ padding: '10px 12px', background: C.sidebarBg, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '0 10px', height: 34, gap: 8 }}>
        <i className="bi bi-search" style={{ fontSize: 13, color: C.mutedText, flexShrink: 0 }} />
        <input
          ref={searchRef}
          type="text"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#fff', minWidth: 0 }}
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
            <i className="bi bi-x" style={{ fontSize: 15, color: C.mutedText }} />
          </button>
        )}
      </div>
    </div>
  );

  // ── Contact list ──
  const ContactList = (
    <div className="d-flex flex-column" style={{ height: '100%', background: C.sidebarBg }}>
      {SidebarHeader}
      {SearchBar}
      <div className="overflow-auto flex-grow-1">
        {filteredEmployees.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: C.mutedText }}>
            <i className="bi bi-people" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.3 }} />
            <span style={{ fontSize: 13 }}>{search ? 'No results' : 'No contacts'}</span>
          </div>
        )}
        {filteredEmployees.map(emp => {
          const isActive = selectedEmployee?.user_id === emp.user_id;
          return (
            <button
              key={emp.user_id}
              onClick={() => setSelectedEmployee(emp)}
              style={{
                width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: isActive ? C.sidebarActive : 'transparent',
                borderLeft: isActive ? `3px solid ${C.accent}` : '3px solid transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = C.sidebarHover; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: avatarColor(emp.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: 0.5
              }}>
                {getInitials(emp.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.name}
                </div>
                <div style={{ color: C.mutedText, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                  {[emp.designation, emp.department].filter(Boolean).join(' · ') || emp.username}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Chat header ──
  const ChatHeader = (
    <div style={{ background: C.headerBg, padding: '0 16px', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
      <button
        className="d-md-none"
        style={{ background: 'none', border: 'none', color: '#fff', padding: '4px 8px 4px 0', cursor: 'pointer', flexShrink: 0 }}
        onClick={() => { setShowChat(false); disconnect(); setSelectedEmployee(null); }}
      >
        <i className="bi bi-arrow-left" style={{ fontSize: 18 }} />
      </button>

      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: avatarColor(chatTitle || 'U'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 14
      }}>
        {selectedEmployee ? getInitials(selectedEmployee.name) : <i className="bi bi-person" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chatTitle}
        </div>
        <div style={{ fontSize: 12, marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          {connecting ? (
            <><span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10, borderWidth: 2, color: C.mutedText }} /><span style={{ color: C.mutedText }}>Connecting...</span></>
          ) : connected ? (
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{chatSubtitle}</span>
          ) : (
            <span style={{ color: C.mutedText }}>{chatSubtitle}</span>
          )}
        </div>
      </div>

      {!connecting && selectedEmployee && !connected && (
        <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '6px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={() => connect(roomId, 'private')}>
          <i className="bi bi-arrow-clockwise" style={{ fontSize: 14 }} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );

  // ── Messages area ──
  const MessagesArea = (
    <>
      <div className="flex-grow-1 overflow-auto" style={{ background: C.chatBg, padding: '16px 20px' }}>
        {!connected && !connecting && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: '#e8edf3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-chat-square-dots" style={{ fontSize: 28, color: '#94a3b8' }} />
            </div>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Select a contact to start chatting</span>
          </div>
        )}
        {connecting && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span className="spinner-border spinner-border-sm" style={{ color: C.headerBg }} />
            <span style={{ color: '#64748b', fontSize: 14 }}>Connecting...</span>
          </div>
        )}
        {connected && messageGroups.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#e8edf3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-shield-lock" style={{ fontSize: 22, color: '#94a3b8' }} />
            </div>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>No messages yet. Say hello!</span>
          </div>
        )}
        {connected && messageGroups.map((group, gi) => (
          <div key={gi}>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 12px' }}>
              <span style={{ background: C.datePill, color: C.datePillText, fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 20, letterSpacing: 0.3 }}>
                {group.dateLabel}
              </span>
            </div>
            {group.msgs.map((msg, i) => {
              const isMine = msg.sender_id === myId;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                  {!isMine && (
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: avatarColor(msg.sender), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end', marginBottom: 2 }}>
                      {getInitials(msg.sender)}
                    </div>
                  )}
                  <div style={{
                    maxWidth: 'min(72%, 420px)',
                    background: isMine ? C.myBubble : C.theirBubble,
                    color: isMine ? C.myBubbleText : C.theirBubbleText,
                    borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '9px 13px 7px',
                    boxShadow: isMine ? '0 2px 8px rgba(43,61,79,0.25)' : '0 1px 4px rgba(0,0,0,0.08)',
                    wordBreak: 'break-word',
                  }}>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.message}</div>
                    <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', opacity: isMine ? 0.6 : 0.45 }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ background: '#fff', borderTop: `1px solid ${C.inputBorder}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          style={{
            flex: 1, border: `1.5px solid ${connected ? C.inputBorder : '#e2e8f0'}`, outline: 'none',
            borderRadius: 12, background: connected ? C.inputBg : '#f8fafc',
            fontSize: 14, padding: '10px 14px', color: '#1a2533', minWidth: 0,
            transition: 'border-color 0.2s',
          }}
          placeholder={connected ? 'Type a message...' : 'Not connected'}
          value={input}
          disabled={!connected}
          onChange={e => setInput(e.target.value)}
          onFocus={e => { if (connected) e.target.style.borderColor = C.accent; }}
          onBlur={e => { e.target.style.borderColor = C.inputBorder; }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          style={{
            width: 42, height: 42, borderRadius: 12, border: 'none', flexShrink: 0,
            background: connected && input.trim() ? C.myBubble : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: connected && input.trim() ? 'pointer' : 'default',
            transition: 'background 0.2s, transform 0.1s',
          }}
          onMouseDown={e => { if (connected && input.trim()) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)'; }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          <i className="bi bi-send-fill" style={{ fontSize: 15, color: connected && input.trim() ? '#fff' : '#94a3b8', marginLeft: 2 }} />
        </button>
      </div>
    </>
  );

  // ── Empty right panel ──
  const EmptyState = (
    <div style={{ flex: 1, background: C.chatBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: '#e8edf3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="bi bi-chat-square-text" style={{ fontSize: 36, color: '#94a3b8' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#334155', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>HR Messenger</div>
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Select a colleague to start a conversation</div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="d-md-none" style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', flexDirection: 'column' }}>
        {!showChat && ContactList}
        {showChat && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {ChatHeader}
            {MessagesArea}
          </div>
        )}
      </div>

      {/* ── DESKTOP ── */}
      <div className="d-none d-md-flex" style={{
        height: 'calc(100vh - 130px)', minHeight: 500,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        border: '1px solid #e2e8f0',
      }}>
        {/* Left sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {ContactList}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedEmployee ? <>{ChatHeader}{MessagesArea}</> : EmptyState}
        </div>
      </div>
    </>
  );
}
