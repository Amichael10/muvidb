import { describe, expect, it } from 'vitest';
import { extractAuthorAndAvatar, extractExplicitRating, extractReviewText, fallbackDiscussionExcerpt } from './critic_review_extractor.js';

describe('critic review extraction', () => {
  it('extracts readable article text without page chrome', () => {
    const html = '<nav>Menu</nav><article><p>This film begins carefully and establishes its central conflict.</p><p>However, its beautiful images cannot hide an uneven final act that weakens the argument considerably.</p></article>';
    expect(extractReviewText(html)).not.toContain('Menu');
    expect(extractReviewText(html)).toContain('uneven final act');
  });

  it('normalizes only explicit ratings to a five-point scale', () => {
    expect(extractExplicitRating('Verdict: 8/10')).toBe(4);
    expect(extractExplicitRating('Rating: 3.5 out of 5')).toBe(3.5);
    expect(extractExplicitRating('A strong review with no numeric score.')).toBeNull();
  });

  it('prefers a controversial or sharp critique sentence over generic intro', () => {
    const text = 'The movie tells the story of a young prince who travels across kingdoms. It premiered in cinemas across West Africa last Friday. The performance is committed and the photography is polished. However, the film is an unconvincing and tedious mess that completely wastes its talented cast. The closing scene is memorable.';
    expect(fallbackDiscussionExcerpt(text)).toContain('unconvincing and tedious mess');
  });

  it('extracts author avatar and falls back to website logo', () => {
    const htmlWithAvatar = `
      <html>
        <head><link rel="apple-touch-icon" href="https://example.com/logo.png" /></head>
        <body>
          <span class="author-name">John Doe</span>
          <img class="avatar" data-src="https://example.com/avatar.jpg" src="data:image/svg+xml;base64,PHN2Zz4=" />
        </body>
      </html>
    `;
    const res1 = extractAuthorAndAvatar(htmlWithAvatar, 'https://fallback.com/logo.png');
    expect(res1.authorName).toBe('John Doe');
    expect(res1.avatarUrl).toBe('https://example.com/avatar.jpg');

    const htmlWithoutAvatar = `
      <html>
        <head><link rel="apple-touch-icon" href="https://example.com/site-icon.png" /></head>
        <body>
          <span class="author-name">Jane Smith</span>
        </body>
      </html>
    `;
    const res2 = extractAuthorAndAvatar(htmlWithoutAvatar, 'https://fallback.com/logo.png');
    expect(res2.authorName).toBe('Jane Smith');
    expect(res2.avatarUrl).toBe('https://example.com/site-icon.png');
  });
});
