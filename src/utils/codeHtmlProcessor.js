import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';

/**
 * Escapes HTML characters in a string to avoid rendering side-effects.
 */
const escapeHtml = (text) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/**
 * High-performance, unified client-side syntax tokenizer.
 * Prevents string corruption, overlapping replacements, or double-wrapping.
 * Supports Python, JavaScript, TS, HTML, and other file types.
 */
export const highlightCode = (code, ext) => {
  const escaped = escapeHtml(code);
  const extension = ext.toLowerCase();

  if (extension === 'py' || extension === 'python') {
    // Unified Regex Tokenizer for Python:
    const pythonRegex = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\r\n]*|\b(?:def|class|import|from|as|return|if|elif|else|while|for|in|try|except|finally|with|print|lambda|and|or|not|is|None|True|False|self)\b|\b\d+\b|\b[a-zA-Z_]\w*(?=\())/g;

    return escaped.replace(pythonRegex, (match) => {
      if (match.startsWith('"""') || match.startsWith("'''")) {
        return `<span class="token-comment">${match}</span>`;
      }
      if (match.startsWith('#')) {
        return `<span class="token-comment">${match}</span>`;
      }
      if (match.startsWith('"') || match.startsWith("'")) {
        return `<span class="token-string">${match}</span>`;
      }
      if (/^(def|class|import|from|as|return|if|elif|else|while|for|in|try|except|finally|with|print|lambda|and|or|not|is|None|True|False|self)$/.test(match)) {
        return `<span class="token-keyword">${match}</span>`;
      }
      if (/^\d+$/.test(match)) {
        return `<span class="token-number">${match}</span>`;
      }
      return `<span class="token-function">${match}</span>`;
    });
  }

  if (['js', 'jsx', 'ts', 'tsx', 'json'].includes(extension)) {
    // Unified Regex Tokenizer for JS/TS/JSON:
    const jsRegex = /(\/\*[\s\S]*?\*\/|\/\/.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[\s\S]*?`|\b(?:const|let|var|function|return|import|export|from|default|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|typeof|instanceof|async|await|true|false|null|undefined|class)\b|\b\d+\b|\b[a-zA-Z_]\w*(?=\())/g;

    return escaped.replace(jsRegex, (match) => {
      if (match.startsWith('/*') || match.startsWith('//')) {
        return `<span class="token-comment">${match}</span>`;
      }
      if (match.startsWith('"') || match.startsWith("'") || match.startsWith('`')) {
        return `<span class="token-string">${match}</span>`;
      }
      if (/^(const|let|var|function|return|import|export|from|default|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|typeof|instanceof|async|await|true|false|null|undefined|class)$/.test(match)) {
        return `<span class="token-keyword">${match}</span>`;
      }
      if (/^\d+$/.test(match)) {
        return `<span class="token-number">${match}</span>`;
      }
      return `<span class="token-function">${match}</span>`;
    });
  }

  if (['html', 'xml', 'svg'].includes(extension)) {
    // HTML tags, attributes, and comments highlighting
    let highlighted = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="token-comment">$1</span>');
    
    // Highlight elements and attribute names/values
    highlighted = highlighted.replace(/(&lt;\/?[a-zA-Z0-9:-]+)(\s+|&gt;|\/&gt;)/g, '<span class="token-keyword">$1</span>$2');
    highlighted = highlighted.replace(/(\s+[a-zA-Z0-9:-]+=)("[^"]*")/g, '<span class="token-function">$1</span><span class="token-string">$2</span>');
    highlighted = highlighted.replace(/(\s+[a-zA-Z0-9:-]+=)('[^']*')/g, '<span class="token-function">$1</span><span class="token-string">$2</span>');

    return highlighted;
  }

  // Plain text / standard return
  return escaped;
};

/**
 * Creates a beautifully styled, high-fidelity light print editor wrapper around highlighted code.
 */
export const createCodeHtmlTemplate = (filename, codeHtml, ext, sizeStr) => {
  const langBadge = (ext || 'TXT').toUpperCase();
  let badgeBg = 'rgba(124, 58, 237, 0.1)'; // purple
  let badgeColor = '#7c3aed';
  
  if (ext === 'py' || ext === 'python') {
    badgeBg = 'rgba(37, 99, 235, 0.1)'; // blue
    badgeColor = '#2563eb';
  } else if (ext === 'html') {
    badgeBg = 'rgba(220, 38, 38, 0.1)'; // red
    badgeColor = '#dc2626';
  } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    badgeBg = 'rgba(217, 119, 6, 0.1)'; // amber
    badgeColor = '#d97706';
  }

  const linesCount = codeHtml.split('\n').length;
  let lineNumbersHtml = '';
  for (let i = 1; i <= linesCount; i++) {
    lineNumbersHtml += `<div>${i}</div>`;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Fira+Code:wght@400;500&display=swap');
          
          body {
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
            color: #1e293b;
            font-family: 'Outfit', sans-serif;
            -webkit-print-color-adjust: exact;
          }
          
          .editor-container {
            border: 1px solid #e2e8f0;
            background: #fafafa;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          }
          
          .editor-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            background: #f1f5f9;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .file-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .dots {
            display: flex;
            gap: 6px;
          }
          
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }
          .dot-red { background: #ef4444; }
          .dot-yellow { background: #f59e0b; }
          .dot-green { background: #10b981; }
          
          .filename {
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            font-weight: 600;
            color: #334155;
          }
          
          .meta {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .badge {
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 0.7rem;
            font-weight: 700;
            background: ${badgeBg};
            color: ${badgeColor};
            letter-spacing: 0.05em;
          }
          
          .filesize {
            font-size: 0.7rem;
            color: #64748b;
            font-weight: 600;
          }
          
          .editor-body {
            display: flex;
            padding: 24px;
            font-family: 'Fira Code', 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.6;
          }
          
          .line-numbers {
            text-align: right;
            padding-right: 20px;
            color: #94a3b8;
            user-select: none;
            border-right: 1px solid #e2e8f0;
            margin-right: 20px;
          }
          
          .code-content {
            flex: 1;
            white-space: pre-wrap;
            word-break: break-all;
            color: #334155;
          }
          
          .token-keyword { color: #4f46e5; font-weight: 600; }
          .token-string { color: #16a34a; }
          .token-comment { color: #64748b; font-style: italic; }
          .token-number { color: #ea580c; }
          .token-function { color: #2563eb; }
          
          .watermark {
            text-align: center;
            margin-top: 30px;
            color: #94a3b8;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
        </style>
      </head>
      <body>
        <div class="editor-container">
          <div class="editor-header">
            <div class="file-info">
              <div class="dots">
                <div class="dot dot-red"></div>
                <div class="dot dot-yellow"></div>
                <div class="dot dot-green"></div>
              </div>
              <div class="filename">${filename}</div>
            </div>
            <div class="meta">
              <div class="badge">${langBadge}</div>
              <div class="filesize">${sizeStr}</div>
            </div>
          </div>
          <div class="editor-body">
            <div class="line-numbers">${lineNumbersHtml}</div>
            <div class="code-content">${codeHtml}</div>
          </div>
        </div>
        <div class="watermark">Compiled with Mediaum • Premium Media Suite</div>
      </body>
    </html>
  `;
};

/**
 * Renders raw HTML string or styled Code HTML document to a single high-quality PDF.
 * Uses a sandboxed hidden iframe, html2canvas, and pdf-lib vertical page slicing.
 * @param {string} htmlContent - The raw HTML document string.
 * @returns {Promise<Uint8Array>} - The compiled PDF document as a Uint8Array.
 */
export const htmlToPDF = async (htmlContent) => {
  return new Promise((resolve, reject) => {
    // 1. Create a sandboxed hidden iframe to load and render the HTML page
    // Position it in the visible layout area but completely invisible to ensure full GPU rasterization
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '800px'; // fixed print container width
    iframe.style.height = '100px'; // dynamic height container start
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    document.body.appendChild(iframe);

    // 2. Inject HTML content into iframe and wait for load
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // 3. Capture canvas and slice into multi-page PDF once resources are loaded
    const onRender = async () => {
      try {
        const body = doc.body;
        // Expand iframe height to fit its absolute scroll content
        iframe.style.height = body.scrollHeight + 'px';
        
        // Wait minor tick for layout calculation
        await new Promise(r => setTimeout(r, 200));

        // Ensure the iframe scroll position is explicitly reset to the top
        iframe.contentWindow.scrollTo(0, 0);

        // Use html2canvas to capture the entire rendered page
        const canvas = await html2canvas(body, {
          scale: 2.0, // High quality retina scaling
          useCORS: true,
          backgroundColor: '#ffffff', // Clean white background
          logging: false,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0
        });

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // A4 specifications (width = 595, height = 842 points in pdf-lib)
        const pageHeightPx = Math.round(canvasWidth * (842 / 595));
        const pdfDoc = await PDFDocument.create();

        let remainingHeight = canvasHeight;
        let currentY = 0;

        while (remainingHeight > 0) {
          const sliceHeight = Math.min(remainingHeight, pageHeightPx);

          // Draw individual A4 page segment on slice canvas
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvasWidth;
          sliceCanvas.height = sliceHeight;
          const sliceCtx = sliceCanvas.getContext('2d');

          sliceCtx.drawImage(
            canvas,
            0, currentY, canvasWidth, sliceHeight, // source slice
            0, 0, canvasWidth, sliceHeight        // target slice
          );

          // Convert canvas frame to JPEG image bytes
          const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());

          // Embed page into PDF Document
          const pdfImage = await pdfDoc.embedJpg(imgBytes);
          const a4Width = 595;
          const a4Height = Math.round(595 * (sliceHeight / canvasWidth));

          const page = pdfDoc.addPage([a4Width, a4Height]);
          page.drawImage(pdfImage, {
            x: 0,
            y: 0,
            width: a4Width,
            height: a4Height
          });

          currentY += sliceHeight;
          remainingHeight -= sliceHeight;
        }

        // Clean up temporary iframe
        document.body.removeChild(iframe);

        // Resolve generated PDF document bytes
        const pdfBytes = await pdfDoc.save();
        resolve(pdfBytes);
      } catch (err) {
        document.body.removeChild(iframe);
        reject(err);
      }
    };

    // Wait for window/resources to load fully in the iframe
    if (doc.readyState === 'complete') {
      // Delay slightly for fonts and lazy rendering
      setTimeout(onRender, 400);
    } else {
      iframe.contentWindow.onload = () => setTimeout(onRender, 400);
    }
  });
};

/**
 * Converts a code file (Python, JS, etc.) or HTML file to a single PDF.
 * @param {File} file - Code or HTML file.
 * @returns {Promise<Uint8Array>} - The generated PDF as a Uint8Array.
 */
export const codeHtmlToPDF = async (file) => {
  const textContent = await file.text();
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (ext === 'html' || ext === 'htm') {
    // Parse directly as HTML
    return await htmlToPDF(textContent);
  } else {
    // Syntax highlight and compile code script
    const sizeStr = (file.size / 1024).toFixed(2) + ' KB';
    const highlightedCode = highlightCode(textContent, ext);
    const templateHtml = createCodeHtmlTemplate(file.name, highlightedCode, ext, sizeStr);
    return await htmlToPDF(templateHtml);
  }
};
