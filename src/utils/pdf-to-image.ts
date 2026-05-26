import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Setup worker using Vite's ?url import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ConvertedImage {
  blob: Blob;
  filename: string;
}

/**
 * Converts each page of a PDF file into an image.
 * @param file The PDF File object to convert.
 * @returns Promise resolving to an array of image blobs and filenames.
 */
export async function convertPdfToImages(file: File): Promise<ConvertedImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const images: ConvertedImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // Scale 2 for higher resolution images
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not create canvas context');
    }
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;
    
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    
    if (blob) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      images.push({
        blob,
        filename: `${baseName}_page_${i}.png`
      });
    }
  }
  
  return images;
}

/**
 * Bundles images into a ZIP file and triggers a download.
 * @param images Array of converted images.
 * @param zipFilename The name of the resulting ZIP file.
 */
export async function downloadImagesAsZip(images: ConvertedImage[], zipFilename: string): Promise<void> {
  const zip = new JSZip();
  
  images.forEach((img) => {
    zip.file(img.filename, img.blob);
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFilename;
  link.click();
  
  // Delay revocation to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
