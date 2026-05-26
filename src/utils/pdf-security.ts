import { PDFDocument, rgb, degrees } from 'pdf-lib';

/**
 * Adds a diagonal text watermark to all pages of a PDF.
 */
export async function watermarkPdf(file: File, text: string): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 4,
      y: height / 2,
      size: 60,
      opacity: 0.3,
      rotate: degrees(45),
      color: rgb(0.5, 0.5, 0.5),
    });
  }
  
  return await pdfDoc.save();
}
