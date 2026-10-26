import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), dispatch: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('./whatsapp_movie_alerts.js', () => ({ dispatchMovieWhatsAppAlerts: mocks.dispatch }));
import { runWhatsAppAlertQueue, backfillMovieWhatsAppAlertQueue } from './whatsapp_alert_queue';

function query(data: unknown) {
  const q: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
  for (const name of ['select', 'eq', 'single', 'update', 'delete']) q[name] = vi.fn(() => q);
  return q;
}

describe('WhatsApp credit alert queue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rpc.mockResolvedValueOnce({ data: [{ film_id: 'film', queued_at: 'version', locked_until: 'lease' }] })
      .mockResolvedValue({ data: [] });
  });

  function setup(published = true) {
    const film = query({ id: 'film', title: 'Film', content_type: 'movie', is_published: published, is_in_cinemas: false });
    const completion = query(null);
    const unlock = query(null);
    mocks.from.mockReturnValueOnce(film).mockReturnValueOnce(completion).mockReturnValueOnce(unlock);
    return { completion, unlock };
  }

  it('dispatches synced credits and deletes only the claimed queue version', async () => {
    const { completion } = setup();
    mocks.dispatch.mockResolvedValue({ sentCount: 1, failedCount: 0 });
    expect(await runWhatsAppAlertQueue()).toEqual({ processed: 1, sent: 1, failed: 0, deferred: 0 });
    expect(completion.delete).toHaveBeenCalled();
    expect(completion.eq).toHaveBeenCalledWith('queued_at', 'version');
  });

  it('retains unpublished films without sending', async () => {
    const { completion } = setup(false);
    expect((await runWhatsAppAlertQueue()).deferred).toBe(1);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(completion.update).toHaveBeenCalledWith(expect.objectContaining({
      last_error: 'Waiting for film publication', locked_until: null,
    }));
  });

  it('suppresses episodic alerts so they do not consume the movie marketing allowance', async () => {
    const completion = query(null);
    const unlock = query(null);
    mocks.from.mockReturnValueOnce(query({
      id: 'film', title: 'Episode 18', content_type: 'series', is_published: true, is_in_cinemas: false,
    })).mockReturnValueOnce(completion).mockReturnValueOnce(unlock);
    expect((await runWhatsAppAlertQueue()).deferred).toBe(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(completion.delete).toHaveBeenCalled();
  });

  it('releases failed jobs for retry with their error', async () => {
    const { completion } = setup();
    mocks.dispatch.mockResolvedValue({ sentCount: 0, failedCount: 1, errors: [{ error: 'Meta rejected' }] });
    expect((await runWhatsAppAlertQueue()).failed).toBe(1);
    expect(completion.update).toHaveBeenCalledWith(expect.objectContaining({
      last_error: 'Meta rejected', locked_until: null,
    }));
    expect(completion.delete).not.toHaveBeenCalled();
  });

  it('retains jobs while every recipient is in the marketing cooldown', async () => {
    const { completion } = setup();
    const next = new Date(Date.now() + 60 * 60_000).toISOString();
    mocks.dispatch.mockResolvedValue({
      sentCount: 0, failedCount: 0, deferredCount: 1, nextDeferredAt: next,
    });
    expect((await runWhatsAppAlertQueue()).deferred).toBe(1);
    expect(completion.update).toHaveBeenCalledWith(expect.objectContaining({
      last_error: 'Waiting for recipient marketing cooldown', locked_until: null,
    }));
    expect(completion.delete).not.toHaveBeenCalled();
  });
});

describe('credits that arrive after publication', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rpc.mockResolvedValueOnce({ data: [{ film_id: 'film', queued_at: new Date().toISOString(), locked_until: 'lease' }] })
      .mockResolvedValue({ data: [] });
  });

  function setupPublished() {
    const film = query({ id: 'film', title: 'Film', content_type: 'movie', is_published: true, is_in_cinemas: false });
    const completion = query(null);
    const unlock = query(null);
    mocks.from.mockReturnValueOnce(film).mockReturnValueOnce(completion).mockReturnValueOnce(unlock);
    return { completion };
  }

  it('waits instead of discarding the alert when the film has no credits yet', async () => {
    const { completion } = setupPublished();
    mocks.dispatch.mockResolvedValue({ sentCount: 0, failedCount: 0, creditsMissing: true });
    expect((await runWhatsAppAlertQueue()).deferred).toBe(1);
    // Completing here is what permanently lost the alert for every film
    // published before the harvester credited it.
    expect(completion.delete).not.toHaveBeenCalled();
    expect(completion.update).toHaveBeenCalledWith(expect.objectContaining({
      last_error: 'Waiting for credits to be harvested',
    }));
  });

  it('gives up once a film has waited past the credit window', async () => {
    vi.resetAllMocks();
    const stale = new Date(Date.now() - 40 * 86400000).toISOString();
    mocks.rpc.mockResolvedValueOnce({ data: [{ film_id: 'film', queued_at: stale, locked_until: 'lease' }] })
      .mockResolvedValue({ data: [] });
    const film = query({ id: 'film', title: 'Film', is_published: true, is_in_cinemas: false });
    const completion = query(null);
    const unlock = query(null);
    mocks.from.mockReturnValueOnce(film).mockReturnValueOnce(completion).mockReturnValueOnce(unlock);
    mocks.dispatch.mockResolvedValue({ sentCount: 0, failedCount: 0, creditsMissing: true });
    expect((await runWhatsAppAlertQueue()).deferred).toBe(0);
    expect(completion.delete).toHaveBeenCalled();
  });
});

