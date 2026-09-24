import { Vector3 } from 'three';
import { BookOpen, FlaskConical, Handshake, Moon, Pickaxe, Swords, type LucideIcon } from 'lucide-react';
import type { WorldId } from '../core/store';

export interface PortalDef {
  id: WorldId;
  name: string;
  emoji: string;
  icon: LucideIcon;
  /** Main world color (sign, beacon, entry button, wipe transition). */
  color: string;
  /** Darker shade for 3D trim and button depth. */
  dark: string;
  angle: number;
  open: boolean;
}

export const PORTALS: PortalDef[] = [
  { id: 'mines', name: 'מכרות המספרים', emoji: '⛏️', icon: Pickaxe, color: '#F29A2E', dark: '#9A5A12', angle: Math.PI - 0.6, open: true },
  { id: 'library', name: 'ספריית המילים', emoji: '📚', icon: BookOpen, color: '#8A5CF6', dark: '#5B34B8', angle: Math.PI + 0.6, open: true },
  { id: 'lab', name: 'מעבדת הטבע', emoji: '🔬', icon: FlaskConical, color: '#14B3A8', dark: '#0B6F69', angle: 1.75, open: true },
  { id: 'village', name: 'כפר החברים', emoji: '🤝', icon: Handshake, color: '#3FB35F', dark: '#23703A', angle: -1.75, open: true },
  { id: 'arena', name: 'ארנה החשיבה', emoji: '♟️', icon: Swords, color: '#3E6BF0', dark: '#1F3FA8', angle: 0.5, open: true },
  { id: 'story', name: 'סיפור לילה', emoji: '🌙', icon: Moon, color: '#5B5BD6', dark: '#2B2A7A', angle: -0.62, open: true },
];

export const PORTAL_BY_ID = Object.fromEntries(PORTALS.map((p) => [p.id, p])) as Record<WorldId, PortalDef>;

const PORTAL_R = 14;
export const portalPos = (p: PortalDef) => new Vector3(Math.sin(p.angle) * PORTAL_R, 0, Math.cos(p.angle) * PORTAL_R);
