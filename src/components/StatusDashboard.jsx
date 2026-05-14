import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Cpu, 
  Database, 
  Terminal, 
  X,
  CheckCircle2,
  AlertTriangle,
  History
} from 'lucide-react';

const StatusDashboard = ({ isOpen, onClose, peerStatus, connectionsCount, logs }) => {
  const [memory, setMemory] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const interval = setInterval(() => {
      if (performance.memory) {
        setMemory({
          used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1),
          total: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)
        });
      }
    }, 2000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="status-sidebar"
    >
      <div className="status-header">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-purple-400" />
          <h3 className="text-lg font-bold">System Monitor</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
          <X size={20} />
        </button>
      </div>

      <div className="status-content">
        {/* Network Status */}
        <section className="status-section">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm opacity-60">Network</span>
            {isOnline ? (
              <span className="badge-success"><Wifi size={12} /> Online</span>
            ) : (
              <span className="badge-error"><WifiOff size={12} /> Offline</span>
            )}
          </div>
          
          <div className="status-grid">
            <div className="status-card-mini">
              <span className="text-xs opacity-50">PeerJS Service</span>
              <div className="flex items-center gap-2 mt-1">
                {peerStatus === 'connected' || peerStatus === 'waiting' ? (
                  <>
                    <div className="pulse-dot bg-success" />
                    <span className="text-sm font-semibold text-success">Active</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="text-sm font-semibold text-warning">{peerStatus === 'error' ? 'Service Error' : 'Offline'}</span>
                  </>
                )}
              </div>
            </div>
            <div className="status-card-mini">
              <span className="text-xs opacity-50">Active Peers</span>
              <div className="text-lg font-mono mt-1">{connectionsCount}</div>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="status-section">
          <h4 className="section-subtitle"><Cpu size={14} /> Local Resources</h4>
          <div className="resource-bar-group">
            <div className="flex justify-between text-xs mb-1">
              <span>Heap Usage</span>
              <span>{memory ? `${memory.used}MB / ${memory.total}MB` : 'N/A'}</span>
            </div>
            <div className="resource-progress-bg">
              <motion.div 
                className="resource-progress-fill" 
                initial={{ width: 0 }}
                animate={{ width: memory ? `${(memory.used / memory.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </section>

        {/* Logs */}
        <section className="status-section flex-1 overflow-hidden flex flex-col">
          <h4 className="section-subtitle"><Terminal size={14} /> Execution Logs</h4>
          <div className="log-container">
            {logs.length === 0 ? (
              <p className="text-xs opacity-40 italic">No events recorded yet.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="log-entry">
                  <span className="log-time">[{log.time}]</span>
                  <span className={`log-msg log-${log.type}`}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

    </motion.div>
  );
};

export default StatusDashboard;