describe('queue backfill', () => {
  // Routed by table name: the scan touches six tables, and order-based mocking
  // makes the intent unreadable.
  function tables(overrides: Record<string, unknown[]>) {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    mocks.from.mockImplementation((table: string) => {
      const data = overrides[table] ?? [];
      const q: any = {
        then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve),
        upsert,
      };
      for (const name of ['select', 'eq', 'in', 'gte', 'single']) q[name] = vi.fn(() => q);
      return q;
    });
    return { upsert };
  }

  const recent = () => new Date(Date.now() - 86400000).toISOString();

  beforeEach(() => vi.resetAllMocks());

  it('queues a live, credited film that no follower has been alerted about', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: null }],
      users: [{ id: 'u1', whatsapp_enabled: true, whatsapp_phone: '+2348012345678' }],
      credits: [{ film_id: 'f1', person_id: 'p1' }],
      films: [{ id: 'f1', is_published: true, is_in_cinemas: false, created_at: recent() }],
      whatsapp_movie_alert_log: [],
      whatsapp_movie_alert_queue: [],
    });
    const r = await backfillMovieWhatsAppAlertQueue();
    expect(r.enqueued).toBe(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ film_id: 'f1' }), expect.anything());
  });

  it('ignores a follow whose owner cannot receive WhatsApp', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: null }],
      users: [{ id: 'u1', whatsapp_enabled: true, whatsapp_phone: null }],
    });
    expect((await backfillMovieWhatsAppAlertQueue()).enqueued).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('respects a follow that opted out of WhatsApp', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: false }],
    });
    expect((await backfillMovieWhatsAppAlertQueue()).followedPeople).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('does not re-alert a film every eligible follower already received', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: null }],
      users: [{ id: 'u1', whatsapp_enabled: true, whatsapp_phone: '+2348012345678' }],
      credits: [{ film_id: 'f1', person_id: 'p1' }],
      films: [{ id: 'f1', is_published: true, is_in_cinemas: false, created_at: recent() }],
      whatsapp_movie_alert_log: [{ film_id: 'f1', user_id: 'u1' }],
      whatsapp_movie_alert_queue: [],
    });
    const r = await backfillMovieWhatsAppAlertQueue();
    expect(r.enqueued).toBe(0);
    expect(r.alreadyAlerted).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('still queues a film when a NEW follower has not been alerted', async () => {
    const { upsert } = tables({
      follows: [
        { user_id: 'u1', person_id: 'p1', notify_whatsapp: null },
        { user_id: 'u2', person_id: 'p1', notify_whatsapp: null },
      ],
      users: [
        { id: 'u1', whatsapp_enabled: true, whatsapp_phone: '+2348012345678' },
        { id: 'u2', whatsapp_enabled: true, whatsapp_phone: '+2348087654321' },
      ],
      credits: [{ film_id: 'f1', person_id: 'p1' }],
      films: [{ id: 'f1', is_published: true, is_in_cinemas: false, created_at: recent() }],
      whatsapp_movie_alert_log: [{ film_id: 'f1', user_id: 'u1' }],
      whatsapp_movie_alert_queue: [],
    });
    expect((await backfillMovieWhatsAppAlertQueue()).enqueued).toBe(1);
    expect(upsert).toHaveBeenCalled();
  });

  it('leaves a film already waiting in the queue alone', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: null }],
      users: [{ id: 'u1', whatsapp_enabled: true, whatsapp_phone: '+2348012345678' }],
      credits: [{ film_id: 'f1', person_id: 'p1' }],
      films: [{ id: 'f1', is_published: true, is_in_cinemas: false, created_at: recent() }],
      whatsapp_movie_alert_log: [],
      whatsapp_movie_alert_queue: [{ film_id: 'f1' }],
    });
    const r = await backfillMovieWhatsAppAlertQueue();
    expect(r.alreadyQueued).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('skips an unpublished film even when it is credited and followed', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: null }],
      users: [{ id: 'u1', whatsapp_enabled: true, whatsapp_phone: '+2348012345678' }],
      credits: [{ film_id: 'f1', person_id: 'p1' }],
      films: [{ id: 'f1', is_published: false, is_in_cinemas: false, created_at: recent() }],
      whatsapp_movie_alert_log: [],
      whatsapp_movie_alert_queue: [],
    });
    expect((await backfillMovieWhatsAppAlertQueue()).candidateFilms).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('does not backfill series episodes into the marketing queue', async () => {
    const { upsert } = tables({
      follows: [{ user_id: 'u1', person_id: 'p1', notify_whatsapp: null }],
      users: [{ id: 'u1', whatsapp_enabled: true, whatsapp_phone: '+2348012345678' }],
      credits: [{ film_id: 'f1', person_id: 'p1' }],
      films: [{ id: 'f1', content_type: 'series', is_published: true, is_in_cinemas: false, created_at: recent() }],
      whatsapp_movie_alert_log: [],
      whatsapp_movie_alert_queue: [],
    });
    expect((await backfillMovieWhatsAppAlertQueue()).candidateFilms).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
