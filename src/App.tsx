import React, { useState } from 'react';
import { FileUp, FileText, X, Download, Loader2, CheckCircle2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mergePdfs, imagesToPdf } from './utils/pdf-logic';
import { convertPdfToImages, downloadImagesAsZip, type ConvertedImage } from './utils/pdf-to-image';
import { extractTextFromPdf } from './utils/pdf-text';
import JSZip from 'jszip';
import './App.css';

interface FileWithId {
  id: string;
  file: File;
  thumbnailUrl?: string;
}

type Mode = 'merge' | 'convert' | 'image-to-pdf' | 'extract-text';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<Mode>('merge');
  const [isDragging, setIsDragging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);

  const processNewFiles = (incomingFiles: File[]) => {
    const validFiles = incomingFiles.filter(file => {
      if (mode === 'image-to-pdf') {
        return file.type.startsWith('image/');
      }
      return file.type === 'application/pdf';
    });

    const newFilesWithIds: FileWithId[] = validFiles.map(file => {
      const id = Math.random().toString(36).substr(2, 9);
      let thumbnailUrl: string | undefined;
      
      if (file.type.startsWith('image/')) {
        thumbnailUrl = URL.createObjectURL(file);
      }
      
      return { id, file, thumbnailUrl };
    });

    setFiles(prev => [...prev, ...newFilesWithIds]);
    setMergedUrl(null);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processNewFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processNewFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.thumbnailUrl) {
        URL.revokeObjectURL(fileToRemove.thumbnailUrl);
      }
      return prev.filter(f => f.id !== id);
    });
    setMergedUrl(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles(prev => {
      const newFiles = [...prev];
      const temp = newFiles[index];
      newFiles[index] = newFiles[index - 1];
      newFiles[index - 1] = temp;
      return newFiles;
    });
    setMergedUrl(null);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles(prev => {
      const newFiles = [...prev];
      const temp = newFiles[index];
      newFiles[index] = newFiles[index + 1];
      newFiles[index + 1] = temp;
      return newFiles;
    });
    setMergedUrl(null);
  };

  const clearAll = () => {
    setFiles([]);
    setMergedUrl(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    
    setIsMerging(true);
    try {
      const pdfBytes = await mergePdfs(files.map(f => f.file));
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setMergedUrl(url);
      
      // Auto download
      const link = document.createElement('a');
      link.href = url;
      link.download = `merged_${new Date().getTime()}.pdf`;
      link.click();
    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert('เกิดข้อผิดพลาดในการรวมไฟล์ PDF');
    } finally {
      setIsMerging(false);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    
    setIsConverting(true);
    try {
      const allImages: ConvertedImage[] = [];
      
      for (const fileItem of files) {
        const images = await convertPdfToImages(fileItem.file);
        allImages.push(...images);
      }
      
      const zipName = files.length === 1 
        ? `${files[0].file.name.replace(/\.[^/.]+$/, "")}_images.zip`
        : `converted_images_${new Date().getTime()}.zip`;
        
      // We don't use mergedUrl for conversion because it's a ZIP, 
      // but we set it to a dummy value to show the success state.
      // For a better experience, downloadImagesAsZip could return the URL.
      await downloadImagesAsZip(allImages, zipName);
      setMergedUrl('conversion-success');
    } catch (error) {
      console.error('Error converting PDFs:', error);
      alert('เกิดข้อผิดพลาดในการแปลงไฟล์ PDF เป็นรูปภาพ');
    } finally {
      setIsConverting(false);
    }
  };

  const handleImageToPdf = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    try {
      const pdfBytes = await imagesToPdf(files.map(f => f.file));
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setMergedUrl(url);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `images_to_pdf_${new Date().getTime()}.pdf`;
      link.click();
    } catch (error) {
      console.error('Error creating PDF from images:', error);
      alert('เกิดข้อผิดพลาดในการรวมรูปภาพเป็น PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractText = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    try {
      if (files.length === 1) {
        const text = await extractTextFromPdf(files[0].file);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${files[0].file.name.replace(/\.[^/.]+$/, "")}.txt`;
        link.click();
      } else {
        const zip = new JSZip();
        for (const fileItem of files) {
          const text = await extractTextFromPdf(fileItem.file);
          zip.file(`${fileItem.file.name.replace(/\.[^/.]+$/, "")}.txt`, text);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `extracted_text_${new Date().getTime()}.zip`;
        link.click();
      }
      setMergedUrl('extraction-success');
    } catch (error) {
      console.error('Error extracting text:', error);
      alert('เกิดข้อผิดพลาดในการดึงข้อความจาก PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    clearAll(); // Clear files when switching modes to avoid mixing
    setMode(newMode);
    setMergedUrl(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app-container">
      <div className="tabs">
        <button 
          className={`tab-btn ${mode === 'merge' ? 'active' : ''}`}
          onClick={() => handleModeChange('merge')}
        >
          รวม PDF
        </button>
        <button 
          className={`tab-btn ${mode === 'convert' ? 'active' : ''}`}
          onClick={() => handleModeChange('convert')}
        >
          PDF เป็นภาพ
        </button>
        <button 
          className={`tab-btn ${mode === 'image-to-pdf' ? 'active' : ''}`}
          onClick={() => handleModeChange('image-to-pdf')}
        >
          ภาพ เป็น PDF
        </button>
        <button 
          className={`tab-btn ${mode === 'extract-text' ? 'active' : ''}`}
          onClick={() => handleModeChange('extract-text')}
        >
          ดึงข้อความ
        </button>
      </div>

      <header>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          PDF Tools
        </motion.h1>
        <motion.p 
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {mode === 'merge' && 'รวมไฟล์ PDF ของคุณได้อย่างรวดเร็วและปลอดภัย'}
          {mode === 'convert' && 'แปลงหน้า PDF เป็นรูปภาพ PNG และดาวน์โหลดเป็นไฟล์ ZIP'}
          {mode === 'image-to-pdf' && 'รวมรูปภาพ PNG/JPG ของคุณเป็นไฟล์ PDF ไฟล์เดียว'}
          {mode === 'extract-text' && 'ดึงข้อความออกมาจากไฟล์ PDF และดาวน์โหลดเป็นไฟล์ .txt'}
        </motion.p>
      </header>

      <motion.div 
        className={`dropzone ${isDragging ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <FileUp className="dropzone-icon" />
        <div className="dropzone-text">
          <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {mode === 'image-to-pdf' ? 'ลากรูปภาพมาวางที่นี่' : 'ลากไฟล์ PDF มาวางที่นี่'}
          </p>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>หรือคลิกเพื่อเลือกไฟล์</p>
        </div>
        <input 
          type="file" 
          multiple 
          accept={mode === 'image-to-pdf' ? 'image/png, image/jpeg' : '.pdf'} 
          onChange={onFileChange} 
        />
      </motion.div>

      <div className="file-list">
        <AnimatePresence>
          {files.map(({ id, file, thumbnailUrl }, index) => (
            <motion.div 
              key={id}
              className="file-item"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              layout
            >
              <div className="file-info">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="preview" className="file-thumbnail" />
                ) : (
                  <FileText style={{ color: '#6366f1' }} size={20} />
                )}
                <div>
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">{formatSize(file.size)}</div>
                </div>
              </div>
              <div className="file-item-actions">
                <button 
                  className="reorder-btn" 
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <ChevronUp size={18} />
                </button>
                <button 
                  className="reorder-btn" 
                  onClick={() => moveDown(index)}
                  disabled={index === files.length - 1}
                >
                  <ChevronDown size={18} />
                </button>
                <button className="remove-btn" onClick={() => removeFile(id)}>
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {files.length > 0 && (
        <motion.div 
          className="actions"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button 
            className="btn btn-secondary" 
            onClick={clearAll}
            disabled={isMerging || isConverting || isProcessing}
          >
            <Trash2 size={18} />
            ล้างทั้งหมด
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              if (mode === 'merge') handleMerge();
              else if (mode === 'convert') handleConvert();
              else if (mode === 'image-to-pdf') handleImageToPdf();
              else if (mode === 'extract-text') handleExtractText();
            }}
            disabled={
              (mode === 'merge' ? files.length < 2 : files.length < 1) || 
              isMerging || isConverting || isProcessing
            }
          >
            {isMerging || isConverting || isProcessing ? (
              <>
                <Loader2 className="loading-spinner" size={18} />
                กำลังประมวลผล...
              </>
            ) : (
              <>
                <Download size={18} />
                {mode === 'merge' && `รวมไฟล์ PDF (${files.length})`}
                {mode === 'convert' && `แปลงเป็นรูปภาพ (${files.length})`}
                {mode === 'image-to-pdf' && `แปลงเป็น PDF (${files.length})`}
                {mode === 'extract-text' && `ดึงข้อความ (${files.length})`}
              </>
            )}
          </button>
        </motion.div>
      )}

      {mergedUrl && !isMerging && !isConverting && !isProcessing && (
        <motion.div 
          className="success-area"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <CheckCircle2 className="success-icon" />
          <h3 style={{ marginBottom: '0.5rem' }}>สำเร็จ!</h3>
          <p style={{ color: '#166534', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            ไฟล์ของคุณพร้อมใช้งานแล้ว ระบบได้เริ่มดาวน์โหลดให้คุณโดยอัตโนมัติ
          </p>
          {mergedUrl.startsWith('blob:') && (
            <a 
              href={mergedUrl} 
              download={
                mode === 'image-to-pdf' 
                  ? `images_to_pdf_${new Date().getTime()}.pdf` 
                  : `merged_${new Date().getTime()}.pdf`
              } 
              className="btn btn-primary" 
              style={{ textDecoration: 'none' }}
            >
              <Download size={18} />
              ดาวน์โหลดอีกครั้ง
            </a>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default App;
