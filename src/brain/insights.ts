import { MISTAKES, NODES, NODE_BY_ID, STRATEGIES } from './curriculum';
import { expected, nodeStatus, type NodeStatus } from './model';
import type { Attempt, Grade, MistakeType, SkillState, StrategyId, StrategyState } from './types';

export interface NodeReport {
  nodeId: string;
  title: string;
  grade: Grade;
  status: NodeStatus;
  /** Predicted first-try success on the middle tier, 0..1. */
  level: number;
  attempts: number;
}

export interface ParentReport {
  nodes: NodeReport[];
  strengths: string[];
  focus: string[];
  patterns: { type: MistakeType; text: string; count: number; nodes: string[] }[];
  strategies: { id: StrategyId; name: string; icon: string; level: number; selfReported: number }[];
  week: { attempts: number; firstTryRate: number; minutes: number; hintsRate: number };
  talkQuestion: string;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function buildReport(
  skills: Record<string, SkillState>,
  strategies: Partial<Record<StrategyId, StrategyState>>,
  attempts: Attempt[],
  now: number,
): ParentReport {
  const nodes: NodeReport[] = NODES.map((n) => {
    const s = skills[n.id];
    return {
      nodeId: n.id, title: n.title, grade: n.grade,
      status: nodeStatus(n.id, skills, now),
      level: s ? expected(s.theta, n.tierDifficulty[1]) : 0,
      attempts: s?.n ?? 0,
    };
  });

  const strengths = nodes.filter((n) => n.status === 'mastered' || n.status === 'review_due').map((n) => n.title);
  const focus = nodes.filter((n) => n.status === 'struggling').map((n) => n.title);
  if (!focus.length) {
    const learning = nodes.filter((n) => n.status === 'learning' && n.attempts >= 3).sort((a, b) => a.level - b.level);
    if (learning[0] && learning[0].level < 0.65) focus.push(learning[0].title);
  }

  const agg = new Map<MistakeType, { count: number; nodes: Set<string> }>();
  for (const s of Object.values(skills)) {
    for (const [type, count] of Object.entries(s.mistakes) as [MistakeType, number][]) {
      if (type === 'other' || !count) continue;
      const e = agg.get(type) ?? { count: 0, nodes: new Set() };
      e.count += count;
      e.nodes.add(NODE_BY_ID[s.nodeId].short);
      agg.set(type, e);
    }
  }
  const patterns = [...agg.entries()]
    .filter(([, e]) => e.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([type, e]) => ({ type, text: MISTAKES[type].parent, count: e.count, nodes: [...e.nodes] }));

  const strat = (Object.keys(STRATEGIES) as StrategyId[]).map((id) => {
    const st = strategies[id];
    return {
      id, name: STRATEGIES[id].name, icon: STRATEGIES[id].icon,
      level: st && st.n ? expected(st.theta, 0) : 0,
      selfReported: st?.selfReported ?? 0,
    };
  });

  const recent = attempts.filter((a) => a.at >= now - WEEK);
  const firstTry = recent.filter((a) => a.firstTry && a.correct).length;
  const week = {
    attempts: recent.length,
    firstTryRate: recent.length ? firstTry / recent.length : 0,
    minutes: Math.round(recent.reduce((t, a) => t + Math.min(a.timeMs, 120000), 0) / 60000),
    hintsRate: recent.length ? recent.filter((a) => a.hintsUsed > 0).length / recent.length : 0,
  };

  let talkQuestion = 'שאלו: "מה היה התרגיל הכי מעניין היום, ואיך פתרת אותו?"';
  if (patterns[0]?.type === 'forgot_carry' || patterns[0]?.type === 'digit_concat') {
    talkQuestion = 'בקשו מהילד להסביר לכם מה קורה כשמחברים 8 ועוד 5 יחידות. לאן הולכת העשרת?';
  } else if (patterns[0]?.type === 'smaller_from_larger' || patterns[0]?.type === 'forgot_borrow') {
    talkQuestion = 'שחקו ב"חנות": יש לכם 5 מטבעות של 10 ורוצים לשלם 7. איך עושים את זה? (פורטים!)';
  } else if (patterns[0]?.type === 'skip_count_slip') {
    talkQuestion = 'ספרו יחד בקפיצות בזמן הליכה: 3, 6, 9... מי מגיע הכי רחוק בלי לטעות?';
  } else if (strengths.length) {
    talkQuestion = `בקשו מהילד ללמד אתכם "${strengths[strengths.length - 1]}". ללמד מישהו אחר מחזק את הידע.`;
  }

  return { nodes, strengths, focus, patterns, strategies: strat, week, talkQuestion };
}
