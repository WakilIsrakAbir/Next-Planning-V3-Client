'use client';

import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  File,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';

export default function FileUploadPage() {
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [category, setCategory] = useState('General');
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/files/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Failed to load file list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select an Excel file to upload.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('category', category);

      const res = await fetch(`${API_BASE}/api/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'File upload failed.');
      }

      setToastMessage(`File "${selectedFile.name}" successfully uploaded and parsed!`);
      setSelectedFile(null);
      setTimeout(() => setToastMessage(null), 3000);
      fetchFiles();
    } catch (err: any) {
      setErrorMessage(err.message || 'Server error during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete file record "${name}" from GridFS?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setToastMessage(`File deleted successfully.`);
        setTimeout(() => setToastMessage(null), 3000);
        fetchFiles();
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const downloadFile = (filename: string) => {
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/api/files/download/${filename}?token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success text-xs font-bold text-white shadow-lg">
            <CheckCircle className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" />
          Source Workbook Upload (GridFS Storage)
        </h2>
        <p className="text-xs text-base-content/60">
          Upload General Information and Department Excel workbooks for automatic database parsing and synchronization.
        </p>
      </div>

      {/* Upload Dropzone Card */}
      <div className="card bg-base-100 border border-base-300 p-6 shadow-sm">
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Select */}
            <div className="form-control">
              <label className="label font-bold text-xs">Workbook Department Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select select-bordered select-sm font-semibold text-xs"
              >
                <option value="General">General Information & Planning</option>
                <option value="Knitting">Knitting Production</option>
                <option value="Dyeing">Dyeing Production</option>
                <option value="Finishing">Finishing Production</option>
                <option value="Delivery">Delivery & Dispatch</option>
                <option value="YD">Yarn Dyeing (YD)</option>
              </select>
            </div>

            {/* File Input */}
            <div className="form-control">
              <label className="label font-bold text-xs">Select Spreadsheet (.xlsx, .xls)</label>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="file-input file-input-bordered file-input-sm w-full text-xs"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="alert alert-error text-xs font-bold py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="btn btn-primary btn-sm font-bold shadow-md shadow-primary/25"
            >
              {uploading ? (
                <>
                  <span className="loading loading-spinner loading-xs" /> Streaming to GridFS & Parsing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-1" /> Upload & Synchronize Orders
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* File Archives Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-base-300 font-bold text-sm flex items-center justify-between">
          <span>GridFS Upload Archives</span>
          <span className="text-xs text-base-content/60 font-normal">Total {files.length} files cataloged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th>Original File Name</th>
                <th>Category</th>
                <th>Uploaded By</th>
                <th>Uploaded At</th>
                <th>File Size</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-base-content/60">
                    No files uploaded yet.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file._id} className="hover">
                    <td className="font-semibold flex items-center gap-2">
                      <File className="w-4 h-4 text-primary" />
                      {file.originalName}
                    </td>
                    <td>
                      <span className="badge badge-outline badge-sm font-bold">{file.category}</span>
                    </td>
                    <td>{file.uploadedBy} ({file.role})</td>
                    <td>{formatDateDisplay(file.createdAt)}</td>
                    <td>{((file.size || 0) / 1024).toFixed(1)} KB</td>
                    <td className="text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => downloadFile(file.savedName)}
                        className="btn btn-ghost btn-xs text-primary"
                        title="Download Raw Excel"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file._id, file.originalName)}
                        className="btn btn-ghost btn-xs text-error"
                        title="Delete from GridFS"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
