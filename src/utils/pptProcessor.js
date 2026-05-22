import * as pdfjsLib from 'pdfjs-dist';
import pptxgen from 'pptxgenjs';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
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
 * Converts images to a single PPTX.
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
 * Converts a PPTX presentation file to a single PDF document.
 * Leverages client-side Zip parsing and canvas rendering for local conversions.
 * @param {File} pptFile - PowerPoint presentation file.
 * @returns {Promise<Uint8Array>} - The generated PDF as a Uint8Array.
 */
export const pptToPDF = async (pptFile) => {
  let zip;
  try {
    zip = await JSZip.loadAsync(pptFile);
  } catch (e) {
    throw new Error("Unable to read PowerPoint file structure. Note: Legacy binary .ppt files are not supported client-side; please convert to .pptx in PowerPoint before uploading.");
  }
  const parser = new DOMParser();

  // 1. Read slide dimensions from ppt/presentation.xml (case-insensitive check)
  const presFile = zip.file("ppt/presentation.xml") || zip.file(/ppt\/presentation\.xml/i)[0];
  if (!presFile) {
    throw new Error("This file is not a valid PPTX presentation (missing ppt/presentation.xml). Note: Legacy binary .ppt files are not supported client-side; please convert to .pptx in PowerPoint before uploading.");
  }

  const presXmlText = await presFile.async("text");
  const presDoc = parser.parseFromString(presXmlText, "application/xml");
  const sldSz = presDoc.getElementsByTagName("p:sldSz")[0] || presDoc.querySelector("sldSz");
  
  let slideWidth = 9144000; // standard 10 in
  let slideHeight = 5143500; // standard 5.625 in (16:9)
  if (sldSz) {
    slideWidth = parseInt(sldSz.getAttribute("cx") || "9144000");
    slideHeight = parseInt(sldSz.getAttribute("cy") || "5143500");
  }

  // Define scale factor for visual canvas conversion (target width = 1280px)
  const canvasWidth = 1280;
  const scale = canvasWidth / slideWidth;
  const canvasHeight = Math.round(slideHeight * scale);

  // 2. Discover slide paths and sort them numerically
  const slideKeys = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  slideKeys.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0]);
    const numB = parseInt(b.match(/\d+/)[0]);
    return numA - numB;
  });

  if (slideKeys.length === 0) {
    throw new Error("No slides found in the PowerPoint presentation.");
  }

  // 3. Compile PDF using pdf-lib
  const pdfDoc = await PDFDocument.create();

  // Helper to resolve PowerPoint relationship paths (e.g. '../media/image1.png' => 'ppt/media/image1.png')
  const resolveTarget = (target) => {
    if (target.startsWith('../')) {
      return 'ppt/' + target.substring(3);
    }
    if (target.startsWith('/ppt/')) {
      return target.substring(1);
    }
    return 'ppt/' + target;
  };

  // Helper to process shape tree nodes recursively
  const renderNode = async (node, ctx, relMap) => {
    const localName = node.localName || node.nodeName.split(':').pop();

    if (localName === 'sp') {
      // Draw shape filled rectangle if solid fill is present
      const spPr = node.getElementsByTagName("p:spPr")[0] || node.querySelector("spPr");
      const xfrm = spPr?.getElementsByTagName("a:xfrm")[0] || spPr?.querySelector("xfrm");
      if (!xfrm) return;

      const off = xfrm.getElementsByTagName("a:off")[0] || xfrm.querySelector("off");
      const ext = xfrm.getElementsByTagName("a:ext")[0] || xfrm.querySelector("ext");
      if (!off || !ext) return;

      const x = parseInt(off.getAttribute("x")) * scale;
      const y = parseInt(off.getAttribute("y")) * scale;
      const w = parseInt(ext.getAttribute("cx")) * scale;
      const h = parseInt(ext.getAttribute("cy")) * scale;

      const solidFill = spPr.getElementsByTagName("a:solidFill")[0] || spPr.querySelector("solidFill");
      if (solidFill) {
        const srgbClr = solidFill.getElementsByTagName("a:srgbClr")[0] || solidFill.querySelector("srgbClr");
        if (srgbClr) {
          ctx.fillStyle = "#" + srgbClr.getAttribute("val");
          ctx.fillRect(x, y, w, h);
        }
      }

      // Draw paragraph texts inside shape
      const txBody = node.getElementsByTagName("p:txBody")[0] || node.querySelector("txBody");
      if (txBody) {
        const paragraphs = txBody.getElementsByTagName("a:p");
        let currentY = y + 10; // add small padding top

        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          const pPr = p.getElementsByTagName("a:pPr")[0] || p.querySelector("pPr");
          const align = pPr?.getAttribute("algn") || "l"; // l, ctr, r

          const runs = p.getElementsByTagName("a:r");
          let paraText = "";
          let fontSize = 16;
          let fontColor = "#000000";
          let isBold = false;
          let isItalic = false;

          for (let j = 0; j < runs.length; j++) {
            const run = runs[j];
            const rPr = run.getElementsByTagName("a:rPr")[0] || run.querySelector("rPr");
            if (rPr) {
              const sz = rPr.getAttribute("sz");
              if (sz) {
                const pt = parseInt(sz) / 100;
                fontSize = Math.round(pt * (canvasWidth / 720) * 0.95); // relative pt scale
              }
              const b = rPr.getAttribute("b");
              if (b === "1" || b === "true") isBold = true;
              const it = rPr.getAttribute("i");
              if (it === "1" || it === "true") isItalic = true;

              const srgbClr = rPr.getElementsByTagName("a:solidFill")[0]?.getElementsByTagName("a:srgbClr")[0] ||
                              rPr.querySelector("solidFill > srgbClr");
              if (srgbClr) {
                fontColor = "#" + srgbClr.getAttribute("val");
              }
            }

            const t = run.getElementsByTagName("a:t")[0] || run.querySelector("t");
            if (t) {
              paraText += t.textContent;
            }
          }

          if (paraText.trim() === "") continue;

          ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px Outfit, Arial, sans-serif`;
          ctx.fillStyle = fontColor;
          ctx.textBaseline = "top";

          // Simple word wrap
          const words = paraText.split(" ");
          let line = "";
          const lines = [];

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > w - 10 && n > 0) {
              lines.push(line);
              line = words[n] + " ";
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          for (const lineText of lines) {
            let drawX = x + 5; // offset padding
            const metrics = ctx.measureText(lineText);
            if (align === "ctr" || align === "center") {
              drawX = x + (w - metrics.width) / 2;
            } else if (align === "r" || align === "right") {
              drawX = x + w - metrics.width - 5;
            }
            ctx.fillText(lineText.trim(), drawX, currentY);
            currentY += fontSize * 1.25;
          }
          currentY += fontSize * 0.25; // spacing
        }
      }
    } else if (localName === 'pic') {
      // It's an image
      const blip = node.getElementsByTagName("p:blipFill")[0]?.getElementsByTagName("a:blip")[0] ||
                   node.querySelector("blipFill > blip");
      if (!blip) return;

      const rId = blip.getAttribute("r:embed") || blip.getAttribute("r:link");
      if (!rId || !relMap[rId]) return;

      const targetPath = relMap[rId];
      const imageZipPath = resolveTarget(targetPath);
      const imageFile = zip.file(imageZipPath);
      if (!imageFile) return;

      const imageBuffer = await imageFile.async("arraybuffer");
      const ext = imageZipPath.split('.').pop().toLowerCase();
      let mimeType = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'svg') mimeType = 'image/svg+xml';

      const blob = new Blob([imageBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const spPr = node.getElementsByTagName("p:spPr")[0] || node.querySelector("spPr");
      const xfrm = spPr?.getElementsByTagName("a:xfrm")[0] || spPr?.querySelector("xfrm");
      if (!xfrm) return;

      const off = xfrm.getElementsByTagName("a:off")[0] || xfrm.querySelector("off");
      const extNode = xfrm.getElementsByTagName("a:ext")[0] || xfrm.querySelector("ext");
      if (!off || !extNode) return;

      const x = parseInt(off.getAttribute("x")) * scale;
      const y = parseInt(off.getAttribute("y")) * scale;
      const w = parseInt(extNode.getAttribute("cx")) * scale;
      const h = parseInt(extNode.getAttribute("cy")) * scale;

      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, w, h);
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        img.onerror = () => {
          console.warn("Failed to load embedded image: " + imageZipPath);
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        img.src = blobUrl;
      });
    } else if (localName === 'grpSp') {
      // Group shape node - process nested children
      for (const child of Array.from(node.childNodes)) {
        await renderNode(child, ctx, relMap);
      }
    }
  };

  // 4. Parse and draw each slide in order
  for (const slideKey of slideKeys) {
    const slideXmlText = await zip.file(slideKey).async("text");
    const slideDoc = parser.parseFromString(slideXmlText, "application/xml");

    // Load relationships for mapping images (rIds)
    const relMap = {};
    const relsKey = `ppt/slides/_rels/${slideKey.split('/').pop()}.rels`;
    const relsFile = zip.file(relsKey);
    if (relsFile) {
      const relsText = await relsFile.async("text");
      const relsDoc = parser.parseFromString(relsText, "application/xml");
      const relElements = relsDoc.getElementsByTagName("Relationship");
      for (let i = 0; i < relElements.length; i++) {
        const rel = relElements[i];
        relMap[rel.getAttribute("Id")] = rel.getAttribute("Target");
      }
    }

    // Create Canvas to render the slide layout
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    // Default white background or slide-specific color
    let slideBg = "#ffffff";
    const bgNode = slideDoc.getElementsByTagName("p:bg")[0] || slideDoc.querySelector("bg");
    if (bgNode) {
      const srgbClr = bgNode.getElementsByTagName("a:srgbClr")[0] || bgNode.querySelector("srgbClr");
      if (srgbClr) {
        slideBg = "#" + srgbClr.getAttribute("val");
      }
    }
    ctx.fillStyle = slideBg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Recursively draw shapes, texts, and images in layout order
    const spTree = slideDoc.getElementsByTagName("p:spTree")[0] || slideDoc.querySelector("spTree");
    if (spTree) {
      for (const child of Array.from(spTree.childNodes)) {
        await renderNode(child, ctx, relMap);
      }
    }

    // Compress slide canvas to Jpeg image blob data
    const slideImgData = canvas.toDataURL("image/jpeg", 0.95);
    const slideImgBytes = await fetch(slideImgData).then(res => res.arrayBuffer());

    // Add visual canvas slide image as page to A4-scaled PDF Document
    const pdfImage = await pdfDoc.embedJpg(slideImgBytes);
    
    // Scale A4 width = 595 pt, height matching ratio
    const a4Width = 595;
    const a4Height = Math.round(595 * (slideHeight / slideWidth));
    
    const page = pdfDoc.addPage([a4Width, a4Height]);
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: a4Width,
      height: a4Height,
    });
  }

  // 5. Save generated PDF document bytes
  return await pdfDoc.save();
};
