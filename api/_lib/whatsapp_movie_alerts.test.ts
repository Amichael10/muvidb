import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), send: vi.fn(), configured: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
vi.mock('./meta_whatsapp.js', () => ({
  sendMetaWhatsAppTemplate: mocks.send, isWhatsAppConfigured: mocks.configured,
  normalizeWhatsAppNumber: (phone: string) => phone,
}));
import { dispatchMovieWhatsAppAlerts } from './whatsapp_movie_alerts';

function query(data: unknown, error: unknown = null) {
  const q: any = { then: (resolve: any) => Promise.resolve({ data, error }).then(resolve) };
  for (const method of ['select', 'eq', 'in', 'upsert']) q[method] = vi.fn(() => q);
  return q;
}

const context = { filmId: 'film', title: 'Film', slug: 'film-slug', releaseType: 'youtube' };

describe('WhatsApp cast and crew alerts', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); });

  function setup(logs: unknown[] = [], follows?: unknown[]) {
    const queries = [
      query([{ person_id: 'actor', people: { name: 'Actor' } }, { person_id: 'editor', people: { name: 'Editor' } }]),
      query(follows || [{ user_id: 'user', person_id: 'actor' }, { user_id: 'user', person_id: 'editor' }]),
      query([{ id: 'user', whatsapp_phone: '2348000000000', whatsapp_enabled: true }]),
      query(logs), query(null),
    ];
    for (const q of queries) mocks.from.mockReturnValueOnce(q);
    return queries;
  }

  it('sends one message for followed cast and crew with the required dynamic button', async () => {
    setup(); mocks.send.mockResolvedValue({ ok: true, messageId: 'message' });
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.sentCount).toBe(1);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      buttonUrlPayload: 'film-slug',
      bodyParameters: ['Actor & Editor', 'Film', 'on YouTube', 'https://muvidb.com/film/film-slug'],
    }));
  });

  it('skips previously sent alerts', async () => {
    const queries = setup([{ user_id: 'user' }]);
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(queries[3].eq).toHaveBeenCalledWith('status', 'sent');
    expect(result.skippedAlreadyNotified).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('records failed sends so the queue can retry them', async () => {
    const queries = setup(); mocks.send.mockResolvedValue({ ok: false, error: 'Meta unavailable' });
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.failedCount).toBe(1);
    expect(queries[4].upsert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed', error_message: 'Meta unavailable',
    }), { onConflict: 'user_id,film_id' });
  });

  it('respects disabled follows', async () => {
    setup([], [{ user_id: 'user', person_id: 'actor', notify_whatsapp: false }]);
    await dispatchMovieWhatsAppAlerts(context);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('fails visibly when credentials or database queries are unavailable', async () => {
    mocks.configured.mockReturnValue(false);
    await expect(dispatchMovieWhatsAppAlerts(context)).rejects.toThrow('not configured');
    mocks.configured.mockReturnValue(true);
    mocks.from.mockReturnValue(query(null, { message: 'database unavailable' }));
    await expect(dispatchMovieWhatsAppAlerts(context)).rejects.toThrow('database unavailable');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
