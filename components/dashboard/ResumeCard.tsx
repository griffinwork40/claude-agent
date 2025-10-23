// components/dashboard/ResumeCard.tsx
/**
 * Individual resume card component for the gallery
 * Shows thumbnail, filename, date with hover overlay for actions
 */

"use client";

import { useState } from 'react';
import { FileText, XCircle } from 'lucide-react';

interface Resume {
  id: string;
  file_name: string;
  file_size?: number;
  created_at: string;
  preview_text?: string | null;
}

interface ResumeCardProps {
  resume: Resume;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  onDownload: (id: string) => void;
}

export default function ResumeCard({ resume, onDelete, onView, onDownload }: ResumeCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase();
    return ext || 'FILE';
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete "${resume.file_name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(resume.id);
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
    }
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(resume.id);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload(resume.id);
  };

  return (
    <div className="relative aspect-[3/4] group rounded-lg overflow-hidden transition-all hover:shadow-lg">
      {/* Card Background */}
      <div className="h-full border-2 border-gray-200 bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6 flex flex-col items-center justify-center transition-colors group-hover:border-blue-300">
        {/* File Icon */}
        <div className="mb-4">
          <FileText className="h-16 w-16 text-blue-500" strokeWidth={1.5} />
        </div>

        {/* File Type Badge */}
        <div className="mb-3 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
          {getFileExtension(resume.file_name)}
        </div>

        {/* File Name */}
        <p className="text-sm font-medium text-center text-gray-900 truncate w-full px-2 mb-2">
          {resume.file_name}
        </p>

        {/* Upload Date */}
        <p className="text-xs text-gray-500">
          {formatDate(resume.created_at)}
        </p>

        {/* File Size */}
        {resume.file_size && (
          <p className="text-xs text-gray-400 mt-1">
            {formatFileSize(resume.file_size)}
          </p>
        )}
      </div>

      {/* Hover Overlay with Actions */}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 p-4">
        {/* View Button */}
        <button
          onClick={handleView}
          className="flex flex-col items-center gap-1 px-4 py-3 bg-white/90 hover:bg-white rounded-lg transition-all hover:scale-105 disabled:opacity-50"
          title="View Resume"
        >
          <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-xs font-medium text-gray-900">View</span>
        </button>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="flex flex-col items-center gap-1 px-4 py-3 bg-white/90 hover:bg-white rounded-lg transition-all hover:scale-105 disabled:opacity-50"
          title="Download Resume"
        >
          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="text-xs font-medium text-gray-900">Download</span>
        </button>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex flex-col items-center gap-1 px-4 py-3 bg-white/90 hover:bg-white rounded-lg transition-all hover:scale-105 disabled:opacity-50"
          title="Delete Resume"
        >
          <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs font-medium text-gray-900">
            {isDeleting ? 'Deleting...' : 'Delete'}
          </span>
        </button>
      </div>

      {/* Deleting Overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Deleting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
