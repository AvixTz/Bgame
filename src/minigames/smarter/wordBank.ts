/** Loads the "חכמים יותר" words: every src/content/smarter/<domain>.json (see SCHEMA.md there). */
import domainsJson from '../../content/smarter/domains.json';

export interface WordQuestion { q: string; options: string[]; answer: number; why: string }
export interface SmartWord {
  id: string; word: string; domain: string; meaning: string; explain: string;
  picture: { emoji: string; caption: string };
  story: { title: string; text: string };
  questions: WordQuestion[]; realLife: string; related?: string[];
}
export interface Domain { id: string; name: string; icon: string }

export const DOMAINS: Domain[] = domainsJson;
const files = import.meta.glob<SmartWord[]>(['../../content/smarter/*.json', '!../../content/smarter/domains.json'], { eager: true, import: 'default' });
const order = new Map(DOMAINS.map((d, i) => [d.id, i]));
export const WORDS: SmartWord[] = Object.values(files).flat().sort((a, b) => (order.get(a.domain) ?? 99) - (order.get(b.domain) ?? 99));
export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));
export const WORD_BY_TEXT = new Map(WORDS.map((w) => [w.word, w]));

/** Splits a story into plain and highlighted parts ([[...]] marks the word). */
export const storyParts = (text: string) => text.split(/(\[\[[^\]]+\]\])/).filter(Boolean).map((t) => (t.startsWith('[[') ? { mark: true, t: t.slice(2, -2) } : { mark: false, t }));
export const plainStory = (text: string) => text.replace(/\[\[([^\]]+)\]\]/g, '$1');

/** Picture scenes read right to left like the page, so arrows between emoji must point left. */
export const rtlPicture = (emoji: string) => emoji.replace(/➡️|➡|➜|→|⟶|➔/g, '←');
