import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
import { recordWhatsAppDeliveryStatuses } from './whatsapp_delivery_status';
beforeEach(() => vi.resetAllMocks());

it('captures Meta failure details across all batched changes', async () => {
  const q: any = { update: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn().mockResolvedValue({ error: null }) };
  mocks.from.mockReturnValue(q);
  await recordWhatsAppDeliveryStatuses({ entry: [{ changes: [{ value: { statuses: [
    { id: 'message', status: 'failed', errors: [{ code: 131026, error_data: { details: 'Undeliverable' } }] },
  ] } }, { value: { statuses: [{ id: 'other', status: 'delivered' }] } }] }] });
  expect(q.update).toHaveBeenCalledWith({ status: 'failed', error_message: '131026: Undeliverable' });
  expect(q.update).toHaveBeenCalledWith({ status: 'delivered', error_message: null });
  expect(q.in).toHaveBeenCalledWith('status', ['sent', 'delivered']);
});

it('throws on persistence failures so Meta can retry its webhook', async () => {
  const q: any = { update: () => q, eq: () => q, in: () => ({ error: { message: 'DB unavailable' } }) };
  mocks.from.mockReturnValue(q);
  await expect(recordWhatsAppDeliveryStatuses({ entry: [{ changes: [{ value: { statuses: [
    { id: 'message', status: 'read' },
  ] } }] }] })).rejects.toThrow('DB unavailable');
});
