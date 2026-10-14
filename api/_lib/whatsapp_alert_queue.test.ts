import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), dispatch: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('./whatsapp_movie_alerts.js', () => ({ dispatchMovieWhatsAppAlerts: mocks.dispatch }));
import { runWhatsAppAlertQueue } from './whatsapp_alert_queue';

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
    const film = query({ id: 'film', title: 'Film', is_published: published, is_in_cinemas: false });
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

  it('releases failed jobs for retry with their error', async () => {
    const { completion } = setup();
    mocks.dispatch.mockResolvedValue({ sentCount: 0, failedCount: 1, errors: [{ error: 'Meta rejected' }] });
    expect((await runWhatsAppAlertQueue()).failed).toBe(1);
    expect(completion.update).toHaveBeenCalledWith(expect.objectContaining({
      last_error: 'Meta rejected', locked_until: null,
    }));
    expect(completion.delete).not.toHaveBeenCalled();
  });
});
