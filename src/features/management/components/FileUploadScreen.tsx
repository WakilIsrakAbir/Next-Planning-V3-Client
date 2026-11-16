'use client';

import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  File,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { batchCanUploadBP, batchHasAction, markBatchDataStale } from '@/features/batch/lib/batch-navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import InlineSpinner from '@/components/ui/InlineSpinner';

/*
 * The list shows only the uploads whose stored copy is kept: the newest uploads of each category
 * (GET /api/files/all?scope=recent). Older copies are removed by the server after each successful upload;
 * their upload records stay as history and no planning data is ever touched.
 */
interface UploadRecord {
  _id: string;
  originalName: string;
  savedName: string;
  uploadedBy: string;
  role: string;
  category: string;
  size?: number;
  createdAt: string;
  parseStatus?: 'ok' | 'failed';
  parseError?: string;
  inUse: boolean;
}
interface RecentFiles {
  keepPerCategory: number;
  files: UploadRecord[];
  history: Record<string, { uploads: number; withoutCopy: number }>;
}

const CATEGORY_ORDER = ['General', 'YD', 'Knitting', 'Dyeing', 'Finishing', 'Delivery', 'BP'];
const CATEGORY_LABEL: Record<string, string> = {
  General: 'General Information & Planning',
  YD: 'Yarn Dyeing (YD)',
  Knitting: 'Knitting Production',
  Dyeing: 'Dyeing Production',
  Finishing: 'Finishing Production',
  Delivery: 'Delivery & Dispatch',
  BP: 'BP Data (Batch Plan)',
};

// Module-level cache for instant tab loading
let cachedRecentFiles: RecentFiles | null = null;

export default function FileUploadScreen() {
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [category, setCategory] = useState('General');
  const [uploading, setUploading] = useState(false);
  const [recent, setRecent] = useState<RecentFiles | null>(() => cachedRecentFiles);
  const [loading, setLoading] = useState(() => !cachedRecentFiles);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Batch Plan module: BP Data upload (permission actions.uploadBP; the server checks it too).
  // The dashboard renders pages only on the client (after the session check), so localStorage is readable here.
  const [canUploadBP] = useState(() => batchCanUploadBP());
  // Removing a stored copy: Admin or actions.deleteFiles (the server checks it too).
  const [canDelete] = useState(() => batchHasAction('deleteFiles'));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // The stored copies (null when the list could not be loaded).
  const requestRecent = async (): Promise<RecentFiles | null> => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/files/all?scope=recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? ((await res.json()) as RecentFiles) : null;
    } catch (err) {
      console.error('Failed to load file list:', err);
      return null;
    }
  };

  // Reload after an upload or a removed copy.
  const fetchFiles = async () => {
    const data = await requestRecent();
    if (data) {
      cachedRecentFiles = data;
      setRecent(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let live = true;
    requestRecent().then((data) => {
      if (!live) return;
      if (data) {
        cachedRecentFiles = data;
        setRecent(data);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
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

      // The server's message is shown as it is (e.g. a BP Data column that is missing).
      let data: { message?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error((data && data.message) || 'Upload error');
      }

      // New source data: the Batch Plan page reloads it the next time it is shown.
      markBatchDataStale();
      showToast(`File "${selectedFile.name}" successfully uploaded and parsed!`);
      setSelectedFile(null);
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Server error during upload.');
      fetchFiles(); // a file that could not be read is listed as failed
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: UploadRecord) => {
    if (
      !confirm(
        `Remove the stored copy of "${file.originalName}" (${formatDateDisplay(file.createdAt)})?\n\nThe upload history and all planning data stay.`
      )
    )
      return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/files/${file._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: { message?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.ok) {
        showToast((data && data.message) || 'The stored copy was removed.');
        fetchFiles();
      } else {
        setErrorMessage((data && data.message) || 'Could not remove the file copy.');
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // Download with the token in a header (not in the URL, where it would end up in history and logs).
  const downloadFile = async (file: UploadRecord) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/files/download/${encodeURIComponent(file.savedName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('The stored copy could not be downloaded.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const files = recent?.files || [];
  const history = recent?.history || {};
  const keep = recent?.keepPerCategory || 3;
  const categories = CATEGORY_ORDER.filter((c) => files.some((f) => (f.category || 'General') === c));
  files.forEach((f) => {
    const c = f.category || 'General';
    if (!categories.includes(c)) categories.push(c);
  });
  const olderWithoutCopy = Object.values(history).reduce((a, h) => a + (h.withoutCopy || 0), 0);
  const totalUploads = Object.values(history).reduce((a, h) => a + (h.uploads || 0), 0);

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
                {canUploadBP && <option value="BP">BP Data (Batch Plan)</option>}
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
                  <InlineSpinner size={14} /> Streaming to GridFS & Parsing...
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

      {/* Recent uploads: the stored copies */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-base-300 font-bold text-sm flex flex-wrap items-center justify-between gap-2">
          <span>Recent Uploads (latest {keep} per category)</span>
          <span className="text-xs text-base-content/60 font-normal">{files.length} stored copies</span>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th>Original File Name</th>
                <th>Status</th>
                <th>Uploaded By</th>
                <th>Uploaded At</th>
                <th>File Size</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <LoadingSpinner message="Loading Archives..." size="sm" overlay={false} />
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-base-content/60">
                    No files uploaded yet.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <React.Fragment key={cat}>
                    <tr className="bg-base-200/40">
                      <td colSpan={6} className="font-bold text-[11px] uppercase tracking-wide text-base-content/70">
                        {CATEGORY_LABEL[cat] || cat}
                        {history[cat] && (
                          <span className="font-normal normal-case tracking-normal text-base-content/50">
                            {' '}
                            · {history[cat].uploads.toLocaleString('en-US')} uploads in total
                          </span>
                        )}
                      </td>
                    </tr>
                    {files
                      .filter((f) => (f.category || 'General') === cat)
                      .map((file) => (
                        <tr key={file._id} className="hover">
                          <td className="font-semibold">
                            <span className="flex items-center gap-2">
                              <File className="w-4 h-4 text-primary shrink-0" />
                              {file.originalName}
                            </span>
                          </td>
                          <td>
                            {file.parseStatus === 'failed' ? (
                              <span className="badge badge-error badge-sm font-bold" title={file.parseError || ''}>
                                Could not be read
                              </span>
                            ) : file.inUse ? (
                              <span className="badge badge-success badge-sm font-bold">In use</span>
                            ) : (
                              <span className="badge badge-ghost badge-sm font-bold">Backup copy</span>
                            )}
                          </td>
                          <td>
                            {file.uploadedBy} ({file.role})
                          </td>
                          <td>{formatDateDisplay(file.createdAt)}</td>
                          <td>{((file.size || 0) / 1024).toFixed(1)} KB</td>
                          <td className="text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              <button
                                onClick={() => downloadFile(file)}
                                className="btn btn-ghost btn-xs text-primary"
                                title="Download Raw Excel"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {canDelete && !file.inUse && (
                                <button
                                  onClick={() => handleDeleteFile(file)}
                                  className="btn btn-ghost btn-xs text-error"
                                  title="Remove this stored copy (the history and planning data stay)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        {olderWithoutCopy > 0 && (
          <div className="px-4 py-3 border-t border-base-300 text-[11px] text-base-content/60">
            {olderWithoutCopy.toLocaleString('en-US')} older uploads (of {totalUploads.toLocaleString('en-US')}) are kept in the upload history; their
            stored file copies were removed to save database space. Their data is still in the plans.
          </div>
        )}
      </div>
    </div>
  );
}
