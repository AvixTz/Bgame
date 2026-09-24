import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

/** Names and schools: trimmed, single spaces, Unicode-normalized, case-folded, quotes unified. */
export const normalize = (s) => String(s ?? '').normalize('NFC').replace(/[״"]/g, '"').replace(/[׳']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '".-]*$/u;
export function checkName(v, min, max) {
  const s = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s.length < min || s.length > max || !NAME_RE.test(s)) return null;
  return s;
}

const WEAK = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212', '2580', '0123', '9876']);
export const pinProblem = (pin) => (!/^\d{4}$/.test(String(pin ?? '')) ? 'format' : WEAK.has(pin) ? 'weak' : null);

export function hashPin(pin) {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return `s1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPin(pin, stored) {
  const [v, salt, key] = String(stored).split('$');
  if (v !== 's1' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64');
  const got = scryptSync(String(pin), Buffer.from(salt, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(want, got);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (t) => createHash('sha256').update(String(t)).digest('base64url');
export const newId = () => `p_${randomBytes(12).toString('base64url')}`;
