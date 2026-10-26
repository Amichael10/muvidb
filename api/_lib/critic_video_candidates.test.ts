import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  generate: vi.fn(),
  selectExcerpt: vi.fn(),
  explicitRating: vi.fn(),
  ytGet: vi.fn(),
}));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
vi.mock('./ai_service.js', () => ({ generateAIContent: mocks.generate }));
vi.mock('./critic_review_extractor.js', () => ({
  selectCriticExcerpt: mocks.selectExcerpt,
  extractExplicitRating: mocks.explicitRating,
}));
vi.mock('./yt_service.js', () => ({ ytGet: mocks.ytGet }));

import {
  applyCriticVideoTranscript,
  criticVideoReviewUrl,
  criticVideoTitleCandidates,
  enqueueCriticVideoCandidate,
  identifyCriticVideoUrl,
  normalizeSpokenRatings,
  supportsQuoteDeepLink,
} from './critic_video_candidates';

/** A chainable Supabase query stub that resolves to {data, error}. */
function query(data: unknown, error: unknown = null) {
  const q: any = { then: (resolve: any) => Promise.resolve({ data, error }).then(resolve) };
  for (const method of ['select', 'eq', 'in', 'ilike', 'order', 'limit', 'insert', 'update', 'maybeSingle', 'single']) {
    q[method] = vi.fn(() => q);
  }
  return q;
}

/** Route stubs by table name; order-based mocking hides the intent here. */
function tables(byTable: Record<string, any>) {
  mocks.from.mockImplementation((table: string) => byTable[table] ?? query(null));
}

describe('finding the film a review video is about', () => {
  // Titles taken from live Nollywood review channels.
  it.each([
    ['TELE X ZIKORA - Nollywood Movie Review (2026 Nigerian YA Romance Film)', 'TELE X ZIKORA'],
    ['EVERYTHING WE BUILT - Nollywood Movie Review (2026 Nigerian Drama Film)', 'EVERYTHING WE BUILT'],
    ['AJOSEPO 2: THE GATHERING - Full Movie Recap/Review - Timini Egbuson', 'AJOSEPO 2'],
  ])('pulls the title out of %s', (videoTitle, expected) => {
    expect(criticVideoTitleCandidates(videoTitle)).toContain(expected);
  });

  it('handles a title where the commentary starts with a verb', () => {
    // "The Herd Is... Unbelievable (… Nollywood Movie Review)"
    const candidates = criticVideoTitleCandidates('The Herd Is... Unbelievable (Daniel Etim Effiong Nollywood Movie Review)');
    expect(candidates).toContain('The Herd');
  });

  it('leaves no trailing separator once the boilerplate is stripped', () => {
    // Stripping "Nollywood Movie Review" re-exposes the " - " that had already
    // been trimmed, which previously searched for the film "TELE X ZIKORA -".
    expect(criticVideoTitleCandidates('TELE X ZIKORA - Nollywood Movie Review (2026 Nigerian YA Romance Film)'))
      .toEqual(['TELE X ZIKORA']);
  });

  it('never offers a cast list as a film title', () => {
    // The trailing segment of this real title is two actors. A cast name is
    // the one candidate that can confidently match the wrong film.
    const candidates = criticVideoTitleCandidates(
      'AJOSEPO 2: THE GATHERING - Full Movie Recap/Review - Timini Egbuson, Mike Afolarin',
    );
    expect(candidates).toEqual(['AJOSEPO 2: THE GATHERING', 'AJOSEPO 2', 'THE GATHERING']);
    expect(candidates.join(' ')).not.toMatch(/Timini|Afolarin/);
  });

  it('drops the review and platform boilerplate rather than searching on it', () => {
    const candidates = criticVideoTitleCandidates('GINGERRR - Nollywood Movie Review');
    expect(candidates).toContain('GINGERRR');
    expect(candidates.join(' ')).not.toMatch(/review|nollywood/i);
  });
});

describe('spoken ratings', () => {
  it('turns a spoken score into digits the existing regex can read', () => {
    // extractExplicitRating matches "7/10" but critics say it out loud.
    expect(normalizeSpokenRatings('I will give this one a seven out of ten')).toContain('7/10');
    expect(normalizeSpokenRatings('a solid six over ten for me')).toContain('6/10');
    expect(normalizeSpokenRatings('three and a half out of five')).toContain('3.5/5');
  });

  it('leaves a transcript with no spoken score alone', () => {
    expect(normalizeSpokenRatings('the cinematography carries it')).toBe('the cinematography carries it');
  });
});

