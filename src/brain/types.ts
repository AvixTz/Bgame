export type Grade = 2 | 3;
export type Subject = 'math' | 'language' | 'science';

export type StrategyId =
  | 'decompose'
  | 'check_inverse'
  | 'pattern'
  | 'estimate'
  | 'known_fact'
  | 'draw'
  | 'eliminate'
  | 'look_back'
  | 'think_ahead'
  | 'spot_threat'
  | 'work_backwards';

export type MistakeType =
  | 'forgot_carry'
  | 'digit_concat'
  | 'smaller_from_larger'
  | 'forgot_borrow'
  | 'off_by_one'
  | 'off_by_ten'
  | 'wrong_operation'
  | 'skip_count_slip'
  | 'swapped_digits'
  | 'remainder_too_big'
  | 'misconception'
  | 'other';

export interface CurriculumNode {
  id: string;
  subject: Subject;
  grade: Grade;
  title: string;
  /** Short name shown on the tunnel sign in the mine. */
  short: string;
  strand: string;
  prerequisites: string[];
  /** Difficulty (logit scale) of tier 1..3. */
  tierDifficulty: [number, number, number];
  curriculumVersion: string;
}

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
}

export interface Item {
  id: string;
  nodeId: string;
  tier: 1 | 2 | 3;
  /** Text displayed to the child. Math expressions go in `expr` so they render LTR. */
  prompt: string;
  /** Reading passage shown above the question (reading comprehension). */
  passage?: string;
  expr?: string;
  /** Text read aloud by TTS. */
  speech: string;
  answer: number;
  /** When present the child picks from these instead of typing. Values are display strings. */
  choices?: string[];
  correctChoice?: string;
  /** Specific feedback for a wrong choice (explains the misconception behind it). */
  choiceFeedback?: Record<string, string>;
  strategies: StrategyId[];
  hints: [Hint, Hint, Hint];
  /** Worked explanation shown after the item. */
  explain: string;
  difficulty: number;
}

export interface Attempt {
  playerId: string;
  itemId: string;
  nodeId: string;
  tier: number;
  correct: boolean;
  firstTry: boolean;
  hintsUsed: number;
  timeMs: number;
  mistake?: MistakeType;
  given: string;
  mode: 'journey' | 'practice' | 'placement' | 'review';
  at: number;
}

export interface SkillState {
  nodeId: string;
  theta: number;
  n: number;
  /** First-try results of the last attempts, newest last. */
  recent: boolean[];
  mastered: boolean;
  masteredAt?: number;
  /** Stage in the spaced-review ladder (index into REVIEW_DAYS). */
  reviewStage: number;
  nextReviewAt?: number;
  lastSeen?: number;
  mistakes: Partial<Record<MistakeType, number>>;
}

export interface StrategyState {
  id: StrategyId;
  theta: number;
  n: number;
  selfReported: number;
}
