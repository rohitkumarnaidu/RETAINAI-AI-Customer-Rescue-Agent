// Simple tenant-isolated upload history stored in localStorage
// Each uploaded CSV is persisted as a "folder" entry so Data Hub can render
// a folder structure even without backend persistence.

export interface UploadEntry {
  id: string;
  filename: string;
  uploadDate: string; // ISO
  headers: string[];
  rows: Record<string, string>[];
  csvText: string;
  totalRows: number;
  created: number;
  skipped: number;
  tenantId: string;
  sizeKB: number;
  // mapping info if user mapped columns
  remappedHeaders?: string[];
  remappedRows?: Record<string, string>[];
  // backend result snapshot
  backendResult?: any;
}

const keyFor = (tenantId: string) => `retainai_uploads:${tenantId}`;
const MAX_STORED = 20; // keep last 20 uploads per tenant to avoid quota issues
const STORAGE_WARN_BYTES = 4 * 1024 * 1024; // 4MB warn

function getTenantId(): string {
  try {
    return localStorage.getItem('retainai_tenant_id') || localStorage.getItem('retainai_tenantId') || localStorage.getItem('tenant_id') || 'demo-tenant-001';
  } catch {
    return 'demo-tenant-001';
  }
}

export function getUploads(tenantId?: string): UploadEntry[] {
  const tid = tenantId || getTenantId();
  try {
    const raw = localStorage.getItem(keyFor(tid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // sort newest first
    return arr.sort((a: UploadEntry, b: UploadEntry) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  } catch {
    return [];
  }
}

export function saveUpload(entry: Omit<UploadEntry, 'id' | 'uploadDate' | 'tenantId'> & Partial<Pick<UploadEntry,'id'|'uploadDate'|'tenantId'>>): UploadEntry {
  const tid = (entry as any).tenantId || getTenantId();
  const now = new Date().toISOString();
  const id = (entry as any).id || `upl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const full: UploadEntry = {
    id,
    uploadDate: (entry as any).uploadDate || now,
    tenantId: tid,
    filename: entry.filename,
    headers: entry.headers || [],
    rows: entry.rows || [],
    csvText: entry.csvText || '',
    totalRows: entry.totalRows ?? (entry.rows?.length || 0),
    created: entry.created ?? 0,
    skipped: entry.skipped ?? 0,
    sizeKB: entry.sizeKB ?? 0,
    remappedHeaders: entry.remappedHeaders,
    remappedRows: entry.remappedRows,
    backendResult: entry.backendResult,
  };
  try {
    const existing = getUploads(tid);
    // avoid duplicates by filename+timestamp? just prepend
    const next = [full, ...existing].slice(0, MAX_STORED);
    const json = JSON.stringify(next);
    // quota check — if >4MB, drop oldest csvText
    if (json.length > STORAGE_WARN_BYTES) {
      // strip csvText from oldest entries
      for (let i = next.length - 1; i >= 0; i--) {
        if (json.length <= STORAGE_WARN_BYTES) break;
        // keep preview but trim csvText to 100kb
        if (next[i].csvText && next[i].csvText.length > 50_000) {
          next[i].csvText = next[i].csvText.slice(0, 50_000) + '\n...[truncated for storage]';
        }
      }
    }
    localStorage.setItem(keyFor(tid), JSON.stringify(next));
    // also emit event for listeners
    try { window.dispatchEvent(new CustomEvent('retainai_upload', { detail: full })); } catch {}
  } catch (e) {
    console.warn('saveUpload failed', e);
  }
  return full;
}

export function deleteUpload(id: string, tenantId?: string) {
  const tid = tenantId || getTenantId();
  try {
    const existing = getUploads(tid);
    const next = existing.filter(u => u.id !== id);
    localStorage.setItem(keyFor(tid), JSON.stringify(next));
    try { window.dispatchEvent(new CustomEvent('retainai_upload_deleted', { detail: { id, tenantId: tid } })); } catch {}
  } catch {}
}

export function clearUploads(tenantId?: string) {
  const tid = tenantId || getTenantId();
  try {
    localStorage.removeItem(keyFor(tid));
    try { window.dispatchEvent(new CustomEvent('retainai_uploads_cleared', { detail: { tenantId: tid } })); } catch {}
  } catch {}
}

// helper to format file size
export function formatSizeKB(kb: number) {
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb/1024).toFixed(2)} MB`;
}
