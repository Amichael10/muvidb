import { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

function parseAmount(val) {
  if (!val) return null;
  const str = String(val).trim().toLowerCase().replace(/,/g, '').replace(/[₦$£]/g, '');
  if (str.endsWith('b') || str.endsWith('billion')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : Math.round(num * 1_000_000_000);
  }
  if (str.endsWith('m') || str.endsWith('million')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : Math.round(num * 1_000_000);
  }
  if (str.endsWith('k') || str.endsWith('thousand')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : Math.round(num * 1_000);
  }
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function formatPreview(amount, currency = 'NGN') {
  if (!amount || isNaN(amount)) return null;
  const symbol = currency === 'NGN' ? '₦' : `${currency} `;
  if (amount >= 1_000_000_000) {
    return `${symbol}${(amount / 1_000_000_000).toFixed(2)} Billion`;
  }
  if (amount >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(2)} Million`;
  }
  return `${symbol}${amount.toLocaleString()}`;
}

export default function AdminBoxOfficeModal({ film, onClose, onUpdated }) {
  const currentDomestic = film.box_office_domestic || film.streaming_links?.box_office?.domestic || '';
  const currentWorldwide = film.box_office_worldwide || film.streaming_links?.box_office?.worldwide || '';
  const currentOpening = film.box_office_opening_weekend || '';
  const currentCurrency = film.box_office_currency || film.streaming_links?.box_office?.currency || 'NGN';
  const currentSource = film.box_office_source || film.streaming_links?.box_office?.source || 'CEAN Official';

  const [domestic, setDomestic] = useState(currentDomestic ? String(currentDomestic) : '');
  const [worldwide, setWorldwide] = useState(currentWorldwide ? String(currentWorldwide) : '');
  const [openingWeekend, setOpeningWeekend] = useState(currentOpening ? String(currentOpening) : '');
  const [currency, setCurrency] = useState(currentCurrency);
  const [source, setSource] = useState(currentSource);
  const [saving, setSaving] = useState(false);

  const parsedDom = parseAmount(domestic);
  const parsedWw = parseAmount(worldwide);
  const parsedOpen = parseAmount(openingWeekend);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const existingStreaming = typeof film.streaming_links === 'object' && film.streaming_links !== null
        ? { ...film.streaming_links }
        : {};

      const boxOfficeData = {
        domestic: parsedDom,
        worldwide: parsedWw,
        opening_weekend: parsedOpen,
        currency,
        source: source.trim() || 'CEAN Official',
        updated_at: now
      };

      const payload = {
        box_office_domestic: parsedDom,
        box_office_worldwide: parsedWw,
        box_office_opening_weekend: parsedOpen,
        box_office_currency: currency,
        box_office_source: source.trim() || 'CEAN Official',
        box_office_updated_at: now,
        streaming_links: {
          ...existingStreaming,
          box_office: boxOfficeData
        },
        updated_at: now
      };

      const { data, error } = await supabase
        .from('films')
        .update(payload)
        .eq('id', film.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Box office figures updated successfully!');
      if (onUpdated) onUpdated(data);
      onClose();
    } catch (err) {
      console.error('Error updating box office:', err);
      toast.error(err.message || 'Failed to update box office');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Icon icon="solar:ticket-bold" width="22" />
            </span>
            <div>
              <h3 className="text-text-primary text-base sm:text-lg font-bold tracking-tight">
                Update Box Office Figures
              </h3>
              <p className="text-text-muted text-xs truncate max-w-xs sm:max-w-sm">
                {film.title} {film.year ? `(${film.year})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg"
          >
            <Icon icon="solar:close-circle-linear" width="24" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Domestic Gross */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-xs font-bold uppercase tracking-wider block">
                Domestic Gross (₦) <span className="text-brand">*</span>
              </label>
              {parsedDom ? (
                <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {formatPreview(parsedDom, currency)}
                </span>
              ) : null}
            </div>
            <div className="relative">
              <input
                type="text"
                value={domestic}
                onChange={(e) => setDomestic(e.target.value)}
                placeholder="e.g. 550,000,000 or 550m or 1.2b"
                className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none placeholder-text-muted transition-all font-mono"
                required
              />
            </div>
            <p className="text-text-muted text-[11px]">
              Tip: You can type shorthand like <code className="text-brand">450m</code> or <code className="text-brand">1.2b</code>.
            </p>
          </div>

          {/* Worldwide Gross */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-xs font-bold uppercase tracking-wider block">
                Worldwide Gross (Optional)
              </label>
              {parsedWw ? (
                <span className="text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {formatPreview(parsedWw, currency)}
                </span>
              ) : null}
            </div>
            <input
              type="text"
              value={worldwide}
              onChange={(e) => setWorldwide(e.target.value)}
              placeholder="e.g. 750,000,000 or 750m"
              className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none placeholder-text-muted transition-all font-mono"
            />
          </div>

          {/* Opening Weekend */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-xs font-bold uppercase tracking-wider block">
                Opening Weekend Gross (Optional)
              </label>
              {parsedOpen ? (
                <span className="text-xs font-bold text-text-muted">
                  {formatPreview(parsedOpen, currency)}
                </span>
              ) : null}
            </div>
            <input
              type="text"
              value={openingWeekend}
              onChange={(e) => setOpeningWeekend(e.target.value)}
              placeholder="e.g. 85,000,000 or 85m"
              className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none placeholder-text-muted transition-all font-mono"
            />
          </div>

          {/* Currency & Source Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-bold uppercase tracking-wider block">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none"
              >
                <option value="NGN">NGN (₦) — Nigerian Naira</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GHS">GHS (GH₵) — Ghanaian Cedi</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-bold uppercase tracking-wider block">
                Data Source / Verification
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. CEAN Official"
                className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none placeholder-text-muted"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border text-text-secondary hover:text-text-primary text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin" width="16" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" width="16" />
                  <span>Save Figures</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
