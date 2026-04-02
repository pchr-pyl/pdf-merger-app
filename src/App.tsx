import React, { useState } from 'react';
import { FileUp, FileText, X, Download, Loader2, CheckCircle2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mergePdfs } from './utils/pdf-logic';
import './App.css';

interface FileWithId {
  id: string;
  file: File;
}

const App: React.FC = () => {
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
        .filter(file => file.type === 'application/pdf')
        .map(file => ({ id: Math.random().toString(36).substr(2, 9), file }));
      setFiles(prev => [...prev, ...newFiles]);
      setMergedUrl(null);
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
      const newFiles = Array.from(e.dataTransfer.files)
        .filter(file => file.type === 'application/pdf')
        .map(file => ({ id: Math.random().toString(36).substr(2, 9), file }));
      setFiles(prev => [...prev, ...newFiles]);
      setMergedUrl(null);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app-container">
      <header>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          PDF Merger
        </motion.h1>
        <motion.p 
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          รวมไฟล์ PDF ของคุณได้อย่างรวดเร็วและปลอดภัยบนเบราว์เซอร์
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
          <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>ลากไฟล์ PDF มาวางที่นี่</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>หรือคลิกเพื่อเลือกไฟล์</p>
        </div>
        <input type="file" multiple accept=".pdf" onChange={onFileChange} />
      </motion.div>

      <div className="file-list">
        <AnimatePresence>
          {files.map(({ id, file }, index) => (
            <motion.div 
              key={id}
              className="file-item"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              layout
            >
              <div className="file-info">
                <FileText style={{ color: '#6366f1' }} size={20} />
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
            disabled={isMerging}
          >
            <Trash2 size={18} />
            ล้างทั้งหมด
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleMerge}
            disabled={files.length < 2 || isMerging}
          >
            {isMerging ? (
              <>
                <Loader2 className="loading-spinner" size={18} />
                กำลังรวมไฟล์...
              </>
            ) : (
              <>
                <Download size={18} />
                รวมไฟล์ PDF ({files.length})
              </>
            )}
          </button>
        </motion.div>
      )}

      {mergedUrl && !isMerging && (
        <motion.div 
          className="success-area"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <CheckCircle2 className="success-icon" />
          <h3 style={{ marginBottom: '0.5rem' }}>รวมไฟล์สำเร็จ!</h3>
          <p style={{ color: '#166534', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            ไฟล์ของคุณพร้อมใช้งานแล้ว ระบบได้เริ่มดาวน์โหลดให้คุณโดยอัตโนมัติ
          </p>
          <a href={mergedUrl} download={`merged_${new Date().getTime()}.pdf`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <Download size={18} />
            ดาวน์โหลดอีกครั้ง
          </a>
        </motion.div>
      )}
    </div>
  );
};

export default App;
