import React, { useState, useCallback } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { mergePDFs, imagesToPDF } from './utils/pdfProcessor';
import { pdfToPPT } from './utils/pptProcessor';

const App = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('merge');
  
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
      return combined;
    });
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    
    try {
      let result;
      let filename = 'mediaum-output';
      
      if (activeTab === 'merge') {
        result = await mergePDFs(files);
        downloadFile(result, `${filename}.pdf`, 'application/pdf');
      } else if (activeTab === 'imgToPdf') {
        result = await imagesToPDF(files);
        downloadFile(result, `${filename}.pdf`, 'application/pdf');
      } else if (activeTab === 'pdfToPpt') {
        for (const file of files) {
          const blob = await pdfToPPT(file);
          downloadFile(blob, `${file.name.split('.')[0]}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        }
      }
    } catch (error) {
      console.error(error);
      alert('Error processing files: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
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

  return (
    <div className="app-container">
      <div className="bg-gradient" />
      
      <div className="container">
        {/* Header */}
        <header>
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
          
          <nav className="tab-group">
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
          </nav>
        </header>

        {/* Main Content */}
        <main className="main-layout">
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
                  {activeTab === 'pdfToPpt' && `Transform your PDF presentations into editable PowerPoint slides.`}
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
                  <button 
                    onClick={() => document.getElementById('file-input').click()}
                    className="btn-text"
                  >
                    <FilePlus size={18} /> Add More
                  </button>
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
                          <div className={`file-icon-box ${activeTab === 'imgToPdf' ? 'bg-blue-500/10' : 'bg-red-500/10'}`} style={{ backgroundColor: activeTab === 'imgToPdf' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                            {activeTab === 'imgToPdf' ? <ImageIcon size={20} className="text-blue-400" /> : <FileText size={20} className="text-red-400" />}
                          </div>
                          <div className="file-details">
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button onClick={() => removeFile(idx)} className="remove-btn">
                          <X size={18} />
                        </button>
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

          {/* Feature Grid */}
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <Files className="text-blue-400" size={24} />
              </div>
              <h4>Lightning Fast</h4>
              <p>Advanced merging algorithms combine your documents in milliseconds without any quality loss.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <ImageIcon className="text-emerald-400" size={24} />
              </div>
              <h4>Smart Images</h4>
              <p>Automatically optimizes image resolution while converting to PDF for the perfect balance of size and clarity.</p>
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
        accept={activeTab === 'imgToPdf' ? 'image/*' : '.pdf'}
      />
    </div>
  );
};

export default App;
