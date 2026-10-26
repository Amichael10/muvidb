import { describe, expect, it } from 'vitest';
import { selectAudienceComments, stripBaitTail } from './snapshots.js';

// Bodies here are real stored comments, so the behaviour is pinned to the
// catalogue rather than to invented examples.
describe('stripBaitTail', () => {
  it('removes a reply-farming tail but keeps the opinion', () => {
    expect(stripBaitTail('Such an unpredictable movie, I rate it 100% ..who is with me?'))
      .toBe('Such an unpredictable movie, I rate it 100%');
    expect(stripBaitTail('I love the sister she is so supportive. If you agree with me please like'))
      .toBe('I love the sister she is so supportive');
  });

  it('leaves ordinary comments untouched', () => {
    const plain = 'The picture quality is 10/10. This was a good watch.';
    expect(stripBaitTail(plain)).toBe(plain);
  });

  it('keeps the original when stripping would leave nothing useful', () => {
    // Almost entirely bait — better to keep it whole than print a fragment.
    expect(stripBaitTail('Arinja fan gather here')).toBe('Arinja fan gather here');
  });

  it('strips the tail even when emoji trail after it', () => {
    // The real stored form: the clause is followed by a run of emoji, which
    // defeated a plain punctuation-and-end anchor.
    expect(stripBaitTail('Such an unpredictable movie, I rate it 100% ..who is with me?🤚🤚🤚🤚'))
      .toBe('Such an unpredictable movie, I rate it 100%');
  });

  it('only strips a trailing clause, not a mid-sentence mention', () => {
    const mid = 'Who is with me on this one, the ending completely ruined the film';
    expect(stripBaitTail(mid)).toBe(mid);
  });
});

describe('selectAudienceComments', () => {
  const row = (body: string, likes = 1, author = '@viewer') => ({
    author_name: author, body, likes, author_avatar_url: 'https://x/=s48-c',
  });

  it('drops quotes too long to print whole rather than truncating them', () => {
    const long = 'a'.repeat(200);
    const picked = selectAudienceComments([row(long), row('Genuinely moving from start to finish')]);
    expect(picked).toHaveLength(1);
    expect(picked[0].body).toBe('Genuinely moving from start to finish');
  });

  it('orders by likes so the most-endorsed quotes lead', () => {
    const picked = selectAudienceComments([
      row('The soundtrack carried every scene', 5),
      row('Best Nollywood film I have seen', 90),
    ]);
    expect(picked[0].body).toBe('Best Nollywood film I have seen');
  });

  it('removes duplicates and anything missing an author', () => {
    const picked = selectAudienceComments([
      row('Such a beautiful story'), row('Such a beautiful story'),
      { ...row('No author here'), author_name: null },
    ]);
    expect(picked).toHaveLength(1);
  });

  it('caps the count so the card never overflows', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`A genuinely fine film number ${i}`, i));
    expect(selectAudienceComments(many).length).toBeLessThanOrEqual(5);
  });

  it('rejects TikTok referrals, attendance calls, and non-review cheerleader noise', () => {
    const mixed = [
      row('If you are coming from TikTok oya let mart attendant ✅ Me this movie is 10000000', 50),
      row('Action po bi Ogogo 💯💯💯💯💯💯💯 Baami Femi Omo Adebayo 🙌🙌🙌🙌🙌🙌🙌🙌🙌🙌🙌', 40),
      row('Itele and kemity just Dey give us b2b ❤...', 30),
      row('Who is watching from London gather here 👍', 20),
      row('Can we give Onome her flowers. She executed her role so perfectly.', 15),
    ];
    const picked = selectAudienceComments(mixed);
    expect(picked).toHaveLength(1);
    expect(picked[0].body).toBe('Can we give Onome her flowers. She executed her role so perfectly.');
  });
});
