import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), send: vi.fn(), configured: vi.fn(), enqueue: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
vi.mock('./telegram.js', () => ({ sendTelegramMessage: mocks.send, telegramConfigured: mocks.configured }));
vi.mock('./whatsapp_alert_queue.js', () => ({ enqueueMovieWhatsAppAlert: mocks.enqueue }));
import { monitorWhatsAppAlerts } from './whatsapp_monitor';

function query(data: unknown) {
  const q: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
  for (const method of ['select','eq','lt','lte','is','or','order','limit','not','neq','update']) q[method] = vi.fn(() => q);
  return q;
}
beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); });

it('flags an unconfirmed message without resending it and sends one claimed notification', async () => {
  const retries = query([]);
  const issues = query([{ id: 'alert', film_id: 'film', status: 'sent', films: { title: 'Film' } }]);
  const claim = query([{ id: 'alert' }]);
  mocks.from.mockReturnValueOnce(retries).mockReturnValueOnce(issues).mockReturnValueOnce(query([])).mockReturnValueOnce(claim);
  mocks.send.mockResolvedValue({ ok: true });
  expect((await monitorWhatsAppAlerts()).notified).toBe(1);
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(mocks.send).toHaveBeenCalledWith(expect.stringContaining('Not resent automatically'));
  expect(retries.eq).toHaveBeenCalledWith('status', 'failed');
  expect(claim.is).toHaveBeenCalledWith('issue_notified_at', null);
});

it('queues due retries even if Telegram is not configured', async () => {
  mocks.configured.mockReturnValue(false);
  mocks.from.mockReturnValue(query([{ film_id: 'film' }, { film_id: 'film' }]));
  await monitorWhatsAppAlerts();
  expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  expect(mocks.send).not.toHaveBeenCalled();
});

it('does not repeat an alert already claimed by another monitor', async () => {
  mocks.from.mockReturnValueOnce(query([]))
    .mockReturnValueOnce(query([{ id: 'alert', film_id: 'film', status: 'failed' }]))
    .mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
  expect((await monitorWhatsAppAlerts()).notified).toBe(0);
  expect(mocks.send).not.toHaveBeenCalled();
});

it('releases the notification claim when Telegram fails', async () => {
  const reset = query([]);
  mocks.from.mockReturnValueOnce(query([]))
    .mockReturnValueOnce(query([{ id: 'alert', film_id: 'film', status: 'failed' }]))
    .mockReturnValueOnce(query([])).mockReturnValueOnce(query([{ id: 'alert' }])).mockReturnValueOnce(reset);
  mocks.send.mockResolvedValue({ ok: false, error: 'unavailable' });
  await expect(monitorWhatsAppAlerts()).rejects.toThrow('notification failed');
  expect(reset.update).toHaveBeenCalledWith({ issue_notified_at: null });
});
