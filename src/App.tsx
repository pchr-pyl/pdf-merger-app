import React, { useState, useEffect } from 'react';
import { 
  FileUp, FileText, X, Download, Loader2, CheckCircle2, 
  Trash2, Layout, Shield, 
  FileStack, ArrowLeft, ArrowRight,
  Zap, Image as ImageIcon, FileImage, Type, Scissors
} from 'lucide-react';
import { motion } from 'framer-motion';
import { mergePdfs, imagesToPdf } from './utils/pdf-logic';
import { convertPdfToImages, downloadImagesAsZip } from './utils/pdf-to-image';
import { extractTextFromPdf } from './utils/pdf-text';
import { renderPdfPages, reorderPdfPages, splitAllPages, parseRange, type PageThumbnail } from './utils/pdf-manage';
import { watermarkPdf } from './utils/pdf-security';
import JSZip from 'jszip';
import './App.css';

interface FileWithId {
  id: string;
  file: File;
  thumbnailUrl?: string;
}

type Category = 'combine' | 'manage' | 'security';
type Mode = 
  | 'merge' | 'convert' | 'image-to-pdf' | 'extract-text' 
  | 'organize' | 'split' 
  | 'watermark';

const App: React.FC = () => {
  const [category, setCategory] = useState<Category>('combine');
  const [mode, setMode] = useState<Mode>('merge');
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);

  // Tool Specific States
  const [pageThumbnails, setPageThumbnails] = useState<PageThumbnail[]>([]);
  const [watermarkText, setWatermarkText] = useState('');
  const [splitRange, setSplitRange] = useState('');
  const [splitMode, setSplitMode] = useState<'range' | 'all'>('range');

  useEffect(() => {
    if (mode === 'organize' && files.length === 1) {
      loadThumbnails();
    } else {
      setPageThumbnails([]);
    }
  }, [files, mode]);

  const loadThumbnails = async () => {
    setIsProcessing(true);
    try {
      const thumbs = await renderPdfPages(files[0].file);
      setPageThumbnails(thumbs);
    } catch (error) {
      console.error('Error loading thumbnails:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processNewFiles = (incomingFiles: File[]) => {
    const singleFileModes: Mode[] = ['organize', 'split', 'watermark'];
    const isSingleMode = singleFileModes.includes(mode);

    const validFiles = incomingFiles.filter(file => {
      if (mode === 'image-to-pdf') return file.type.startsWith('image/');
      return file.type === 'application/pdf';
    });

    const newFilesWithIds: FileWithId[] = validFiles.map(file => {
      const id = Math.random().toString(36).substr(2, 9);
      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('image/')) thumbnailUrl = URL.createObjectURL(file);
      return { id, file, thumbnailUrl };
    });

    if (isSingleMode) {
      files.forEach(f => f.thumbnailUrl && URL.revokeObjectURL(f.thumbnailUrl));
      setFiles(newFilesWithIds.slice(0, 1));
    } else {
      setFiles(prev => [...prev, ...newFilesWithIds]);
    }
    setMergedUrl(null);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processNewFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processNewFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.thumbnailUrl) URL.revokeObjectURL(fileToRemove.thumbnailUrl);
      return prev.filter(f => f.id !== id);
    });
    setMergedUrl(null);
  };

  const clearAll = () => {
    files.forEach(f => f.thumbnailUrl && URL.revokeObjectURL(f.thumbnailUrl));
    setFiles([]);
    setMergedUrl(null);
    setWatermarkText('');
    setSplitRange('');
  };

  const handleModeChange = (newMode: Mode) => {
    clearAll();
    setMode(newMode);
  };

  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    if (newCat === 'combine') handleModeChange('merge');
    else if (newCat === 'manage') handleModeChange('organize');
    else if (newCat === 'security') handleModeChange('watermark');
  };

  const handleAction = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      let result: Uint8Array | Blob | null = null;
      let downloadName = `output_${new Date().getTime()}.pdf`;

      switch (mode) {
        case 'merge':
          result = await mergePdfs(files.map(f => f.file));
          downloadName = `merged_${new Date().getTime()}.pdf`;
          break;
        case 'image-to-pdf':
          result = await imagesToPdf(files.map(f => f.file));
          downloadName = `images_to_pdf_${new Date().getTime()}.pdf`;
          break;
        case 'convert':
          const images = [];
          for (const f of files) images.push(...(await convertPdfToImages(f.file)));
          await downloadImagesAsZip(images, `images_${new Date().getTime()}.zip`);
          setMergedUrl('success');
          return;
        case 'extract-text':
          if (files.length === 1) {
            const text = await extractTextFromPdf(files[0].file);
            result = new Blob([text], { type: 'text/plain' });
            downloadName = `${files[0].file.name.replace(/\.[^/.]+$/, "")}.txt`;
          } else {
            const zip = new JSZip();
            for (const f of files) zip.file(`${f.file.name.replace(/\.[^/.]+$/, "")}.txt`, await extractTextFromPdf(f.file));
            result = await zip.generateAsync({ type: 'blob' });
            downloadName = `text_${new Date().getTime()}.zip`;
          }
          break;
        case 'organize':
          result = await reorderPdfPages(files[0].file, pageThumbnails.map(t => t.index));
          downloadName = `organized_${files[0].file.name}`;
          break;
        case 'split':
          if (splitMode === 'range') {
            const indices = parseRange(splitRange, pageThumbnails.length || 1000);
            result = await reorderPdfPages(files[0].file, indices);
            downloadName = `split_${files[0].file.name}`;
          } else {
            result = await splitAllPages(files[0].file);
            downloadName = `split_all_${files[0].file.name.replace(/\.[^/.]+$/, "")}.zip`;
          }
          break;
        case 'watermark':
          result = await watermarkPdf(files[0].file, watermarkText);
          downloadName = `watermarked_${files[0].file.name}`;
          break;
      }

      if (result) {
        const blob = result instanceof Blob ? result : new Blob([result as any], { type: downloadName.endsWith('.zip') ? 'application/zip' : 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setMergedUrl(url);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        link.click();
      }
    } catch (error: any) {
      console.error('Action error:', error);
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'โปรดตรวจสอบความถูกต้องของไฟล์'));
    } finally {
      setIsProcessing(false);
    }
  };

  const moveThumbnail = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pageThumbnails.length) return;
    const newThumbs = [...pageThumbnails];
    const [movedItem] = newThumbs.splice(fromIndex, 1);
    newThumbs.splice(toIndex, 0, movedItem);
    setPageThumbnails(newThumbs);
  };

  const removeThumbnail = (index: number) => {
    setPageThumbnails(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="app-container">
      <div className="category-tabs">
        <button className={category === 'combine' ? 'active' : ''} onClick={() => handleCategoryChange('combine')}>
          <Zap size={18} /> รวม/แปลง
        </button>
        <button className={category === 'manage' ? 'active' : ''} onClick={() => handleCategoryChange('manage')}>
          <Layout size={18} /> จัดการหน้า
        </button>
        <button className={category === 'security' ? 'active' : ''} onClick={() => handleCategoryChange('security')}>
          <Shield size={18} /> ลายน้ำ
        </button>
      </div>

      <div className="tabs secondary-tabs">
        {category === 'combine' && (
          <>
            <button className={mode === 'merge' ? 'active' : ''} onClick={() => handleModeChange('merge')}>
              <FileStack size={16} /> รวม PDF
            </button>
            <button className={mode === 'convert' ? 'active' : ''} onClick={() => handleModeChange('convert')}>
              <ImageIcon size={16} /> PDF เป็นภาพ
            </button>
            <button className={mode === 'image-to-pdf' ? 'active' : ''} onClick={() => handleModeChange('image-to-pdf')}>
              <FileImage size={16} /> ภาพ เป็น PDF
            </button>
            <button className={mode === 'extract-text' ? 'active' : ''} onClick={() => handleModeChange('extract-text')}>
              <Type size={16} /> ดึงข้อความ
            </button>
          </>
        )}
        {category === 'manage' && (
          <>
            <button className={mode === 'organize' ? 'active' : ''} onClick={() => handleModeChange('organize')}>
              <Layout size={16} /> จัดเรียง/ลบหน้า
            </button>
            <button className={mode === 'split' ? 'active' : ''} onClick={() => handleModeChange('split')}>
              <Scissors size={16} /> แยกไฟล์
            </button>
          </>
        )}
        {category === 'security' && (
          <>
            <button className={mode === 'watermark' ? 'active' : ''} onClick={() => handleModeChange('watermark')}>
              <Type size={16} /> เพิ่มลายน้ำ
            </button>
          </>
        )}
      </div>

      <header>
        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>PDF Tools</motion.h1>
        <p className="subtitle">
          {mode === 'merge' && 'รวมหลายไฟล์ PDF เป็นไฟล์เดียว'}
          {mode === 'convert' && 'แปลงทุกหน้าใน PDF เป็นไฟล์ภาพ PNG'}
          {mode === 'image-to-pdf' && 'รวมรูปภาพเป็นไฟล์ PDF'}
          {mode === 'extract-text' && 'ดึงเนื้อหาข้อความออกจาก PDF'}
          {mode === 'organize' && 'สลับลำดับหน้าหรือลบหน้าบางส่วนออก'}
          {mode === 'split' && 'แยกไฟล์ PDF ตามช่วงหน้าที่ต้องการ'}
          {mode === 'watermark' && 'เพิ่มข้อความลายน้ำลงในทุกหน้า'}
        </p>
      </header>

      {files.length === 0 ? (
        <motion.div 
          className={`dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <FileUp className="dropzone-icon" />
          <div className="dropzone-text">
            <p style={{ fontWeight: 600 }}>{mode === 'image-to-pdf' ? 'ลากรูปภาพมาวางที่นี่' : 'ลากไฟล์ PDF มาวางที่นี่'}</p>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>หรือคลิกเพื่อเลือกไฟล์</p>
          </div>
          <input type="file" multiple={category === 'combine'} accept={mode === 'image-to-pdf' ? 'image/*' : '.pdf'} onChange={onFileChange} />
        </motion.div>
      ) : (
        <div className="workspace">
          {mode === 'organize' ? (
            <div className="page-grid">
              {pageThumbnails.map((thumb, i) => (
                <div key={thumb.index} className="page-item">
                  <div className="page-num">{i + 1}</div>
                  <img src={thumb.dataUrl} alt={`Page ${i + 1}`} />
                  <div className="page-actions">
                    <button onClick={() => moveThumbnail(i, i - 1)} disabled={i === 0}><ArrowLeft size={14} /></button>
                    <button onClick={() => moveThumbnail(i, i + 1)} disabled={i === pageThumbnails.length - 1}><ArrowRight size={14} /></button>
                    <button className="delete" onClick={() => removeThumbnail(i)}><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="file-list">
              {files.map(({ id, file, thumbnailUrl }) => (
                <div key={id} className="file-item">
                  <div className="file-info">
                    {thumbnailUrl ? <img src={thumbnailUrl} className="file-thumbnail" alt="" /> : <FileText size={20} color="#6366f1" />}
                    <div>
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button className="remove-btn" onClick={() => removeFile(id)}><X size={18} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="tool-inputs">
            {mode === 'watermark' && <input type="text" placeholder="พิมพ์ข้อความลายน้ำ..." value={watermarkText} onChange={e => setWatermarkText(e.target.value)} />}
            {mode === 'split' && (
              <div className="split-options">
                <div className="split-modes">
                  <label><input type="radio" checked={splitMode === 'range'} onChange={() => setSplitMode('range')} /> ช่วงหน้า</label>
                  <label><input type="radio" checked={splitMode === 'all'} onChange={() => setSplitMode('all')} /> แยกทุกหน้า</label>
                </div>
                {splitMode === 'range' && <input type="text" placeholder="เช่น 1-3, 5" value={splitRange} onChange={e => setSplitRange(e.target.value)} />}
              </div>
            )}
          </div>

          <div className="actions">
            <button className="btn btn-secondary" onClick={clearAll} disabled={isProcessing}><Trash2 size={18} /> ล้าง</button>
            <button className="btn btn-primary" onClick={handleAction} disabled={isProcessing || (mode === 'merge' && files.length < 2)}>
              {isProcessing ? <><Loader2 className="loading-spinner" size={18} /> กำลังทำ...</> : <><Download size={18} /> เริ่มทำงาน</>}
            </button>
          </div>
        </div>
      )}

      {mergedUrl && !isProcessing && (
        <motion.div className="success-area" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <CheckCircle2 className="success-icon" />
          <h3>ทำรายการสำเร็จ!</h3>
          <p>ระบบกำลังดาวน์โหลดไฟล์ให้คุณอัตโนมัติ</p>
          {mergedUrl.startsWith('blob:') && <a href={mergedUrl} download={`output_${Date.now()}.pdf`} className="btn btn-primary">โหลดอีกครั้ง</a>}
        </motion.div>
      )}
    </div>
  );
};

export default App;
