import { Vector3 } from 'three';
import type { WorldId } from '../core/store';

export interface PortalDef {
  id: WorldId;
  name: string;
  emoji: string;
  color: string;
  angle: number;
  open: boolean;
}

export const PORTALS: PortalDef[] = [
  { id: 'mines', name: 'מכרות המספרים', emoji: '⛏️', color: '#FFC02E', angle: Math.PI - 0.6, open: true },
  { id: 'library', name: 'ספריית המילים', emoji: '📚', color: '#FF3D7F', angle: Math.PI + 0.6, open: true },
  { id: 'lab', name: 'מעבדת הטבע', emoji: '🔬', color: '#00C896', angle: 1.75, open: true },
  { id: 'village', name: 'כפר החברים', emoji: '🤝', color: '#3D5AFE', angle: -1.75, open: true },
  { id: 'arena', name: 'ארנה החשיבה', emoji: '♟️', color: '#8B5CF6', angle: 0.35, open: true },
];

const PORTAL_R = 14;
export const portalPos = (p: PortalDef) => new Vector3(Math.sin(p.angle) * PORTAL_R, 0, Math.cos(p.angle) * PORTAL_R);
