import Dexie, { type Table } from 'dexie';
import type { Attempt, Grade, SkillState, StrategyId, StrategyState } from '../brain/types';
import type { Gender } from '../core/rng';

export interface PlayerDoc {
  id: string;
  nickname: string;
  gender: Gender;
  grade: Grade;
  color: string;
  hat: string;
  createdAt: number;
  placementDone: boolean;
  skills: Record<string, SkillState>;
  strategies: Partial<Record<StrategyId, StrategyState>>;
  coins: number;
  owned: string[];
  collectibles: string[];
  badges: string[];
  playedDays: string[];
  journeysCompleted: number;
  lastJourneyDay?: string;
  journeyDays?: Record<string, string>;
  arena?: Record<string, ArenaStat>;
  village?: Record<string, string[]>;
}

export interface ArenaStat { level: number; wins: number; losses: number; draws: number; lossStreak: number; winStreak: number; best?: number }

class BgameDB extends Dexie {
  players!: Table<PlayerDoc, string>;
  attempts!: Table<Attempt & { id?: number }, number>;
  constructor() {
    super('bgame');
    this.version(1).stores({
      players: 'id, createdAt',
      attempts: '++id, playerId, at, nodeId',
    });
  }
}

/**
 * Local-first storage. IndexedDB can be blocked (private mode, sandboxed previews),
 * so every call falls back to memory and the game keeps working.
 */
let db: BgameDB | null = null;
const memPlayers = new Map<string, PlayerDoc>();
const memAttempts: Attempt[] = [];
let persistent = false;

export async function initDb(): Promise<boolean> {
  try {
    db = new BgameDB();
    await db.open();
    persistent = true;
  } catch {
    db = null;
    persistent = false;
  }
  return persistent;
}

export const isPersistent = () => persistent;

export async function listPlayers(): Promise<PlayerDoc[]> {
  if (db) {
    try { return await db.players.orderBy('createdAt').toArray(); } catch { /* fall through */ }
  }
  return [...memPlayers.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export async function savePlayer(p: PlayerDoc): Promise<void> {
  memPlayers.set(p.id, p);
  if (db) {
    try { await db.players.put(structuredClone(p)); } catch { /* memory copy kept */ }
  }
}

export async function deletePlayer(id: string): Promise<void> {
  memPlayers.delete(id);
  if (db) {
    try {
      await db.players.delete(id);
      await db.attempts.where('playerId').equals(id).delete();
    } catch { /* ignore */ }
  }
}

export async function addAttempt(a: Attempt): Promise<void> {
  memAttempts.push(a);
  if (db) {
    try { await db.attempts.add({ ...a }); } catch { /* memory copy kept */ }
  }
}

export async function attemptsFor(playerId: string): Promise<Attempt[]> {
  if (db) {
    try { return await db.attempts.where('playerId').equals(playerId).sortBy('at'); } catch { /* fall through */ }
  }
  return memAttempts.filter((a) => a.playerId === playerId);
}

export function newPlayer(nickname: string, gender: Gender, grade: Grade, color: string): PlayerDoc {
  return {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    nickname, gender, grade, color, hat: 'none',
    createdAt: Date.now(),
    placementDone: false,
    skills: {}, strategies: {},
    coins: 0,
    owned: ['c_pink', 'c_blue', 'c_mint', 'h_none'],
    collectibles: [], badges: [], playedDays: [],
    journeysCompleted: 0,
  };
}
