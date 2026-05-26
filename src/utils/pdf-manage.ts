import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// Setup worker using Vite's ?url import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PageThumbnail {
  index: number;
  dataUrl: string;
}

/**
 * Renders all pages of a PDF to thumbnails.
 */
export async function renderPdfPages(file: File): Promise<PageThumbnail[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const thumbnails: PageThumbnail[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 }); // Small thumbnails
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport, canvas: canvas }).promise;
      thumbnails.push({
        index: i - 1,
        dataUrl: canvas.toDataURL()
      });
    }
  }
  return thumbnails;
}

/**
 * Creates a new PDF with reordered/filtered pages.
 */
export async function reorderPdfPages(file: File, pageIndices: number[]): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  
  const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
  copiedPages.forEach(page => newPdf.addPage(page));
  
  return await newPdf.save();
}

/**
 * Parses a range string (e.g., "1-3, 5") into a list of 0-based indices.
 */
export function parseRange(rangeStr: string, maxPages: number): number[] {
  const indices: Set<number> = new Set();
  const parts = rangeStr.split(',').map(p => p.trim());
  
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        indices.add(num - 1);
      }
    }
  });
  
  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Splits PDF into multiple individual PDFs inside a ZIP.
 */
export async function splitAllPages(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const zip = new JSZip();
  const pageCount = pdfDoc.getPageCount();
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  for (let i = 0; i < pageCount; i++) {
    const singlePdf = await PDFDocument.create();
    const [page] = await singlePdf.copyPages(pdfDoc, [i]);
    singlePdf.addPage(page);
    const pdfBytes = await singlePdf.save();
    zip.file(`${baseName}_page_${i + 1}.pdf`, pdfBytes);
  }
  
  return await zip.generateAsync({ type: 'blob' });
}
