/**
 * Bedtime stories. Content lives in src/content/story/<storyId>/story.json and
 * chapters/NN.json (see docs/STORY.md). A chapter opens on its publishDate, so a whole volume can
 * be written ahead and the children get one chapter a night.
 */
export interface StoryQuestion { question: string; options?: string[]; answer?: number }
export interface Learning { issue: string; skill?: string; questions?: StoryQuestion[]; parentNote?: string; suggested?: unknown }
export interface Chapter { story: string; number: number; title: string; publishDate: string; paragraphs: string[]; learning?: Learning }
export interface StoryMeta { id: string; title: string; subtitle?: string; color?: string }

const metas = import.meta.glob<StoryMeta>('../../content/story/*/story.json', { eager: true, import: 'default' });
const chapterFiles = import.meta.glob<Omit<Chapter, 'story'>>('../../content/story/*/chapters/*.json', { eager: true, import: 'default' });

export const STORIES: StoryMeta[] = Object.values(metas).sort((a, b) => a.id.localeCompare(b.id));

export const CHAPTERS: Chapter[] = Object.entries(chapterFiles)
  .map(([path, c]) => ({ ...c, story: path.split('/').at(-3)! }))
  .sort((a, b) => a.publishDate.localeCompare(b.publishDate) || a.story.localeCompare(b.story) || a.number - b.number);

export const chapterKey = (c: Chapter) => `${c.story}/${String(c.number).padStart(2, '0')}`;

/** Chapters already published on `today` (YYYY-MM-DD, local), oldest first. */
export const openChapters = (today: string, all = CHAPTERS) => all.filter((c) => c.publishDate <= today);

/** Tonight's chapter: the newest open chapter the child has not read, else the newest open one. */
export function tonight(today: string, read: Record<string, string>, all = CHAPTERS): Chapter | undefined {
  const open = openChapters(today, all);
  return [...open].reverse().find((c) => !read[chapterKey(c)]) ?? open.at(-1);
}

export const nextChapter = (today: string, all = CHAPTERS) => all.find((c) => c.publishDate > today);
