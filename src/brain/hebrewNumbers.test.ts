import { describe, expect, it } from 'vitest';
import { countF, withNoun } from './hebrewNumbers';

describe('hebrew numbers', () => {
  it('counting form', () => {
    expect(countF(7)).toBe('שבע');
    expect(countF(12)).toBe('שתים עשרה');
    expect(countF(17)).toBe('שבע עשרה');
    expect(countF(20)).toBe('עשרים');
    expect(countF(21)).toBe('עשרים ואחת');
    expect(countF(32)).toBe('שלושים ושתיים');
    expect(countF(46)).toBe('ארבעים ושש');
    expect(countF(100)).toBe('מאה');
    expect(countF(105)).toBe('מאה וחמש');
    expect(countF(115)).toBe('מאה וחמש עשרה');
    expect(countF(120)).toBe('מאה ועשרים');
    expect(countF(123)).toBe('מאה עשרים ושלוש');
    expect(countF(200)).toBe('מאתיים');
    expect(countF(347)).toBe('שלוש מאות ארבעים ושבע');
    expect(countF(1000)).toBe('אלף');
  });
  it('agreement with a noun', () => {
    expect(withNoun(3, 'תפוזים', 'm')).toBe('שלושה תפוזים');
    expect(withNoun(3, 'בובות', 'f')).toBe('שלוש בובות');
    expect(withNoun(2, 'ספרים', 'm')).toBe('שני ספרים');
    expect(withNoun(2, 'עוגות', 'f')).toBe('שתי עוגות');
    expect(withNoun(12, 'ילדים', 'm')).toBe('שנים עשר ילדים');
    expect(withNoun(15, 'מדבקות', 'f')).toBe('חמש עשרה מדבקות');
  });
});
