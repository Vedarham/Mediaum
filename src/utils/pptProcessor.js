import * as pdfjsLib from 'pdfjs-dist';
import pptxgen from 'pptxgenjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker using local source via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Converts PDF files to a single PPTX presentation.
 * Each PDF page becomes a slide in the PPTX.
 * @param {Array<File>|File} pdfFiles - Single PDF file or array of PDF files.
 * @returns {Promise<Blob>} - The generated PPTX as a Blob.
 */
export const pdfToPPT = async (pdfFiles) => {
  const files = Array.isArray(pdfFiles) ? pdfFiles : [pdfFiles];
  const pptx = new pptxgen();

  for (const pdfFile of files) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
  }

  const output = await pptx.write('blob');
  return output;
};

/**
 * @param {Array<File>} imageFiles - Array of image files.
 * @returns {Promise<Blob>} - The generated PPTX as a Blob.
 */
export const imagesToPPT = async (imageFiles) => {
  const pptx = new pptxgen();

  for (const file of imageFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const reader = new FileReader();

    const dataUrl = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    const slide = pptx.addSlide();
    slide.addImage({
      data: dataUrl,
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
 * Placeholder for PPT to PDF (still complex client-side).
 */
export const pptToPDF = async (pptFile) => {
  throw new Error("Direct PPT to PDF conversion is not fully supported client-side. Consider using PDF merging or image conversion instead.");
};
