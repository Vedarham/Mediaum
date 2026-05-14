import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';
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

const DirectShare = ({ sessionParam, onSessionChange, onStatusUpdate, shareRef }) => {
  const [sessionId, setSessionId] = useState(sessionParam || '');
  const [isHost, setIsHost] = useState(false);
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]);
  const [feed, setFeed] = useState([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('idle');

  const fileInputRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const feedRef = useRef([]);

  useEffect(() => {
    connectionsRef.current = connections;
    feedRef.current = feed;
    onStatusUpdate?.({
      peerStatus: status,
      connectionsCount: connections.length,
      lastEvent: feed.length > 0 ? feed[feed.length - 1] : null
    });
  }, [connections, feed, status, onStatusUpdate]);

  const broadcast = useCallback((data, excludeConn = null) => {
    connectionsRef.current.forEach(conn => {
      if (conn !== excludeConn && conn.open) {
        try {
          conn.send(data);
        } catch (e) {
          console.error('Broadcast error:', e);
        }
      }
    });
  }, []);

  const addToFeed = useCallback((item) => {
    setFeed(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: new Date() }]);
  }, []);

  const setupConnection = useCallback((conn) => {
    conn.on('open', () => {
      addInternalLog(`Data channel open with ${conn.peer.split('-').pop()}`, 'success');
      setConnections(prev => {
        // Prevent duplicate connections from same peer
        if (prev.find(c => c.peer === conn.peer)) return prev;
        return [...prev, conn];
      });
      setStatus('connected');

      if (isHost && feedRef.current.length > 0) {
        feedRef.current.forEach(item => {
          try {
            if (item.type === 'file') {
              conn.send({
                type: 'file',
                file: item.blob,
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
          } catch (e) {
            console.error('Error syncing item:', e);
          }
        });
      }
    });

    conn.on('data', (data) => {
      try {
        if (!data || !data.type) return;

        if (data.type === 'file') {
          const blob = data.file instanceof Blob ? data.file : new Blob([data.file], { type: data.fileType });
          const newItem = {
            type: 'file',
            name: data.fileName || 'Untitled File',
            size: data.fileSize || 0,
            fileType: data.fileType || 'application/octet-stream',
            blob: blob,
            sender: data.sender || 'Participant'
          };
          addToFeed(newItem);
          if (isHost && !data.isSync) broadcast(data, conn);
        } else if (data.type === 'message') {
          const newItem = {
            type: 'text',
            text: data.text || '',
            sender: data.sender || 'Participant'
          };
          addToFeed(newItem);
          if (isHost && !data.isSync) broadcast(data, conn);
        }
      } catch (err) {
        console.error('Error processing received data:', err);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });

    conn.on('error', (err) => {
      addInternalLog(`Channel error: ${err.message}`, 'error');
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });
  }, [isHost, broadcast, addToFeed]);

  const [internalLogs, setInternalLogs] = useState([]);
  
  const addInternalLog = (msg, type = 'info') => {
    console.log(`[P2P] ${msg}`);
    setInternalLogs(prev => [...prev.slice(-4), { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const initPeer = useCallback((id, isHostRole, targetSessionId) => {
    // Force cleanup of old peer and connections
    if (peerRef.current) {
      addInternalLog('Cleaning up previous session...', 'info');
      connectionsRef.current.forEach(c => c.close());
      setConnections([]);
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    // Small delay to ensure signaling server registers the destruction
    setTimeout(() => {
      addInternalLog(`Initializing as ${isHostRole ? 'HOST' : 'CLIENT'}...`, 'info');
      
      const newPeer = new Peer(id, { 
        debug: 2,
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: {
          'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:openrelay.metered.ca:80' },
            { 
              urls: 'turn:openrelay.metered.ca:80', 
              username: 'openrelayproject', 
              credential: 'openrelayproject' 
            },
            { 
              urls: 'turn:openrelay.metered.ca:443', 
              username: 'openrelayproject', 
              credential: 'openrelayproject' 
            },
            { 
              urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
              username: 'openrelayproject', 
              credential: 'openrelayproject' 
            }
          ]
        }
      });

    const connectToHost = (retryCount = 0) => {
      if (isHostRole) return;
      const hostId = `mediaum-${targetSessionId}-host`;
      addInternalLog(`Searching for host... (Attempt ${retryCount + 1})`, 'info');
      
      const conn = newPeer.connect(hostId, { 
        reliable: true,
        metadata: { sender: 'Participant' }
      });
      
      setupConnection(conn);

      const timeout = setTimeout(() => {
        const isConnected = connectionsRef.current.some(c => c.peer === hostId);
        if (!isConnected && retryCount < 3) {
          addInternalLog(`Host not responding, retrying...`, 'warning');
          conn.close();
          connectToHost(retryCount + 1);
        } else if (!isConnected) {
          addInternalLog(`Failed to reach host after 4 attempts.`, 'error');
          setStatus('error');
        }
      }, 6000);

      conn.on('open', () => {
        clearTimeout(timeout);
        addInternalLog(`Connected to Host!`, 'success');
      });
    };

    newPeer.on('open', () => {
      addInternalLog(`Signal Server Ready. ID: ${id.split('-').pop()}`, 'success');
      setStatus(isHostRole ? 'waiting' : 'connecting');
      if (!isHostRole) connectToHost();
    });

    newPeer.on('disconnected', () => {
      addInternalLog(`Signal disconnected. Reconnecting...`, 'warning');
      newPeer.reconnect();
    });

    newPeer.on('connection', (conn) => {
      addInternalLog(`Incoming connection from ${conn.peer.split('-').pop()}`, 'success');
      setupConnection(conn);
    });
    
    newPeer.on('error', (err) => {
      addInternalLog(`Peer Error: ${err.type}`, 'error');
      if (err.type === 'id-taken' && isHostRole) {
        addInternalLog(`Session exists. Switching to JOIN mode...`, 'info');
        setTimeout(() => joinSession(targetSessionId), 500);
      } else if (err.type === 'peer-unavailable' && !isHostRole) {
        addInternalLog(`Host is offline or unreachable.`, 'warning');
      } else {
        setStatus('error');
      }
    });

    peerRef.current = newPeer;
    setPeer(newPeer);
    }, 300);
  }, [setupConnection, joinSession]);

  const startSession = (e) => {
    e?.preventDefault();
    const cleanId = sessionId.trim().toLowerCase();
    if (!cleanId) return;
    onSessionChange(cleanId);
    setSessionId(cleanId);
    setIsHost(true);
    initPeer(`mediaum-${cleanId}-host`, true, cleanId);
  };

  const joinSession = (id) => {
    const cleanId = (id || '').trim().toLowerCase();
    if (!cleanId) return;
    onSessionChange(cleanId); // Synchronize URL
    setSessionId(cleanId);
    setIsHost(false);
    const clientId = `mediaum-${cleanId}-client-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    initPeer(clientId, false, cleanId);
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


  const shareFile = useCallback((file) => {
    if (!file || (connections.length === 0 && !isHost)) return;
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
  }, [connections, isHost, addToFeed]);

  useEffect(() => {
    if (shareRef) {
      shareRef.current = { shareFile };
    }
  }, [shareRef, shareFile]);

  const downloadFile = (file) => {
    if (!file || !file.blob) {
      console.error('Cannot download: missing file blob');
      return;
    }
    try {
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      console.error('Download error:', e);
    }
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
                  <span>{connections.length > 0 ? `${connections.length} Connected` : status === 'error' ? 'Connection Failed' : 'Offline'}</span>
                </div>
                {status === 'error' && (
                  <button onClick={() => isHost ? startSession() : joinSession(sessionId)} className="btn-retry">
                    <Zap size={14} /> Retry
                  </button>
                )}
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

              <div className="internal-logs-section">
                <div className="logs-header">
                  <Zap size={12} className="text-purple-400" />
                  <span>Signal Activity</span>
                </div>
                <div className="logs-list">
                  {internalLogs.map((log, i) => (
                    <div key={i} className={`internal-log-item log-${log.type}`}>
                      <span className="log-msg">{log.msg}</span>
                    </div>
                  ))}
                  {internalLogs.length === 0 && <span className="opacity-30 text-xs italic">Idle...</span>}
                </div>
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
                <ErrorBoundary>
                  {feed.length === 0 ? (
                    <div className="empty-feed">
                      <ShieldCheck size={64} className="opacity-10 mb-4" />
                      <p>Connection established. <br />All data is transferred directly between your devices.</p>
                    </div>
                  ) : (
                    <div className="feed-list">
                      <AnimatePresence>
                        {feed.map((item) => {
                          const itemTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();
                          const isValidDate = !isNaN(itemTimestamp.getTime());

                          return (
                            <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="feed-item">
                              <div className="feed-item-header">
                                <span className="sender-tag">{item.sender || 'Unknown'}</span>
                                <span className="time-tag">
                                  {isValidDate ? itemTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                              </div>

                              {item.type === 'file' ? (
                                <div className="feed-file-content" onClick={() => downloadFile(item)}>
                                  <div className="file-icon-box-small">
                                    {item.fileType?.includes('image') ? <ImageIcon size={18} /> : <FileText size={18} />}
                                  </div>
                                  <div className="file-details">
                                    <span className="file-name-small">{item.name || 'Untitled File'}</span>
                                    <span className="file-meta">
                                      {item.size ? (item.size / 1024 / 1024).toFixed(2) : '0.00'} MB • Click to Download
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="feed-text-content">{item.text || ''}</div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </ErrorBoundary>
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
    </div>
  );
};

export default DirectShare;
