import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  Table, 
  Download, 
  Share2, 
  Zap, 
  Clipboard, 
  AlertCircle,
  FileCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

const SmartExcel = ({ onShare }) => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [delimiter, setDelimiter] = useState(null);

  const detectDelimiter = (text) => {
    const lines = text.split('\n').filter(line => line.trim()).slice(0, 5);
    if (lines.length === 0) return null;

    const delimiters = ['|', ',', '\t'];
    let bestDelimiter = '|';
    let maxCount = -1;

    delimiters.forEach(delim => {
      const counts = lines.map(line => line.split(delim).length);
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      // If the delimiter results in multiple columns consistently
      if (avg > 1.5 && avg > maxCount) {
        maxCount = avg;
        bestDelimiter = delim;
      }
    });

    return bestDelimiter;
  };

  useEffect(() => {
    if (!inputText.trim()) {
      setParsedData([]);
      setHeaders([]);
      setDelimiter(null);
      return;
    }

    const detected = detectDelimiter(inputText);
    setDelimiter(detected);

    const rows = inputText.split('\n')
      .filter(line => line.trim())
      .map(line => line.split(detected).map(cell => cell.trim()));

    if (rows.length > 0) {
      setHeaders(rows[0]);
      setParsedData(rows.slice(1));
    }
  }, [inputText]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInputText(text);
    } catch (err) {
      alert('Please paste using Ctrl+V');
    }
  };

  const handleExportAndShare = () => {
    if (headers.length === 0) return;
    setIsProcessing(true);

    try {
      const data = [headers, ...parsedData];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mediaum Data");
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `mediaum-converted-${Date.now()}.xlsx`;

      // Trigger local download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Share to session
      const file = new File([blob], filename, { type: blob.type });
      onShare(file);
      
    } catch (err) {
      console.error('Excel Generation Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="smart-excel-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card excel-card"
      >
        <div className="excel-header">
          <div className="header-left">
            <div className="icon-box-emerald">
              <FileSpreadsheet className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Smart Excel</h2>
              <p className="text-xs text-secondary">Auto-converts GPT snippets, | and , separated data.</p>
            </div>
          </div>
          {delimiter && (
            <div className="delimiter-badge">
              <Zap size={14} className="text-orange-400" />
              <span>Detected: {delimiter === '\t' ? 'Tab' : delimiter} Delimiter</span>
            </div>
          )}
        </div>

        <div className="input-section">
          <textarea 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your ChatGPT output or CSV data here... e.g. Name | Age | City"
            className="excel-input"
            spellCheck="false"
          />
          <button onClick={handlePaste} className="paste-overlay-btn">
            <Clipboard size={16} /> Paste Data
          </button>
        </div>

        <AnimatePresence>
          {headers.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="preview-section"
            >
              <div className="preview-label">
                <Table size={16} /> Data Preview ({parsedData.length} rows)
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {headers.map((h, i) => <th key={i}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => <td key={j}>{cell}</td>)}
                      </tr>
                    ))}
                    {parsedData.length > 5 && (
                      <tr>
                        <td colSpan={headers.length} className="text-center italic text-secondary">
                          ... and {parsedData.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="excel-footer">
          <button 
            onClick={() => setInputText('')} 
            className="btn-text"
            disabled={!inputText}
          >
            <X size={18} /> Clear
          </button>
          
          <button 
            onClick={handleExportAndShare}
            disabled={headers.length === 0 || isProcessing}
            className="btn-primary-emerald"
          >
            {isProcessing ? (
              <Zap className="animate-spin" size={18} />
            ) : (
              <>
                <FileCheck size={18} />
                Generate & Share Excel
              </>
            )}
          </button>
        </div>
      </motion.div>

      <style>{`
        .excel-card {
          padding: 2.5rem !important;
          max-width: 950px;
          margin: 0 auto;
        }
        .excel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .icon-box-emerald {
          width: 48px;
          height: 48px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .delimiter-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .input-section {
          position: relative;
          margin-bottom: 2rem;
        }
        .excel-input {
          width: 100%;
          height: 200px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          color: white;
          padding: 1.5rem;
          font-family: inherit;
          font-size: 0.95rem;
          resize: none;
          outline: none;
          line-height: 1.6;
          transition: all 0.3s;
        }
        .excel-input:focus {
          border-color: var(--success);
          background: rgba(0, 0, 0, 0.4);
        }
        .paste-overlay-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: white;
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-size: 0.8rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        .paste-overlay-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .preview-section {
          margin-bottom: 2rem;
          overflow: hidden;
        }
        .preview-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }
        .table-wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        th {
          text-align: left;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
          font-weight: 700;
          border-bottom: 1px solid var(--glass-border);
        }
        td {
          padding: 0.75rem 1rem;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--glass-border);
        }
        tr:last-child td {
          border-bottom: none;
        }
        .excel-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid var(--glass-border);
        }
        .btn-primary-emerald {
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          border-radius: 12px;
          color: white;
          padding: 0.8rem 1.5rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
          transition: all 0.3s;
        }
        .btn-primary-emerald:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }
        .btn-primary-emerald:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }
      `}</style>
    </div>
  );
};

export default SmartExcel;
