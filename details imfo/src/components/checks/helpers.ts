import { useEffect, useState } from 'react';
import type { Finding } from '../../services/api';
import type { Severity } from '../../types';
import { STORE_EVENT } from '../../data/repositoryStore';

/** Re-render when saved code-check results change (reads happen during render). */
export function useStoreUpdates(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(STORE_EVENT, refresh);
    return () => window.removeEventListener(STORE_EVENT, refresh);
  }, []);
}

/** The API client throws either Error objects or `{ error: { code, message } }`. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const apiError = (err as { error?: { message?: string } } | null)?.error;
  if (apiError?.message) return apiError.message;
  return 'Something went wrong. Check that the backend is running and try again.';
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'informational'];

export function sortBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export function findingLocation(f: Finding): string {
  return f.end_line && f.end_line !== f.start_line ? `${f.file_path}:${f.start_line}-${f.end_line}` : `${f.file_path}:${f.start_line}`;
}

/** "Now" captured once per page view, for relative times like "3h ago". */
export function useNow(): string {
  const [now] = useState(() => new Date().toISOString());
  return now;
}