describe('the deep link back to the quote', () => {
  it('points at the moment the critic says it', () => {
    expect(criticVideoReviewUrl('abc123', 252)).toBe('https://www.youtube.com/watch?v=abc123&t=252');
  });

  it('falls back to the plain video when the quote could not be located', () => {
    expect(criticVideoReviewUrl('abc123', null)).toBe('https://www.youtube.com/watch?v=abc123');
    expect(criticVideoReviewUrl('abc123', 0)).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('does not fake a timestamp on a platform that has none', () => {
    // Only YouTube takes a start offset. Appending one to an Instagram URL
    // would imply a precision the link does not have.
    const igUrl = 'https://www.instagram.com/reel/Cabc123/';
    expect(criticVideoReviewUrl('ig_Cabc123', 252, 'instagram', igUrl)).toBe(igUrl);
    expect(supportsQuoteDeepLink('instagram')).toBe(false);
    expect(supportsQuoteDeepLink('youtube')).toBe(true);
  });
});

describe('identifying a pasted review URL', () => {
  // Not every critic is on YouTube, so a review has to be submittable by hand.
  it.each([
    ['https://www.youtube.com/watch?v=Lkfdroqco28', 'youtube', 'Lkfdroqco28'],
    ['https://youtu.be/Lkfdroqco28?t=90', 'youtube', 'Lkfdroqco28'],
    ['https://www.youtube.com/shorts/Lkfdroqco28', 'youtube', 'Lkfdroqco28'],
    ['https://www.instagram.com/reel/Cabc123XY/', 'instagram', 'ig_Cabc123XY'],
    ['https://instagram.com/p/Cabc123XY', 'instagram', 'ig_Cabc123XY'],
    ['https://www.tiktok.com/@critic/video/7312345678901234567', 'tiktok', 'tt_7312345678901234567'],
  ])('reads %s', (url, platform, videoId) => {
    expect(identifyCriticVideoUrl(url)).toMatchObject({ platform, videoId });
  });

  it('keys a YouTube video on its id however the link was written', () => {
    // The same review pasted twice must not queue two candidates.
    expect(identifyCriticVideoUrl('https://youtu.be/Lkfdroqco28')?.videoId)
      .toBe(identifyCriticVideoUrl('https://www.youtube.com/watch?v=Lkfdroqco28&list=PL1')?.videoId);
  });

  it('rejects anything that is not a recognised video post', () => {
    expect(identifyCriticVideoUrl('https://example.com/a-written-review')).toBeNull();
    expect(identifyCriticVideoUrl('')).toBeNull();
  });
});

describe('queuing a discovered review', () => {
  beforeEach(() => vi.resetAllMocks());

  it('matches a film by title and inserts the candidate', async () => {
    const candidates = query(null);
    tables({
      critic_review_candidates: candidates,
      films: query([{ id: 'film-1' }]),
    });
    const outcome = await enqueueCriticVideoCandidate({
      videoId: 'vid-1',
      criticChannelId: 'chan-1',
      title: 'GINGERRR - Nollywood Movie Review',
    });
    expect(outcome).toBe('inserted');
    expect(candidates.insert).toHaveBeenCalledWith(expect.objectContaining({
      video_id: 'vid-1',
      film_id: 'film-1',
      status: 'pending_transcript',
      video_url: 'https://www.youtube.com/watch?v=vid-1',
    }));
  });

  it('records the platform and URL of a hand-submitted Instagram review', async () => {
    const candidates = query(null);
    tables({ critic_review_candidates: candidates, films: query([]) });
    await enqueueCriticVideoCandidate({
      videoId: 'ig_Cabc123XY',
      sourcePlatform: 'instagram',
      videoUrl: 'https://www.instagram.com/reel/Cabc123XY/',
      criticId: 'critic-1',
      title: 'GINGERRR review',
    });
    expect(candidates.insert).toHaveBeenCalledWith(expect.objectContaining({
      source_platform: 'instagram',
      video_url: 'https://www.instagram.com/reel/Cabc123XY/',
      critic_id: 'critic-1',
    }));
  });

  it('keeps a review whose film is not in the catalogue yet', async () => {
    // Reviews often land before the film is published; dropping them here
    // would lose the review for good.
    const candidates = query(null);
    tables({ critic_review_candidates: candidates, films: query([]) });
    await enqueueCriticVideoCandidate({ videoId: 'vid-2', title: 'SOME UNKNOWN FILM - Review' });
    expect(candidates.insert).toHaveBeenCalledWith(expect.objectContaining({ film_id: null }));
  });

  it('enriches the existing row instead of queuing the same review twice', async () => {
    const candidates = query({ id: 'cand-1', film_id: 'film-1', status: 'pending_transcript' });
    const films = query([{ id: 'film-should-not-be-queried' }]);
    tables({ critic_review_candidates: candidates, films });
    const outcome = await enqueueCriticVideoCandidate({ videoId: 'vid-1', title: 'GINGERRR - Review' });
    expect(outcome).toBe('updated');
    expect(candidates.insert).not.toHaveBeenCalled();
    expect(candidates.update).toHaveBeenCalled();
    // An operator's hand-assigned film beats a fresh title guess.
    expect(films.select).not.toHaveBeenCalled();
  });

  it('does not reopen a candidate an operator already decided', async () => {
    const candidates = query({ id: 'cand-1', film_id: 'film-1', status: 'rejected' });
    tables({ critic_review_candidates: candidates, films: query([]) });
    await enqueueCriticVideoCandidate({ videoId: 'vid-1', title: 'GINGERRR - Review' });
    expect(candidates.in).toHaveBeenCalledWith('status', ['pending_transcript', 'pending_review', 'failed']);
  });
});

describe('attaching a transcript', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.explicitRating.mockReturnValue(null);
  });

  // Unpunctuated, timestamped, and long enough to be quotable — what YouTube's
  // automatic captions actually look like.
  const rawCaptions =
    '[00:02] hey guys welcome back to the channel and if you are new here do not forget to subscribe '
    + 'and hit that notification bell because today we are talking about a film that a lot of you have '
    + 'been asking me about all week and i have a lot to say about it '
    + '[04:12] the performances carry a script that never earns its ending and by the third act the '
    + 'whole thing collapses under the weight of its own ambition which is a shame because the first '
    + 'hour is genuinely some of the best work i have seen this year';

  const punctuatedQuote = 'The performances carry a script that never earns its ending.';

  function setupCandidate() {
    const candidates = query({ id: 'cand-1', status: 'pending_transcript', attempts: 0 });
    tables({ critic_review_candidates: candidates });
    return candidates;
  }

  it('stores the quote with the timestamp it was spoken at', async () => {
    const candidates = setupCandidate();
    // Punctuation restored without changing a word.
    mocks.generate.mockResolvedValue({
      text: rawCaptions.replace(/\[\d{1,2}:\d{2}\]\s*/g, '').replace(/\s+/g, ' ').trim() + '.',
    });
    mocks.selectExcerpt.mockResolvedValue({
      excerpt: punctuatedQuote,
      excerptContext: 'The critic on the screenplay.',
      rating: 3.5,
    });

    const result = await applyCriticVideoTranscript('vid-1', rawCaptions, 'captions');

    expect(result.status).toBe('pending_review');
    expect(candidates.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending_review',
      quote: punctuatedQuote,
      rating: 3.5,
      transcript_source: 'captions',
      // The quote starts in the segment tagged 04:12, so the reader can click
      // through and hear it.
      quote_start_seconds: 252,
    }));
  });

  it('fails the candidate rather than quoting a transcript it could not punctuate', async () => {
    const candidates = setupCandidate();
    // A paraphrase: without the guard this would be published as a verbatim
    // quote attributed to a named critic.
    mocks.generate.mockResolvedValue({ text: 'The acting was good and the ending was bad.' });

    const result = await applyCriticVideoTranscript('vid-1', rawCaptions, 'captions');

    if (result.status !== 'failed') throw new Error(`expected failed, got ${result.status}`);
    expect(result.reason).toMatch(/Punctuation could not be restored verbatim/);
    expect(mocks.selectExcerpt).not.toHaveBeenCalled();
    expect(candidates.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', attempts: 1 }));
  });

  it('reads a spoken rating when the extractor found no numeric one', async () => {
    setupCandidate();
    const spoken = rawCaptions + ' and overall i am giving this one a seven out of ten';
    mocks.generate.mockResolvedValue({
      text: spoken.replace(/\[\d{1,2}:\d{2}\]\s*/g, '').replace(/\s+/g, ' ').trim() + '.',
    });
    mocks.selectExcerpt.mockResolvedValue({ excerpt: punctuatedQuote, excerptContext: null, rating: null });
    mocks.explicitRating.mockReturnValue(3.5);

    const result = await applyCriticVideoTranscript('vid-1', spoken, 'captions');

    if (result.status !== 'pending_review') throw new Error(`expected pending_review, got ${result.status}`);
    expect(result.rating).toBe(3.5);
    // The spoken-number rewrite is only ever fed to the rating regex, never
    // quoted from.
    expect(mocks.explicitRating).toHaveBeenCalledWith(expect.stringContaining('7/10'));
  });

  it('fails a transcript too short to hold a review', async () => {
    const candidates = setupCandidate();
    const result = await applyCriticVideoTranscript('vid-1', '[00:01] short', 'captions');
    if (result.status !== 'failed') throw new Error(`expected failed, got ${result.status}`);
    expect(result.reason).toMatch(/too short/);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(candidates.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('refuses a transcript for a video that was never queued', async () => {
    tables({ critic_review_candidates: query(null) });
    await expect(applyCriticVideoTranscript('unknown', rawCaptions, 'captions'))
      .rejects.toThrow('No critic video candidate for unknown');
  });
});
