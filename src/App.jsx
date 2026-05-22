import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FilePlus,
  Files,
  Image as ImageIcon,
  FileText,
  Download,
  X,
  Loader2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  Share2,
  Activity,
  FileSpreadsheet
} from 'lucide-react';
import { mergePDFs, imagesToPDF } from './utils/pdfProcessor';
import { pdfToPPT, imagesToPPT, pptToPDF } from './utils/pptProcessor';
import DirectShare from './components/DirectShare';
import StatusDashboard from './components/StatusDashboard';
import SmartExcel from './components/SmartExcel';

const App = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('share');
  const [previewBlob, setPreviewBlob] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sessionParam, setSessionParam] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || '';
  });

  useEffect(() => {
    if (previewBlob?.blob) {
      const url = URL.createObjectURL(previewBlob.blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [previewBlob]);

  const shareRef = useRef(null);
  const [showStatus, setShowStatus] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [peerStatus, setPeerStatus] = useState('idle');
  const [connectionsCount, setConnectionsCount] = useState(0);

  const addLog = useCallback((message, type = 'info') => {
    setSystemLogs(prev => [{
      time: new Date().toLocaleTimeString([], { hour12: false }),
      message,
      type,
      id: Math.random().toString(36).substr(2, 9)
    }, ...prev].slice(0, 50));
  }, []);

  const MAX_PDFS = 15;
  const MAX_IMAGES = 30;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    setFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (activeTab === 'merge' && combined.length > MAX_PDFS) return combined.slice(0, MAX_PDFS);
      if (activeTab === 'imgToPdf' && combined.length > MAX_IMAGES) return combined.slice(0, MAX_IMAGES);
      if (activeTab === 'imgToPpt' && combined.length > MAX_IMAGES) return combined.slice(0, MAX_IMAGES);
      if (activeTab === 'pptToPdf' && combined.length > 10) return combined.slice(0, 10);
      return combined;
    });
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index, direction) => {
    setFiles(prev => {
      const updated = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= updated.length) return prev;
      
      // Swap elements in place
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      
      return updated;
    });
    addLog(`Reordered conversion list`, 'info');
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      let result;
      let filename = 'mediaum-output';

      if (activeTab === 'merge') {
        result = await mergePDFs(files);
        showPreviewModal(result, `${filename}.pdf`, 'application/pdf');
      } else if (activeTab === 'imgToPdf') {
        result = await imagesToPDF(files);
        showPreviewModal(result, `${filename}.pdf`, 'application/pdf');
      } else if (activeTab === 'pdfToPpt') {
        result = await pdfToPPT(files);
        downloadFile(result, `${filename}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        addLog(`Converted ${files.length} PDFs into one PPTX`, 'success');
      } else if (activeTab === 'imgToPpt') {
        result = await imagesToPPT(files);
        downloadFile(result, `${filename}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        addLog(`Converted ${files.length} images into one PPTX`, 'success');
      } else if (activeTab === 'pptToPdf') {
        const filesToProcess = files.slice(0, 10);
        addLog(`Starting batch conversion for ${filesToProcess.length} PowerPoint presentations...`, 'info');

        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          addLog(`Converting slide deck ${i + 1}/${filesToProcess.length}: "${file.name}"...`, 'info');
          const pdfBytes = await pptToPDF(file);

          if (filesToProcess.length === 1) {
            // Render beautiful visual preview modal if only 1 PPT uploaded
            showPreviewModal(pdfBytes, `${file.name.replace(/\.[^/.]+$/, "")}.pdf`, 'application/pdf');
          } else {
            // Direct download each compiled file for multiple batch conversion
            downloadFile(pdfBytes, `${file.name.replace(/\.[^/.]+$/, "")}.pdf`, 'application/pdf');
            addLog(`Successfully converted and downloaded "${file.name}"`, 'success');
          }
        }
      }
    } catch (error) {
      console.error(error);
      addLog(`Error: ${error.message}`, 'error');
      alert('Error processing files: ' + error.message);
    } finally {
      setIsProcessing(false);
      addLog(`Finished processing ${activeTab}`);
    }
  };

  const showPreviewModal = (data, name, type) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    setPreviewBlob({ blob, name, type });
    setShowPreview(true);
  };

  const downloadFile = (data, name, type) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFileIcon = () => {
    if (activeTab === 'imgToPdf' || activeTab === 'imgToPpt') {
      return <ImageIcon size={20} className="text-blue-400" />;
    }
    if (activeTab === 'pptToPdf') {
      return <FileText size={20} className="text-orange-400" />;
    }
    return <FileText size={20} className="text-red-400" />;
  };

  const getFileIconBg = () => {
    if (activeTab === 'imgToPdf' || activeTab === 'imgToPpt') {
      return 'rgba(59, 130, 246, 0.1)';
    }
    if (activeTab === 'pptToPdf') {
      return 'rgba(249, 115, 22, 0.1)';
    }
    return 'rgba(239, 68, 68, 0.1)';
  };

  const getAcceptTypes = () => {
    if (activeTab === 'imgToPdf' || activeTab === 'imgToPpt') {
      return "image/*";
    }
    if (activeTab === 'pptToPdf') {
      return ".pptx,.ppt";
    }
    return ".pdf";
  };

  return (
    <div className="app-container">
      <div className="bg-gradient" />

      <div className="container">
        {/* Header */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2.5rem 0', marginBottom: '3rem' }}>
          {/* Brand Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="header-brand"
            >
              <img src="/logo.png" alt="Mediaum" className="logo" />
              <div>
                <h1 className="brand-title">Mediaum</h1>
                <p className="brand-subtitle">Premium Media Suite</p>
              </div>
            </motion.div>

            <button
              onClick={() => setShowStatus(!showStatus)}
              className={`status-toggle-btn ${showStatus ? 'active' : ''}`}
            >
              <Activity size={18} />
              <span>Status</span>
            </button>
          </div>

          {/* Navigation Row */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <nav className="tab-group" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: '6px', width: 'auto' }}>
              <button
                onClick={() => { setActiveTab('merge'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'merge' ? 'active' : ''}`}
              >
                Merge PDF
              </button>
              <button
                onClick={() => { setActiveTab('imgToPdf'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'imgToPdf' ? 'active' : ''}`}
              >
                Images to PDF
              </button>
              <button
                onClick={() => { setActiveTab('pdfToPpt'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'pdfToPpt' ? 'active' : ''}`}
              >
                PDF to PPT
              </button>
              <button
                onClick={() => { setActiveTab('imgToPpt'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'imgToPpt' ? 'active' : ''}`}
              >
                Images to PPT
              </button>
              <button
                onClick={() => { setActiveTab('pptToPdf'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'pptToPdf' ? 'active' : ''}`}
              >
                PPT to PDF
              </button>
              <button
                onClick={() => { setActiveTab('share'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'share' ? 'active' : ''}`}
              >
                <Share2 size={16} style={{ marginRight: '6px' }} />
                Direct Share
              </button>
              <button
                onClick={() => { setActiveTab('excel'); setFiles([]); }}
                className={`tab-btn ${activeTab === 'excel' ? 'active' : ''}`}
              >
                <FileSpreadsheet size={16} style={{ marginRight: '6px' }} />
                Smart Excel
              </button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="main-layout">
          <div style={{ display: activeTab === 'share' ? 'block' : 'none' }}>
            <DirectShare
              sessionParam={sessionParam}
              onSessionChange={(id) => {
                const url = new URL(window.location);
                if (id) {
                  url.searchParams.set('session', id);
                } else {
                  url.searchParams.delete('session');
                }
                window.history.pushState({}, '', url);
                setSessionParam(id);
              }}
              onStatusUpdate={(data) => {
                setPeerStatus(data.peerStatus);
                setConnectionsCount(data.connectionsCount);
              }}
              shareRef={shareRef}
            />
          </div>

          <div style={{ display: activeTab === 'excel' ? 'block' : 'none' }}>
            <SmartExcel onShare={(file) => {
              if (shareRef.current) {
                shareRef.current.shareFile(file);
                setActiveTab('share');
                addLog(`Generated and shared Excel: ${file.name}`, 'success');
              } else {
                alert('Please start or join a Direct Share session first!');
              }
            }} />
          </div>

          <div style={{ display: (activeTab !== 'share' && activeTab !== 'excel') ? 'block' : 'none' }}>
            <div className="glass-card">
              {/* Dropzone */}
              {files.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="dropzone"
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <div className="icon-wrapper-large float">
                    <FilePlus className="text-purple-400" size={32} />
                  </div>
                  <h2 className="text-title">Drop your files here</h2>
                  <p className="text-body-large">
                    {activeTab === 'merge' && `Select up to ${MAX_PDFS} PDF documents to merge them into one seamless file.`}
                    {activeTab === 'imgToPdf' && `Select up to ${MAX_IMAGES} images to generate a professional PDF.`}
                    {activeTab === 'pdfToPpt' && `Convert one or more PDFs into a single presentation.`}
                    {activeTab === 'imgToPpt' && `Turn your images into a professional presentation.`}
                    {activeTab === 'pptToPdf' && `Select up to 10 PowerPoint presentations (.pptx) to convert their slide layouts and text into professional PDFs at once.`}
                  </p>
                  <button className="btn-primary" style={{ margin: '0 auto' }}>
                    <FilePlus size={18} />
                    Browse Files
                  </button>
                </motion.div>
              ) : (
                <div className="processing-content">
                  <div className="processing-header">
                    <div className="status-title-group">
                      <h3 className="status-title">
                        <ShieldCheck className="text-success" size={24} />
                        Ready to Process
                      </h3>
                      <p className="status-subtitle">{files.length} files selected for processing</p>
                    </div>
                    {/* Hide Add More button when slide queue limit is reached */}
                    {(activeTab !== 'pptToPdf' || files.length < 10) && (
                      <button
                        onClick={() => document.getElementById('file-input').click()}
                        className="btn-text"
                      >
                        <FilePlus size={18} /> Add More
                      </button>
                    )}
                  </div>

                  <div className="file-list">
                    <AnimatePresence>
                      {files.map((file, idx) => (
                        <motion.div
                          key={`${file.name}-${idx}`}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="file-item"
                        >
                          <div className="file-info-group">
                            <div className="file-icon-box" style={{ backgroundColor: getFileIconBg() }}>
                              {getFileIcon()}
                            </div>
                            <div className="file-details">
                              <p className="file-name">{file.name}</p>
                              <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {/* Reorder Buttons inside File List */}
                            {files.length > 1 && (
                              <div style={{ display: 'flex', gap: '4px', marginRight: '12px' }}>
                                <button 
                                  disabled={idx === 0} 
                                  onClick={() => moveFile(idx, -1)}
                                  className="reorder-btn"
                                  title="Move Up"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: idx === 0 ? 'rgba(255,255,255,0.06)' : 'var(--text-secondary)',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: '6px',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  <ChevronUp size={16} />
                                </button>
                                <button 
                                  disabled={idx === files.length - 1} 
                                  onClick={() => moveFile(idx, 1)}
                                  className="reorder-btn"
                                  title="Move Down"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: idx === files.length - 1 ? 'rgba(255,255,255,0.06)' : 'var(--text-secondary)',
                                    cursor: idx === files.length - 1 ? 'not-allowed' : 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: '6px',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                            )}
                            <button onClick={() => removeFile(idx)} className="remove-btn">
                              <X size={18} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="action-bar">
                    <button onClick={() => setFiles([])} className="btn-secondary">
                      Clear Workspace
                    </button>
                    <button
                      onClick={handleProcess}
                      disabled={isProcessing}
                      className="btn-primary"
                      style={{ minWidth: '180px', justifyContent: 'center' }}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Start Now
                          <ChevronRight size={20} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Feature Grid */}
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <Files className="text-blue-400" size={24} />
              </div>
              <h4>Lightning Fast</h4>
              <p>Advanced merging and compilation algorithms combine your documents in milliseconds without any quality loss.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <ImageIcon className="text-emerald-400" size={24} />
              </div>
              <h4>Smart Content</h4>
              <p>Automatically renders PowerPoint vector paths, text wrapping, and colors locally in real-time.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                <Download className="text-orange-400" size={24} />
              </div>
              <h4>Local Security</h4>
              <p>Your data never leaves your device. All processing is performed locally in your browser's secure sandbox.</p>
            </div>
          </div>
        </main>

        <footer>
          <p>© 2026 Mediaum. Powered by Local-First Processing.</p>
          <div className="footer-nav">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </footer>
      </div>

      <input
        id="file-input"
        type="file"
        multiple
        hidden
        onChange={handleFileChange}
        accept={getAcceptTypes()}
      />

      <AnimatePresence>
        {showPreview && previewBlob && (
          <div className="preview-overlay" onClick={() => setShowPreview(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="preview-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="preview-header">
                <h3>{previewBlob.name}</h3>
                <button onClick={() => setShowPreview(false)} className="close-btn"><X size={20} /></button>
              </div>
              <div className="preview-body">
                <iframe
                  src={previewUrl}
                  title="PDF Preview"
                  className="preview-iframe"
                />
              </div>
              <div className="preview-footer">
                <button className="btn-secondary" onClick={() => setShowPreview(false)}>Close</button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    downloadFile(previewBlob.blob, previewBlob.name, previewBlob.type);
                    setShowPreview(false);
                  }}
                >
                  <Download size={18} /> Download
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showStatus && (
          <StatusDashboard
            isOpen={showStatus}
            onClose={() => setShowStatus(false)}
            peerStatus={peerStatus}
            connectionsCount={connectionsCount}
            logs={systemLogs}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;