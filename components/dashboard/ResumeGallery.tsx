// components/dashboard/ResumeGallery.tsx
/**
 * Main resume gallery component with 3-column grid
 * Displays all user resumes with upload button
 */

"use client";

import { useState, useEffect } from 'react';
import ResumeCard from './ResumeCard';
import ResumeUploadDialog from './ResumeUploadDialog';
import { FileText } from 'lucide-react';

interface Resume {
  id: string;
  file_name: string;
  file_size?: number;
  created_at: string;
  preview_text?: string | null;
}

export default function ResumeGallery() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  // Fetch resumes on mount
  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/resumes');
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }

      const data = await response.json();
      setResumes(data.resumes || []);
    } catch (err) {
      console.error('Error fetching resumes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load resumes');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (id: string) => {
    try {
      const response = await fetch(`/api/user/resumes/${id}`);
      if (!response.ok) {
        throw new Error('Failed to get resume URL');
      }

      const data = await response.json();
      window.open(data.signed_url, '_blank');
    } catch (err) {
      console.error('Error viewing resume:', err);
      alert('Failed to open resume. Please try again.');
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`/api/user/resumes/${id}`);
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      
      // Create a temporary link and click it to trigger download
      const link = document.createElement('a');
      link.href = data.signed_url;
      link.download = data.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading resume:', err);
      alert('Failed to download resume. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/user/resumes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete resume');
      }

      // Remove from local state
      setResumes(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting resume:', err);
      alert('Failed to delete resume. Please try again.');
      throw err; // Re-throw to keep deleting state in ResumeCard
    }
  };

  const handleUploadSuccess = (newResume: Resume) => {
    // Add new resume to the beginning of the list
    setResumes(prev => [newResume, ...prev]);
    setIsUploadDialogOpen(false);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Your Resumes</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-[3/4] bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Resumes</h2>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchResumes}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Your Resumes</h2>
            <p className="text-sm text-gray-600 mt-1">
              {resumes.length === 0 
                ? 'Upload your first resume to get started' 
                : `${resumes.length} resume${resumes.length !== 1 ? 's' : ''} stored`
              }
            </p>
          </div>
          <button
            onClick={() => setIsUploadDialogOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <span className="text-lg">+</span>
            Upload Resume
          </button>
        </div>

        {/* Empty State */}
        {resumes.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
            <div className="flex justify-center mb-4">
              <FileText className="h-16 w-16 text-gray-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No resumes yet
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
              Upload your resumes here to manage them all in one place. You can upload multiple versions tailored for different roles.
            </p>
            <button
              onClick={() => setIsUploadDialogOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Upload Your First Resume
            </button>
          </div>
        ) : (
          /* Resume Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map(resume => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                onView={handleView}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <ResumeUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}
