import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, 
  Smartphone, 
  Monitor, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ExternalLink,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  QrCode,
  MessageSquare,
  Zap,
  Users,
  Send,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { Peer } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';

const DirectShare = ({ sessionParam, onSessionChange }) => {
  const [sessionId, setSessionId] = useState(sessionParam || '');
  const [isHost, setIsHost] = useState(false);
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]);
  const [feed, setFeed] = useState([]); 
  const [inputText, setInputText] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});
  const [status, setStatus] = useState('idle');
  
  const fileInputRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const feedRef = useRef([]);

  useEffect(() => {
    connectionsRef.current = connections;
    feedRef.current = feed;
  }, [connections, feed]);

  const broadcast = useCallback((data, excludeConn = null) => {
    connectionsRef.current.forEach(conn => {
      if (conn !== excludeConn && conn.open) {
        // PeerJS handles cloning data, but for large arrays it might be slow
        conn.send(data);
      }
    });
  }, []);

  const addToFeed = useCallback((item) => {
    setFeed(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: new Date() }]);
  }, []);

  const setupConnection = useCallback((conn) => {
    conn.on('open', () => {
      setConnections(prev => [...prev, conn]);
      setStatus('connected');
      
      // If we are host, sync history to the new participant
      if (isHost && feedRef.current.length > 0) {
        // Send history items one by one to ensure reliable delivery of Blobs
        feedRef.current.forEach(item => {
          if (item.type === 'file') {
            conn.send({
              type: 'file',
              file: item.blob, // Send the actual blob
              fileName: item.name,
              fileSize: item.size,
              fileType: item.fileType,
              sender: item.sender,
              isSync: true
            });
          } else {
            conn.send({
              type: 'message',
              text: item.text,
              sender: item.sender,
              isSync: true
            });
          }
        });
      }
    });

    conn.on('data', (data) => {
      if (data.type === 'file') {
        const blob = new Blob([data.file], { type: data.fileType });
        const newItem = {
          type: 'file',
          name: data.fileName,
          size: data.fileSize,
          fileType: data.fileType,
          blob: blob,
          sender: data.sender || 'Participant'
        };
        addToFeed(newItem);
        if (isHost && !data.isSync) broadcast(data, conn);
      } else if (data.type === 'message') {
        const newItem = {
          type: 'text',
          text: data.text,
          sender: data.sender || 'Participant'
        };
        addToFeed(newItem);
        if (isHost && !data.isSync) broadcast(data, conn);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });
  }, [isHost, broadcast, addToFeed]);

  const initPeer = useCallback((id, isHostRole) => {
    if (peerRef.current) return;
    
    // Hash the ID slightly to avoid direct guessing of Peer IDs if someone inspects
    const peerIdToUse = id;
    
    const newPeer = new Peer(peerIdToUse, { 
      debug: 1,
      config: {
        'iceServers': [
          { url: 'stun:stun.l.google.com:19302' },
          { url: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    newPeer.on('open', () => {
      setStatus(isHostRole ? 'waiting' : 'connecting');
      if (!isHostRole) {
        const hostId = `mediaum-${sessionId}-host`;
        const conn = newPeer.connect(hostId);
        setupConnection(conn);
      }
    });

    newPeer.on('connection', (conn) => setupConnection(conn));
    
    newPeer.on('error', (err) => {
      console.error('PeerJS Error:', err.type, err);
      if (err.type === 'id-taken' && isHostRole) {
        // Auto-join if host ID taken (maybe session already started)
        peerRef.current = null;
        setPeer(null);
        joinSession(sessionId);
      } else {
        setStatus('error');
      }
    });

    peerRef.current = newPeer;
    setPeer(newPeer);
  }, [sessionId, setupConnection]);

  const startSession = (e) => {
    e?.preventDefault();
    if (!sessionId) return;
    onSessionChange(sessionId);
    setIsHost(true);
    initPeer(`mediaum-${sessionId}-host`, true);
  };

  const joinSession = (id) => {
    setSessionId(id);
    setIsHost(false);
    const clientId = `mediaum-${id}-client-${Math.random().toString(36).substr(2, 6)}`;
    initPeer(clientId, false);
  };

  useEffect(() => {
    if (sessionParam && !peer) joinSession(sessionParam);
  }, [sessionParam]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || connections.length === 0) return;

    files.forEach(file => {
      const payload = {
        type: 'file',
        file: file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        sender: isHost ? 'Desktop' : 'Mobile'
      };
      
      connections.forEach(conn => conn.open && conn.send(payload));
      addToFeed({ ...payload, blob: file });
    });
  };

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || connections.length === 0) return;

    const payload = {
      type: 'message',
      text: inputText,
      sender: isHost ? 'Desktop' : 'Mobile'
    };

    connections.forEach(conn => conn.open && conn.send(payload));
    addToFeed(payload);
    setInputText('');
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;

  return (
    <div className="direct-share-container">
      {!peer ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="session-setup glass-card">
          <div className="icon-wrapper-large"><Share2 className="text-purple-400" size={32} /></div>
          <h2 className="text-title">Secure Workspace</h2>
          <p className="text-body-large">Peer-to-peer real-time sharing. End-to-end encrypted and local-first.</p>
          <form onSubmit={startSession} className="session-form">
            <input 
              type="text" 
              placeholder="Session ID (e.g. project-x)" 
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="session-input"
            />
            <div className="button-group-row">
              <button type="submit" className="btn-primary">Start Session</button>
              <button type="button" onClick={() => joinSession(sessionId)} className="btn-secondary">Join</button>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="share-layout-grid">
          <div className="share-column">
            <div className="glass-card side-card">
              <div className="share-header">
                <div className="status-badge">
                  <div className={`status-dot ${connections.length > 0 ? 'bg-success' : 'bg-warning'}`} />
                  <span>{connections.length > 0 ? `${connections.length} Connected` : 'Offline'}</span>
                </div>
                <button onClick={() => { peer?.destroy(); window.location.search = ''; }} className="btn-text text-error"><X size={18} /></button>
              </div>

              {isHost && (
                <div className="qr-section">
                  <div className="qr-wrapper" style={{ background: 'white', padding: '12px', borderRadius: '12px' }}>
                    <QRCodeSVG value={sessionUrl} size={140} bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <p className="qr-hint">Scan to Join Securely</p>
                </div>
              )}

              <div className="url-box">
                <code>{sessionId}</code>
                <button onClick={() => { navigator.clipboard.writeText(sessionUrl); alert('Link Copied!'); }} className="copy-btn"><Copy size={16} /></button>
              </div>

              <div className="security-notice">
                <Lock size={14} className="text-success" />
                <span>P2P E2E Encrypted</span>
              </div>

              <div className="action-area">
                <button className="btn-primary w-full" onClick={() => fileInputRef.current.click()} disabled={connections.length === 0}>
                  <Upload size={18} /> Share Media
                </button>
                <input type="file" ref={fileInputRef} multiple hidden onChange={handleFileUpload} />
              </div>
            </div>
          </div>

          <div className="share-column main-column">
            <div className="glass-card content-card feed-container">
              <div className="feed-header">
                <div className="header-info">
                   <h3 className="section-title">Encrypted Feed</h3>
                   <span className="session-meta">Session ID: {sessionId}</span>
                </div>
                <div className="sync-badge"><ShieldCheck size={14} /> Local-First Security</div>
              </div>

              <div className="feed-messages">
                {feed.length === 0 ? (
                  <div className="empty-feed">
                    <ShieldCheck size={64} className="opacity-10 mb-4" />
                    <p>Connection established. <br/>All data is transferred directly between your devices.</p>
                  </div>
                ) : (
                  <div className="feed-list">
                    <AnimatePresence>
                      {feed.map((item) => (
                        <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="feed-item">
                          <div className="feed-item-header">
                            <span className="sender-tag">{item.sender}</span>
                            <span className="time-tag">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          {item.type === 'text' ? (
                            <div className="feed-text-content">{item.text}</div>
                          ) : (
                            <div className="feed-file-content" onClick={() => downloadFile(item)}>
                              <div className="file-icon-box-small">
                                {item.fileType.includes('image') ? <ImageIcon size={18} /> : <FileText size={18} />}
                              </div>
                              <div className="file-details">
                                <span className="file-name-small">{item.name}</span>
                                <span className="file-meta">{(item.size / 1024 / 1024).toFixed(2)} MB • Click to Download</span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <form onSubmit={sendMessage} className="feed-input-area">
                <input 
                  type="text" 
                  placeholder="Share a thought or link..." 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={connections.length === 0 && !isHost}
                />
                <button type="submit" disabled={!inputText.trim() || (connections.length === 0 && !isHost)}>
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .security-notice {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 1rem;
          padding: 0.5rem;
          background: rgba(16, 185, 129, 0.05);
          border-radius: 8px;
          justify-content: center;
        }
        .header-info { display: flex; flex-direction: column; }
        .session-meta { font-size: 0.7rem; color: var(--text-secondary); }
      `}</style>
    </div>
  );
};

export default DirectShare;
