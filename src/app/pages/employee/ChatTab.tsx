import { useState, useEffect, useRef, useCallback } from 'react';
import config from '../../../config/global.json';
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';

type ChatType = 'private' | 'department' | 'designation';

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
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColor = (name: string) => {
  const colors = ['#4f6d7a', '#c0392b', '#16a085', '#8e44ad', '#d35400', '#2980b9', '#27ae60'];
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

export function ChatTab({ employee }: ChatTabProps) {
  const [chatType, setChatType] = useState<ChatType>('private');
  const [roomId, setRoomId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [search, setSearch] = useState('');
  const [showChat, setShowChat] = useState(false); // mobile: show chat panel
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
    disconnect();
    setConnecting(true);
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
  }, [wsHost, disconnect]);

  useEffect(() => {
    disconnect();
    setSelectedEmployee(null);
    setSearch('');
    setShowChat(false);
    if (chatType === 'department' && employee?.department_id) {
      setRoomId(employee.department_id);
      connect(employee.department_id, 'department');
      setShowChat(true);
    } else if (chatType === 'designation' && employee?.designation_id) {
      setRoomId(employee.designation_id);
      connect(employee.designation_id, 'designation');
      setShowChat(true);
    } else {
      setRoomId('');
    }
  }, [chatType]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const sendMessage = () => {
    if (!input.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ message: input.trim() }));
    setInput('');
  };

  const filteredEmployees = employees.filter(e =>
    e.user_id !== Number(employee?.id) &&
    `${e.name} ${e.username} ${e.department ?? ''} ${e.designation ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const messageGroups: { dateLabel: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const label = formatDateLabel(msg.timestamp);
    const last = messageGroups[messageGroups.length - 1];
    if (!last || last.dateLabel !== label) messageGroups.push({ dateLabel: label, msgs: [msg] });
    else last.msgs.push(msg);
  });

  const myId = Number(employee?.id);

  const chatTitle =
    chatType === 'private'
      ? selectedEmployee?.name || ''
      : chatType === 'department'
      ? `${employee?.department_name || 'Department'} Group`
      : `${employee?.designation || 'Designation'} Group`;

  const chatSubtitle =
    chatType === 'private'
      ? [selectedEmployee?.designation, selectedEmployee?.department].filter(Boolean).join(' · ')
      : chatType === 'department' ? 'Department group' : 'Designation group';

  // ── Shared: Chat messages + input ──
  const MessagesArea = (
    <>
      <div className="flex-grow-1 overflow-auto px-2 px-md-3 py-2" style={{ background: '#efeae2' }}>
        {!connected && !connecting && (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
            <i className="bi bi-chat-dots" style={{ fontSize: 40, opacity: 0.2 }} />
            <div className="mt-2 small text-center px-4">
              {chatType === 'private' ? 'Select a contact to start chatting' : 'Could not connect.'}
            </div>
          </div>
        )}
        {connecting && (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted">
            <span className="spinner-border spinner-border-sm me-2" />
            <span className="small">Connecting...</span>
          </div>
        )}
        {connected && messageGroups.length === 0 && (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
            <i className="bi bi-lock" style={{ fontSize: 18, opacity: 0.3 }} />
            <div className="mt-1 text-center px-4" style={{ fontSize: 12, opacity: 0.5 }}>
              Messages are end-to-end encrypted
            </div>
          </div>
        )}
        {connected && messageGroups.map((group, gi) => (
          <div key={gi}>
            {/* Date pill */}
            <div className="d-flex justify-content-center my-3">
              <span className="px-3 py-1 rounded-pill" style={{ background: '#d1f4cc', fontSize: 11, color: '#54656f' }}>
                {group.dateLabel}
              </span>
            </div>
            {group.msgs.map((msg, i) => {
              const isMine = msg.sender_id === myId;
              const showName = !isMine && chatType !== 'private' &&
                (i === 0 || group.msgs[i - 1]?.sender_id !== msg.sender_id);
              return (
                <div key={i} className={`d-flex mb-1 ${isMine ? 'justify-content-end' : 'justify-content-start'}`}>
                  <div style={{
                    maxWidth: 'min(80%, 400px)',
                    background: isMine ? '#d9fdd3' : '#ffffff',
                    borderRadius: isMine ? '8px 8px 0 8px' : '8px 8px 8px 0',
                    padding: '6px 10px 4px',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                    wordBreak: 'break-word'
                  }}>
                    {showName && (
                      <div className="fw-semibold" style={{ fontSize: 12, color: avatarColor(msg.sender), marginBottom: 2 }}>
                        {msg.sender}
                      </div>
                    )}
                    <span style={{ fontSize: 14, color: '#111b21', lineHeight: 1.5 }}>{msg.message}</span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: '#667781' }}>{formatTime(msg.timestamp)}</span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f0f2f5', flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          style={{
            flex: 1, border: 'none', outline: 'none', borderRadius: 24,
            background: '#fff', fontSize: 15, padding: '10px 16px',
            color: '#111b21', minWidth: 0
          }}
          placeholder="Type a message"
          value={input}
          disabled={!connected}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: connected && input.trim() ? '#25d366' : '#adb5bd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: connected && input.trim() ? 'pointer' : 'default',
            transition: 'background 0.2s'
          }}
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
        >
          <i className="bi bi-send-fill" style={{ fontSize: 16, color: '#fff' }} />
        </button>
      </div>
    </>
  );

  // ── Chat header ──
  const ChatHeader = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#2b3d4f', padding: '8px 12px',
      minHeight: 56, flexShrink: 0
    }}>
      <button
        className="d-md-none"
        style={{ background: 'none', border: 'none', color: '#fff', padding: '4px 6px 4px 0', cursor: 'pointer', flexShrink: 0 }}
        onClick={() => { setShowChat(false); if (chatType === 'private') { disconnect(); setSelectedEmployee(null); } }}
      >
        <i className="bi bi-arrow-left" style={{ fontSize: 20 }} />
      </button>

      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: avatarColor(chatTitle || 'G'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 14
      }}>
        {chatType === 'private'
          ? (selectedEmployee ? getInitials(selectedEmployee.name) : <i className="bi bi-person" />)
          : <i className={`bi ${chatType === 'department' ? 'bi-building' : 'bi-briefcase'}`} />}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chatTitle}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {connecting ? 'connecting...' : chatSubtitle}
        </div>
      </div>

      {!connecting && chatType === 'private' && selectedEmployee && !connected && (
        <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => connect(roomId, 'private')}>
          <i className="bi bi-arrow-clockwise" style={{ fontSize: 18 }} />
        </button>
      )}
    </div>
  );

  // ── Contact list (private tab) ──
  const ContactList = (
    <div className="d-flex flex-column" style={{ height: '100%' }}>
      {/* Search bar */}
      <div style={{ background: '#f0f2f5', padding: '8px 12px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#fff', borderRadius: 8,
          padding: '0 12px', height: 36,
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
        }}>
          <i className="bi bi-search" style={{ fontSize: 14, color: '#8696a0', marginRight: 8, flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 14,
              color: '#111b21', minWidth: 0, height: '100%',
              padding: 0, lineHeight: '36px'
            }}
            placeholder="Search name, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
              onClick={() => { setSearch(''); searchRef.current?.focus(); }}
            >
              <i className="bi bi-x-circle-fill" style={{ fontSize: 15, color: '#8696a0' }} />
            </button>
          )}
        </div>
      </div>

      {/* Contacts */}
      <div className="overflow-auto flex-grow-1" style={{ background: '#fff' }}>
        {filteredEmployees.length === 0 && (
          <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
            <i className="bi bi-people" style={{ fontSize: 36, opacity: 0.15 }} />
            <div className="mt-2 small">{search ? 'No results' : 'No contacts'}</div>
          </div>
        )}
        {filteredEmployees.map((emp, idx) => (
          <button
            key={emp.user_id}
            className="w-100 border-0 text-start d-flex align-items-center gap-3 px-3"
            style={{
              background: selectedEmployee?.user_id === emp.user_id ? '#f0f2f5' : '#fff',
              padding: '12px 16px',
              borderBottom: idx < filteredEmployees.length - 1 ? '1px solid #f0f2f5' : 'none',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedEmployee(emp)}
          >
            <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
              style={{ width: 48, height: 48, fontSize: 16, background: avatarColor(emp.name) }}>
              {getInitials(emp.name)}
            </div>
            <div className="flex-grow-1 overflow-hidden" style={{ borderBottom: '1px solid #f0f2f5', paddingBottom: 12, paddingTop: 2 }}>
              <div className="fw-semibold text-truncate" style={{ fontSize: 15, color: '#111b21' }}>{emp.name}</div>
              <div className="text-truncate" style={{ fontSize: 13, color: '#667781' }}>
                {[emp.designation, emp.department].filter(Boolean).join(' · ')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* ════════════════════════════════════
          MOBILE: full-screen fixed overlay
          ════════════════════════════════════ */}
      <div className="d-md-none" style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', flexDirection: 'column', background: '#fff' }}>

        {/* Tab bar header */}
        {!showChat && (
          <div style={{ background: '#2b3d4f', flexShrink: 0 }}>
            {/* Title row */}
            <div className="d-flex align-items-center px-3" style={{ height: 56 }}>
              <span className="text-white fw-semibold" style={{ fontSize: 20, flex: 1 }}>Chats</span>
            </div>
            {/* Tab row */}
            <div className="d-flex" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {(['private', 'department', 'designation'] as ChatType[]).map(t => (
                <button key={t} onClick={() => setChatType(t)}
                  className="btn flex-fill d-flex flex-column align-items-center justify-content-center py-2 gap-1"
                  style={{
                    borderRadius: 0, border: 'none',
                    borderBottom: chatType === t ? '2px solid #25d366' : '2px solid transparent',
                    background: 'transparent',
                    color: chatType === t ? '#25d366' : 'rgba(255,255,255,0.55)',
                    fontSize: 10, fontWeight: chatType === t ? 600 : 400,
                    transition: 'all 0.15s'
                  }}>
                  <i className={`bi ${
                    t === 'private' ? 'bi-person-fill' :
                    t === 'department' ? 'bi-building-fill' : 'bi-briefcase-fill'
                  }`} style={{ fontSize: 20 }} />
                  <span style={{ textTransform: 'capitalize', letterSpacing: 0.2 }}>
                    {t === 'private' ? 'Direct' : t === 'department' ? 'Department' : 'Designation'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Private: show contact list or chat */}
        {chatType === 'private' && !showChat && ContactList}
        {chatType === 'private' && showChat && (
          <div className="d-flex flex-column flex-grow-1 overflow-hidden">
            {ChatHeader}
            {MessagesArea}
          </div>
        )}

        {/* Group: always show chat */}
        {chatType !== 'private' && (
          <div className="d-flex flex-column flex-grow-1 overflow-hidden">
            {ChatHeader}
            {MessagesArea}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════
          DESKTOP: inline two-panel card
          ════════════════════════════════════ */}
      <div className="d-none d-md-flex card border-0 shadow-sm overflow-hidden"
        style={{ height: 'calc(100vh - 130px)', minHeight: 500, borderRadius: 12, flexDirection: 'column' }}>

        {/* Tab bar */}
        <div className="d-flex flex-shrink-0" style={{ background: '#2b3d4f' }}>
          {(['private', 'department', 'designation'] as ChatType[]).map(t => (
            <button key={t} onClick={() => setChatType(t)}
              className="btn flex-fill d-flex align-items-center justify-content-center gap-2 py-2"
              style={{
                borderRadius: 0, border: 'none',
                borderBottom: chatType === t ? '2px solid #fff' : '2px solid transparent',
                background: 'transparent',
                color: chatType === t ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 13, fontWeight: chatType === t ? 600 : 400
              }}>
              <i className={`bi ${t === 'private' ? 'bi-person' : t === 'department' ? 'bi-building' : 'bi-briefcase'}`} />
              <span style={{ textTransform: 'capitalize' }}>{t}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="d-flex flex-grow-1 overflow-hidden">
          {chatType === 'private' && (
            <>
              {/* Left: contact list */}
              <div className="flex-shrink-0 border-end d-flex flex-column" style={{ width: 280 }}>
                {ContactList}
              </div>
              {/* Right: chat */}
              <div className="flex-grow-1 d-flex flex-column overflow-hidden">
                {selectedEmployee
                  ? <>{ChatHeader}{MessagesArea}</>
                  : (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted"
                      style={{ background: '#f0f2f5' }}>
                      <i className="bi bi-chat-dots" style={{ fontSize: 48, opacity: 0.15 }} />
                      <div className="mt-2 small">Select a contact to start chatting</div>
                    </div>
                  )
                }
              </div>
            </>
          )}
          {chatType !== 'private' && (
            <div className="flex-grow-1 d-flex flex-column overflow-hidden">
              {ChatHeader}
              {MessagesArea}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
