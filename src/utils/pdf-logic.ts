import { PDFDocument } from 'pdf-lib';

/**
 * Merges multiple PDF files into a single PDF.
 * @param files Array of File objects representing PDF files.
 * @returns Promise that resolves to a Uint8Array containing the merged PDF data.
 */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  return mergedPdfBytes;
}
