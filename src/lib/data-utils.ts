// ==========================================================
// High-Performance Data Extraction & Column Lookup Utilities
// Using WeakMap row-level caching and Map key normalization
// ==========================================================

const _normCache = new Map<string, string>();

/**
 * Normalizes a key string by lowercasing and removing non-alphanumeric characters.
 * Cached in memory so each distinct key string is only normalized once.
 */
export function _norm(key: any): string {
  if (key === undefined || key === null) return '';
  const s = String(key);
  let n = _normCache.get(s);
  if (n !== undefined) return n;
  n = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  _normCache.set(s, n);
  return n;
}

const _rowMapCache = new WeakMap<object, Record<string, string>>();

/**
 * Builds and caches a normalized-key -> original-key lookup dictionary for an object.
 * Uses WeakMap so the cache entry is automatically garbage-collected when the row object is freed.
 */
export function _getRowMap(row: any): Record<string, string> {
  if (!row || typeof row !== 'object') return {};
  let map = _rowMapCache.get(row);
  if (map) return map;

  map = {};
  for (const rk of Object.keys(row)) {
    map[_norm(rk)] = rk;
  }
  _rowMapCache.set(row, map);
  return map;
}

/**
 * Fast O(1) column value extractor matching any of the candidate keys against row properties.
 * Handles case-insensitivity, spaces, and punctuation variations efficiently.
 */
export function getColData(row: any, candidates: string[], defaultValue: any = ''): any {
  if (!row || typeof row !== 'object') return defaultValue;

  // 1. Check exact candidate key match first (fastest path)
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (row[c] !== undefined && row[c] !== null && row[c] !== '') {
      return row[c];
    }
  }

  // 2. Fall back to cached normalized key lookup
  const map = _getRowMap(row);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const actualKey = map[_norm(c)];
    if (actualKey !== undefined) {
      const val = row[actualKey];
      if (val !== undefined && val !== null && val !== '') {
        return val;
      }
    }
  }

  // 3. Check nested itemData if present
  if (row.itemData && typeof row.itemData === 'object') {
    const nestedVal = getColData(row.itemData, candidates, null);
    if (nestedVal !== null && nestedVal !== undefined && nestedVal !== '') {
      return nestedVal;
    }
  }

  return defaultValue;
}
