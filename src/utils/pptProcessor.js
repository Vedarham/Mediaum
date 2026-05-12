import * as pdfjsLib from 'pdfjs-dist';
import pptxgen from 'pptxgenjs';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Converts a PDF file to a PPTX presentation.
 * Each PDF page becomes a slide in the PPTX.
 * @param {File} pdfFile - The PDF file to convert.
 * @returns {Promise<Blob>} - The generated PPTX as a Blob.
 */
export const pdfToPPT = async (pdfFile) => {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pptx = new pptxgen();
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High quality
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    const imgData = canvas.toDataURL('image/png');
    const slide = pptx.addSlide();
    
    slide.addImage({
      data: imgData,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }
  
  const output = await pptx.write('blob');
  return output;
};

/**
 * Best-effort PPT to PDF conversion (placeholder for now as client-side parsing is complex).
 * In a real-world app, this might use an API or a specialized lib like Office.js.
 */
export const pptToPDF = async (pptFile) => {
  throw new Error("Direct PPT to PDF conversion is not fully supported client-side without a backend. Consider using PDF merging or image conversion instead.");
};
