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
  Plus
} from 'lucide-react';
import { Peer } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';

const DirectShare = ({ sessionParam, onSessionChange }) => {
  const [sessionId, setSessionId] = useState(sessionParam || '');
  const [isHost, setIsHost] = useState(false);
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]);
  const [feed, setFeed] = useState([]); // Unified feed of files and text
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
      
      // Sync current feed to new participant
      if (isHost && feedRef.current.length > 0) {
        conn.send({ type: 'sync-feed', feed: feedRef.current });
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
        if (isHost) broadcast(data, conn);
      } else if (data.type === 'message') {
        const newItem = {
          type: 'text',
          text: data.text,
          sender: data.sender || 'Participant'
        };
        addToFeed(newItem);
        if (isHost) broadcast(data, conn);
      } else if (data.type === 'sync-feed') {
        // Reconstruct blobs from ArrayBuffers
        const hydratedFeed = data.feed.map(item => {
          if (item.type === 'file' && item.file instanceof ArrayBuffer) {
            return { ...item, blob: new Blob([item.file], { type: item.fileType }) };
          }
          return item;
        });
        setFeed(hydratedFeed);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });
  }, [isHost, broadcast, addToFeed]);

  const initPeer = useCallback((id, isHostRole) => {
    if (peerRef.current) return;
    const newPeer = new Peer(id, { debug: 1 });

    newPeer.on('open', () => {
      setStatus(isHostRole ? 'waiting' : 'connecting');
      if (!isHostRole) {
        const hostId = `mediaum-${sessionId}-host`;
        setupConnection(newPeer.connect(hostId));
      }
    });

    newPeer.on('connection', (conn) => setupConnection(conn));
    newPeer.on('error', (err) => {
      console.error(err);
      setStatus(err.type === 'id-taken' ? 'error' : 'error');
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
    initPeer(`mediaum-${id}-client-${Math.random().toString(36).substr(2, 6)}`, false);
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
          <h2 className="text-title">Collaborative Workspace</h2>
          <p className="text-body-large">Instantly share files and discuss ideas in a unified real-time feed across all your devices.</p>
          <form onSubmit={startSession} className="session-form">
            <input 
              type="text" 
              placeholder="Session ID (e.g. project-x)" 
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="session-input"
            />
            <div className="button-group-row">
              <button type="submit" className="btn-primary">Start</button>
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
                  <span>{connections.length > 0 ? `${connections.length} Online` : 'Waiting...'}</span>
                </div>
                <button onClick={() => { peer?.destroy(); window.location.search = ''; }} className="btn-text text-error"><X size={18} /></button>
              </div>

              {isHost && (
                <div className="qr-section">
                  <div className="qr-wrapper" style={{ background: 'white', padding: '12px', borderRadius: '12px' }}>
                    <QRCodeSVG value={sessionUrl} size={140} bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <p className="qr-hint">Scan to Join Session</p>
                </div>
              )}

              <div className="url-box">
                <code>{sessionId}</code>
                <button onClick={() => { navigator.clipboard.writeText(sessionUrl); alert('Link Copied!'); }} className="copy-btn"><Copy size={16} /></button>
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
                <h3 className="section-title">Shared Feed</h3>
                <div className="sync-badge"><Zap size={12} /> Live Sync Active</div>
              </div>

              <div className="feed-messages">
                {feed.length === 0 ? (
                  <div className="empty-feed">
                    <MessageSquare size={48} className="opacity-10 mb-4" />
                    <p>No activity yet. Start by sharing a file or a message!</p>
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
                  placeholder="Type a message or paste a link..." 
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

    </div>
  );
};

export default DirectShare;
