import { describe, expect, it } from 'vitest';
import { isEngagementBait } from './comment_reviews.js';

// Every string here is a real stored comment, so the thresholds are tuned
// against the actual catalogue rather than invented examples.
describe('isEngagementBait', () => {
  it('drops comments that are nothing but bait', () => {
    expect(isEngagementBait('Arinja fan gather here 😂😂😂')).toBe(true);
    expect(isEngagementBait('Na me be first to comment 😅')).toBe(true);
    expect(isEngagementBait('Fans of Ebube hit the like bottom ❤ 😂😂')).toBe(true);
  });

  it('keeps a real opinion that merely carries a bait tail', () => {
    // The rating needs these: they say something about the film. The filter is
    // deliberately conservative — a thin reaction still counts, and the AI
    // classifier scores it as the mild opinion it is rather than dropping it.
    expect(isEngagementBait(
      'I love the sister she is so supportive she really loves his brother . If you agree with me please like 👍',
    )).toBe(false);
    expect(isEngagementBait(
      'Bryan ❤❤ Sonia’s chemistry has become ONE of the best in Nollywood. They have the greatest connection if you agree 👍 like this comment.',
    )).toBe(false);
    expect(isEngagementBait('Let all gather here the last part dey kill me')).toBe(false);
    // "na real werey" is a reaction to a character, so the bait tail does not
    // disqualify it.
    expect(isEngagementBait('Arinja na real werey 😂😂Arinja fan gather here 😂😂')).toBe(false);
  });

  it('leaves ordinary comments completely alone', () => {
    expect(isEngagementBait('This movie was funny, I came from tiktok to here 😂😂😂')).toBe(false);
    expect(isEngagementBait('The picture quality is 10/10. This was a good watch.')).toBe(false);
    expect(isEngagementBait('')).toBe(false);
  });

  it('is not fooled by emoji padding around the bait', () => {
    expect(isEngagementBait('🔥🔥🔥 gather here 🔥🔥🔥')).toBe(true);
  });

  it('does not match bait words inside ordinary sentences', () => {
    // "first" and "comment" appear, but not as the bait phrase.
    expect(isEngagementBait('The first half dragged but the ending saved it completely')).toBe(false);
  });
});
