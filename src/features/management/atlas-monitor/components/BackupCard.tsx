'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import type { MonitorStats } from '@/features/management/atlas-monitor/types';
import { errorText, fmtDateTime, fmtMB } from '@/features/management/atlas-monitor/lib/format';

export function BackupCard({ stats, onDone }: { stats: MonitorStats; onDone: () => void }) {
  const [includeFiles, setIncludeFiles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const last = stats.backups?.last;
  const copies = (stats.collections || []).filter((c) => c.name.startsWith('uploads.')).reduce((a, c) => a + c.size, 0);
  const total = (stats.collections || []).reduce((a, c) => a + c.size, 0);

  const download = async () => {
    setBusy(true);
    setStatus('Preparing backup…');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/monitor/backup?files=${includeFiles ? '1' : '0'}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || !res.body) {
        let msg = 'Backup failed.';
        try {
          msg = (await res.json()).message || msg;
        } catch {}
        throw new Error(msg);
      }
      const name = (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '') || [])[1] || 'abir_group_backup.jsonl.gz';
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        setStatus(`Downloading… ${fmtMB(got)}`);
      }
      const blob = new Blob(parts as BlobPart[], { type: 'application/gzip' });
      // A complete backup ends with its "end" line; check before saving (browsers that cannot unzip skip this).
      if (typeof DecompressionStream === 'function') {
        setStatus('Checking the file…');
        const text = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
        const lastLine = text.trimEnd().split('\n').pop() || '';
        if (!lastLine.startsWith('{"type":"end"')) throw new Error('The download is incomplete. Please try again.');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(`Saved ${name} (${fmtMB(blob.size)}). Keep this file private.`);
      setTimeout(onDone, 800); // show it as the last backup
    } catch (e: unknown) {
      setStatus(errorText(e, 'Backup failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 font-bold">
        <Download className="w-4 h-4" style={{ color: 'var(--am-s1)' }} /> Database backup
      </div>
      <p className="text-xs text-base-content/70 leading-relaxed">
        Downloads the whole database as one file to this PC. Keep it private: it holds all business data and the users&apos; password hashes.
      </p>
      <div className="text-xs text-base-content/70">
        {last ? `Last backup: ${fmtDateTime(last.at)} by ${last.by || '-'} (${fmtMB(last.bytes)})` : 'Last backup: none from this page yet'}
      </div>
      {stats.canDownloadBackup ? (
        <>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-xs" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} />
            Include stored Excel copies ({fmtMB(copies)} of {fmtMB(total)} data)
          </label>
          <button type="button" className="am-btn-primary self-start" onClick={download} disabled={busy}>
            <Download className="w-3.5 h-3.5" /> Download backup
          </button>
          <div className="text-xs text-base-content/70 min-h-4" role="status">
            {status}
          </div>
        </>
      ) : (
        <p className="text-xs text-base-content/50">Only an Admin can download backups.</p>
      )}
    </div>
  );
}
