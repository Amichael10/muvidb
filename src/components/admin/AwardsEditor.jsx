import { Icon } from '@iconify/react';

/**
 * Awards & nominations editor for the jsonb `awards` column, shared by the
 * person drawer (people.awards) and the film drawer (films.awards).
 *
 * The two columns hold the same shape except for who the award points at:
 *   person → work (film title) + film_id, so the person page can show a poster
 *   film   → recipients[], the names credited on the film's win
 *
 * @param {{
 *   value: Array<object>,
 *   onChange: (next: Array<object>) => void,
 *   variant: 'person' | 'film',
 * }} props
 */
export default function AwardsEditor({ value, onChange, variant }) {
  const awards = Array.isArray(value) ? value : [];

  const blank = {
    organization: 'AMVCA',
    year: '',
    season: '',
    category: '',
    won: false,
    ...(variant === 'person' ? { work: '' } : { recipients: [] }),
  };

  const update = (idx, patch) => {
    const next = [...awards];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h4 className="text-xs font-bold text-text-muted">Awards &amp; Nominations</h4>
          {awards.length > 0 && (
            <span className="text-[10px] font-black bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5">
              {awards.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange([...awards, blank])}
          className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
        >
          <Icon icon="solar:add-circle-linear" width="16" /> Add award
        </button>
      </div>

      {awards.length === 0 ? (
        <p className="text-xs text-text-muted italic">
          No awards yet. Click &quot;Add award&quot; to record a win or nomination.
        </p>
      ) : (
        <div className="space-y-3">
          {awards.map((award, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-surface-2/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {/* Winner / Nominee is the key distinction on the public page */}
                <div className="flex items-center gap-1 p-1 bg-surface rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => update(idx, { won: true })}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                      award.won ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Winner
                  </button>
                  <button
                    type="button"
                    onClick={() => update(idx, { won: false })}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                      !award.won ? 'bg-amber-500 text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Nominee
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(awards.filter((_, i) => i !== idx))}
                  className="text-text-muted hover:text-red-500 transition-colors"
                  title="Remove this award"
                >
                  <Icon icon="solar:trash-bin-trash-linear" width="16" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Organization"
                  value={award.organization || ''}
                  onChange={(e) => update(idx, { organization: e.target.value })}
                  className="bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
                <input
                  type="number"
                  placeholder="Year"
                  value={award.year || ''}
                  onChange={(e) => update(idx, { year: e.target.value })}
                  className="bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
                <input
                  type="number"
                  placeholder="Season"
                  value={award.season || ''}
                  onChange={(e) => update(idx, { season: e.target.value })}
                  className="bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
              </div>

              <input
                type="text"
                placeholder="Category (e.g. Best Lead Actress)"
                value={award.category || ''}
                onChange={(e) => update(idx, { category: e.target.value })}
                className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
              />

              {variant === 'person' ? (
                <>
                  <input
                    type="text"
                    placeholder="Film / work title (must match the film exactly to link it)"
                    value={award.work || ''}
                    onChange={(e) => update(idx, { work: e.target.value, film_id: null })}
                    className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                  />
                  {award.film_id && (
                    <p className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                      <Icon icon="solar:link-linear" width="12" /> Linked to a film — will show its poster
                    </p>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Recipients, comma separated (e.g. BB Sasore, Kemi Adetiba)"
                  value={(award.recipients || []).join(', ')}
                  onChange={(e) =>
                    update(idx, {
                      recipients: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
