/**
 * Server mode. When the site is served together with the Bgame data server (deploy/setup-api.sh),
 * the child signs in with name + school + a 4-digit code and progress is saved on the server.
 * Without a data server (local preview, the single-file build) the game stays in device mode.
 *
 * The server only ever returns the signed-in child's own data: there is no call here (or on the
 * server) that takes another child's id.
 */
import type { Attempt } from '../brain/types';
import type { PlayerDoc } from './db';

const API = '/api';
const MODE_KEY = 'bgame.serverMode';

let serverMode = false;
let version = 0;
let pendingDoc: PlayerDoc | null = null;
let docTimer: ReturnType<typeof setTimeout> | undefined;
let attemptQueue: Attempt[] = [];
let attemptTimer: ReturnType<typeof setTimeout> | undefined;
let onConflict: ((doc: PlayerDoc) => void) | null = null;
let onSignedOut: (() => void) | null = null;

export const isServerMode = () => serverMode;

export interface ApiError { status: number; error: string; left?: number; retryInMin?: number }
export interface Session { player: { id: string; name: string; school: string }; doc: Partial<PlayerDoc> | null; version: number }

async function api<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  const res = await fetch(API + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    keepalive,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Bgame': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...json } as ApiError;
  return json as T;
}

const remember = (on: boolean) => { try { if (on) localStorage.setItem(MODE_KEY, '1'); else localStorage.removeItem(MODE_KEY); } catch { /* storage blocked */ } };
/** This device has used the data server before (so an outage should not silently fall back to device mode). */
export const usedServerBefore = () => { try { return localStorage.getItem(MODE_KEY) === '1'; } catch { return false; } };

/** Is a Bgame data server behind this site? */
export async function detectServer(): Promise<boolean> {
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${API}/health`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    const j = res.ok ? await res.json() : null;
    serverMode = j?.mode === 'server';
  } catch {
    serverMode = false;
  }
  if (serverMode) remember(true);
  return serverMode;
}

export function setSyncHandlers(h: { conflict: (doc: PlayerDoc) => void; signedOut: () => void }) {
  onConflict = h.conflict;
  onSignedOut = h.signedOut;
}

const started = (s: Session) => { version = s.version; return s; };

export const fetchMe = () => api<Session>('GET', '/me').then(started);
export const register = (b: { name: string; school: string; pin: string; doc: PlayerDoc }) => api<Session>('POST', '/register', b).then(started);
export const login = (b: { name: string; school: string; pin: string }) => api<Session>('POST', '/login', b).then(started);
export async function logout() {
  await flush();
  try { await api('POST', '/logout', {}); } catch { /* already signed out */ }
  version = 0;
}
export const deleteAccount = (pin: string) => api<{ deleted: boolean }>('DELETE', '/me', { pin });
export const fetchAttempts = () => api<{ attempts: Attempt[] }>('GET', '/attempts').then((r) => r.attempts);

function handleFailure(e: unknown, retry: () => void) {
  const err = e as ApiError;
  if (err?.status === 401) { onSignedOut?.(); return; }
  setTimeout(retry, 10_000); // offline or server busy: try again, nothing is lost
}

async function sendDoc(keepalive = false) {
  if (!pendingDoc) return;
  const doc = pendingDoc;
  pendingDoc = null;
  try {
    const r = await api<{ version: number }>('PUT', '/me', { doc, version }, keepalive);
    version = r.version;
  } catch (e) {
    const err = e as ApiError & { doc?: PlayerDoc; version?: number };
    if (err?.status === 409 && err.doc) {
      // the same child played on another device meanwhile: the server copy wins
      version = err.version ?? version;
      onConflict?.(err.doc);
      return;
    }
    if (!pendingDoc) pendingDoc = doc;
    handleFailure(e, () => void sendDoc());
  }
}

async function sendAttempts(keepalive = false) {
  if (!attemptQueue.length) return;
  const batch = attemptQueue.splice(0, 200);
  try {
    await api('POST', '/attempts', { attempts: batch }, keepalive);
    if (attemptQueue.length) void sendAttempts();
  } catch (e) {
    attemptQueue.unshift(...batch);
    handleFailure(e, () => void sendAttempts());
  }
}

/** Called on every save; writes are batched so a burst of changes is one request. */
export function pushDoc(doc: PlayerDoc) {
  if (!serverMode) return;
  pendingDoc = doc;
  clearTimeout(docTimer);
  docTimer = setTimeout(() => void sendDoc(), 1200);
}

export function pushAttempt(a: Attempt) {
  if (!serverMode) return;
  attemptQueue.push(a);
  clearTimeout(attemptTimer);
  attemptTimer = setTimeout(() => void sendAttempts(), 2500);
}

/** Send everything now (before sign-out, or when the page is being hidden). */
export async function flush(keepalive = false) {
  clearTimeout(docTimer);
  clearTimeout(attemptTimer);
  await Promise.all([sendDoc(keepalive), sendAttempts(keepalive)]);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (serverMode && document.visibilityState === 'hidden') void flush(true); });
  addEventListener('online', () => { if (serverMode) void flush(); });
}
