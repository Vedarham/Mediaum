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
  Lock,
  Search
} from 'lucide-react';
import { Peer } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';

const DirectShare = ({ sessionParam, onSessionChange, onStatusUpdate, shareRef }) => {
  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "Tablet";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "Mobile";
    return "Desktop";
  };
  const myDeviceType = useRef(getDeviceType()).current;

  useEffect(() => {
    heartbeatInterval.current = setInterval(() => {
      connectionsRef.current.forEach(conn => {
        if (conn.open) {
          try { conn.send({ type: 'ping' }); } catch (e) { }
        }
      });
    }, 15000);

    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, []);

  const [sessionId, setSessionId] = useState(sessionParam || '');
  const [isHost, setIsHost] = useState(false);
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]);
  const [feed, setFeed] = useState([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('idle');
  const [internalLogs, setInternalLogs] = useState([]);

  const fileInputRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const feedRef = useRef([]);
  const isInitializing = useRef(false);
  const heartbeatInterval = useRef(null);

  const addInternalLog = (msg, type = 'info') => {
    setInternalLogs(prev => [...prev.slice(-4), { msg, type, time: new Date().toLocaleTimeString() }]);
  };

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
        } else if (data.type === 'ping') {
          conn.send({ type: 'pong' });
        } else if (data.type === 'pong') {
        }
      } catch (err) {
        console.error('Error processing received data:', err);
      }
    });

    conn.on('close', () => {
      addInternalLog(`Participant disconnected`, 'warning');
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });

    conn.on('error', (err) => {
      addInternalLog(`Connection error: ${err.message}`, 'error');
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });
  }, [isHost, broadcast, addToFeed]);

  const initPeer = useCallback((id, isHostRole, targetSessionId) => {
    if (peerRef.current) {
      addInternalLog('Cleaning up previous session...', 'info');
      connectionsRef.current.forEach(c => c.close());
      setConnections([]);
      peerRef.current.destroy();
      peerRef.current = null;
    }

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
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
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
          ],
          'iceCandidatePoolSize': 10,
          'sdpSemantics': 'unified-plan'
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
        isInitializing.current = false;
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
        isInitializing.current = false;
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
  }, [setupConnection]);

  function startSession(e) {
    e?.preventDefault();
    if (!sessionId) return;
    isInitializing.current = true;
    onSessionChange(sessionId);
    setIsHost(true);
    initPeer(`mediaum-${sessionId}-host`, true, sessionId);
  }

  function joinSession(id, isAuto = false) {
    if (!id) return;
    if (isAuto && (isInitializing.current || peerRef.current)) return;

    isInitializing.current = true;
    onSessionChange(id);
    setSessionId(id);
    setIsHost(false);
    const clientId = `mediaum-${id}-client-${Math.random().toString(36).substr(2, 6)}`;
    initPeer(clientId, false, id);
  }

  useEffect(() => {
    if (sessionParam && !peer && !isInitializing.current) {
      joinSession(sessionParam, true);
    }
  }, [sessionParam, peer]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || (connections.length === 0 && !isHost)) return;

    files.forEach(file => {
      const payload = {
        type: 'file',
        file: file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        sender: myDeviceType
      };
      connections.forEach(conn => conn.open && conn.send(payload));
      addToFeed({
        type: 'file',
        name: file.name,
        size: file.size,
        fileType: file.type,
        blob: file,
        sender: myDeviceType
      });
    });
  };

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || (connections.length === 0 && !isHost)) return;

    const payload = {
      type: 'message',
      text: inputText,
      sender: myDeviceType
    };
    connections.forEach(conn => conn.open && conn.send(payload));
    addToFeed({
      type: 'text',
      text: inputText,
      sender: myDeviceType
    });
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
      sender: myDeviceType
    };
    connections.forEach(conn => conn.open && conn.send(payload));
    addToFeed({
      type: 'file',
      name: file.name,
      size: file.size,
      fileType: file.type,
      blob: file,
      sender: myDeviceType
    });
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
                  <span>{connections.length > 0 ? `${connections.length} Connected` : 'Offline'}</span>
                </div>
                <button onClick={() => { peer?.destroy(); window.location.search = ''; }} className="btn-text text-error"><X size={18} /></button>
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

              {isHost && (
                <div className="qr-section">
                  <div className="qr-wrapper" style={{ background: 'white', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
                    <QRCodeSVG value={sessionUrl} size={140} bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <p className="qr-hint" style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '8px', opacity: 0.6 }}>Scan to Join Securely</p>
                </div>
              )}

              <div className="url-box" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <code style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessionId}</code>
                <button onClick={() => { navigator.clipboard.writeText(sessionUrl); alert('Link Copied!'); }} className="copy-btn" style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer' }}><Copy size={16} /></button>
              </div>

              <div className="security-notice">
                <Lock size={14} className="text-success" />
                <span>P2P E2E Encrypted</span>
              </div>

              <div className="action-area">
                <button className="btn-primary w-full" onClick={() => fileInputRef.current.click()}>
                  <Upload size={18} /> Share Media
                </button>
                <input type="file" ref={fileInputRef} multiple hidden onChange={handleFileUpload} />
              </div>
            </div>
          </div>

          <div className="share-column main-column">
            <div className="glass-card content-card feed-container" style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
              <div className="feed-header" style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="header-info">
                  <h3 className="section-title">Encrypted Feed</h3>
                  <span className="session-meta" style={{ fontSize: '0.75rem', opacity: 0.5 }}>Session ID: {sessionId}</span>
                </div>
                <div className="sync-badge" style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={14} /> Local-First Security</div>
              </div>

              <div className="feed-messages" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                <ErrorBoundary>
                  {feed.length === 0 ? (
                    <div className="empty-feed" style={{ textAlign: 'center', marginTop: '100px' }}>
                      <ShieldCheck size={64} className="opacity-10 mb-4" />
                      <p className="opacity-30">Connection established. <br />All data is transferred directly between your devices.</p>
                    </div>
                  ) : (
                    <div className="feed-list">
                      <AnimatePresence>
                        {feed.map((item) => {
                          const itemTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();
                          const isValidDate = !isNaN(itemTimestamp.getTime());

                          return (
                            <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="feed-item" style={{ marginBottom: '1.5rem' }}>
                              <div className="feed-item-header" style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '0.75rem' }}>
                                <span className="sender-tag" style={{ fontWeight: 'bold', color: '#a78bfa' }}>{item.sender || 'Unknown'}</span>
                                <span className="time-tag" style={{ opacity: 0.3 }}>
                                  {isValidDate ? itemTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                              </div>

                              {item.type === 'file' ? (
                                <div className="feed-file-content" onClick={() => downloadFile(item)} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <div className="file-icon-box-small" style={{ background: 'rgba(167, 139, 250, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                    {item.fileType?.includes('image') ? <ImageIcon size={18} className="text-purple-400" /> : <FileText size={18} className="text-purple-400" />}
                                  </div>
                                  <div className="file-details">
                                    <span className="file-name-small" style={{ display: 'block', fontWeight: '500' }}>{item.name || 'Untitled File'}</span>
                                    <span className="file-meta" style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                      {item.size ? (item.size / 1024 / 1024).toFixed(2) : '0.00'} MB • Click to Download
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="feed-text-content" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', borderLeft: '3px solid #a78bfa' }}>{item.text || ''}</div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </ErrorBoundary>
              </div>

              <form onSubmit={sendMessage} className="feed-input-area" style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Share a thought or link..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={connections.length === 0 && !isHost}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', padding: '12px', borderRadius: '12px', color: 'white' }}
                />
                <button type="submit" disabled={!inputText.trim() || (connections.length === 0 && !isHost)} style={{ background: '#a78bfa', border: 'none', width: '45px', borderRadius: '12px', color: 'white', cursor: 'pointer' }}>
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
