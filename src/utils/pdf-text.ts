import * as pdfjsLib from 'pdfjs-dist';

/**
 * Extracts all text from a PDF file.
 * @param file The PDF File object.
 * @returns Promise resolving to the extracted text.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return fullText;
}
