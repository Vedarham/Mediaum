import { PDFDocument } from 'pdf-lib';

/**
 * Merges multiple PDF files into one.
 * @param {Array<File>} files - Array of PDF files.
 * @returns {Promise<Uint8Array>} - The merged PDF as a Uint8Array.
 */
export const mergePDFs = async (files) => {
  const mergedPdf = await PDFDocument.create();
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  return await mergedPdf.save();
};

/**
 * Converts images to a single PDF.
 * @param {Array<File>} files - Array of image files.
 * @returns {Promise<Uint8Array>} - The generated PDF as a Uint8Array.
 */
export const imagesToPDF = async (files) => {
  const pdfDoc = await PDFDocument.create();
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    let image;
    
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      image = await pdfDoc.embedJpg(arrayBuffer);
    } else if (file.type === 'image/png') {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      console.warn(`Unsupported image type: ${file.type}`);
      continue;
    }
    
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }
  
  return await pdfDoc.save();
};
