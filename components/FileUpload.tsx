
import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

const UploadIcon: React.FC = () => (
    <svg className="w-10 h-10 mb-4 text-slate-500" aria-hidden="true" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
    </svg>
);


const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
      setFileName(files[0].name);
    }
  }, [onFileSelect, disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
      setFileName(files[0].name);
    }
  };
  
  const borderColor = disabled ? 'border-slate-700' : isDragging ? 'border-sky-400' : 'border-slate-600 hover:border-slate-500';
  const textColor = disabled ? 'text-slate-600' : 'text-slate-400';

  return (
    <div className="flex items-center justify-center w-full">
      <label
        htmlFor="dropzone-file"
        className={`flex flex-col items-center justify-center w-full h-64 border-2 ${borderColor} border-dashed rounded-lg cursor-pointer bg-slate-800/50 transition-colors duration-300`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={`flex flex-col items-center justify-center pt-5 pb-6 ${textColor}`}>
          <UploadIcon />
          {fileName ? (
            <p className="text-lg text-green-400">{fileName}</p>
          ) : (
            <>
              <p className="mb-2 text-sm"><span className="font-semibold">Klicken zum Hochladen</span> oder per Drag & Drop ziehen</p>
              <p className="text-xs">Bilddateien (PNG, JPG, etc.)</p>
            </>
          )}
        </div>
        <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/*" disabled={disabled} />
      </label>
    </div>
  );
};

export default FileUpload;