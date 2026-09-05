import { useState } from 'react';
import { creditNameKey } from '../../lib/creditReconciliation';
import { Icon } from '@iconify/react';

function ComparisonRow({ comparison, disabled, onApply, compareLocal }) {
  const [name, setName] = useState(comparison.reading.raw_name);
  const [role, setRole] = useState(comparison.reading.role_or_character);
  const [targetId, setTargetId] = useState(comparison.targetId);
  const [duplicateIds, setDuplicateIds] = useState(comparison.duplicateIds);
  const [applied, setApplied] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const target = comparison.candidates.find(row => row.id === targetId);
  const related = comparison.candidates.filter(row => comparison.matches.some(match => match.id === row.id)
    || (target && (creditNameKey(target.raw_name) === creditNameKey(row.raw_name)
      || (target.matched_person_id && target.matched_person_id === row.matched_person_id))));

  const isCorrection = Boolean(target && (target.raw_name !== name || (target.role_or_character || '') !== role));

  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
      applied 
        ? 'border-green-500/40 bg-green-500/5 opacity-80' 
        : isCorrection 
          ? 'border-amber-500/40 bg-amber-500/5' 
          : targetId === '__new__' 
            ? 'border-blue-500/40 bg-blue-500/5' 
            : 'border-border bg-surface'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
          applied
            ? 'bg-green-500/20 text-green-400'
            : isCorrection
              ? 'bg-amber-500/20 text-amber-300'
              : targetId === '__new__'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-surface-2 text-text-primary'
        }`}>
          {applied ? (
            <>
              <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />
              Applied & Saved
            </>
          ) : isCorrection ? (
            <>
              <Icon icon="solar:pen-bold" className="w-3.5 h-3.5" />
              Correcting: "{target?.raw_name}"
            </>
          ) : targetId === '__new__' ? (
            <>
              <Icon icon="solar:user-plus-bold" className="w-3.5 h-3.5" />
              New candidate (not in list)
            </>
          ) : (
            <>
              <Icon icon="solar:check-read-linear" className="w-3.5 h-3.5" />
              {comparison.agreement}
            </>
          )}
        </span>

        {target && (
          <span className="text-[10px] text-text-muted font-bold">
            Target ID: #{target.id.slice(0, 6)}
          </span>
        )}
      </div>

      {isCorrection && target && (
        <div className="text-[11px] bg-surface-2/80 rounded-lg p-2 border border-border/80 flex items-center justify-between gap-2 text-text-secondary">
          <div className="truncate">
            <span className="text-text-muted">Current:</span> <strong className="text-text-primary">{target.raw_name}</strong> {target.role_or_character ? `(${target.role_or_character})` : ''}
          </div>
          <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="truncate">
            <span className="text-text-muted">New:</span> <strong className="text-brand">{name}</strong> {role ? `(${role})` : ''}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Corrected Name
          <input 
            aria-label="Screenshot name" 
            value={name} 
            disabled={disabled || applied || saving} 
            onChange={event => setName(event.target.value)} 
            className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary focus:border-brand outline-none" 
          />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Character / Role
          <input 
            aria-label="Screenshot character or role" 
            value={role} 
            disabled={disabled || applied || saving} 
            onChange={event => setRole(event.target.value)} 
            className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary focus:border-brand outline-none" 
          />
        </label>
      </div>

      {comparison.local.length > 0 && (
        <p className="text-[10px] text-text-secondary flex items-center gap-1">
          <Icon icon="solar:info-circle-linear" className="w-3.5 h-3.5 text-text-muted" />
          Local OCR: {comparison.local.map(item => `${item.name} — ${item.role_or_character || 'no role'}`).join('; ')}
        </p>
      )}

      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
        Select Existing Candidate to Replace
        <select 
          aria-label="Credit to correct" 
          value={targetId} 
          disabled={disabled || applied || saving} 
          onChange={event => { setTargetId(event.target.value); setDuplicateIds([]); }} 
          className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary focus:border-brand outline-none"
        >
          <option value="">Choose a row to replace</option>
          {comparison.matches.map(row => (
            <option key={row.id} value={row.id}>
              🎯 Match: {row.raw_name} — {row.role_or_character || 'no role'} ({row.status})
            </option>
          ))}
          <optgroup label="All other queued credits in movie">
            {comparison.candidates.filter(row => !comparison.matches.some(match => match.id === row.id)).map(row => (
              <option key={row.id} value={row.id}>
                {row.raw_name} — {row.role_or_character || 'no role'} ({row.status})
              </option>
            ))}
          </optgroup>
          <option value="__new__">➕ Add as a brand new credit</option>
        </select>
      </label>

      {targetId && targetId !== '__new__' && related.filter(row => row.id !== targetId && row.status === 'pending').map(row => (
        <label key={row.id} className="flex gap-2 items-center text-xs text-text-secondary bg-surface-2/40 px-2 py-1 rounded">
          <input 
            type="checkbox" 
            disabled={disabled || applied || saving} 
            checked={duplicateIds.includes(row.id)} 
            onChange={event => setDuplicateIds(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} 
          />
          <span>Merge repeat candidate: <strong>{row.raw_name}</strong></span>
        </label>
      ))}

      <button 
        type="button" 
        disabled={disabled || saving || applied || !targetId || !name.trim()} 
        onClick={async () => {
          setSaving(true);
          try { 
            if (await onApply({ ...comparison.reading, raw_name: name, role_or_character: role }, targetId, duplicateIds)) {
              setApplied(true);
            } 
          }
          finally { setSaving(false); }
        }} 
        className={`w-full rounded-lg px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
          targetId === '__new__'
            ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
            : 'bg-brand/15 text-brand hover:bg-brand/25 border border-brand/30'
        }`}
      >
        {saving ? (
          <>
            <Icon icon="solar:refresh-linear" className="w-3.5 h-3.5 animate-spin" />
            Saving…
          </>
        ) : applied ? (
          <>
            <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />
            Applied
          </>
        ) : targetId === '__new__' ? (
          <>
            <Icon icon="solar:user-plus-bold" className="w-3.5 h-3.5" />
            Insert as New Credit
          </>
        ) : (
          <>
            <Icon icon="solar:pen-new-square-linear" className="w-3.5 h-3.5" />
            Replace & Update Candidate
          </>
        )}
      </button>
    </div>
  );
}

export default function CreditScreenshotComparison({ preview, disabled, onApply, onApplyAll }) {
  const [applyingAll, setApplyingAll] = useState(false);

  const handleApplyAll = async () => {
    if (!onApplyAll) return;
    setApplyingAll(true);
    try {
      await onApplyAll(preview.comparisons);
    } finally {
      setApplyingAll(false);
    }
  };

  const actionableCount = preview.comparisons.filter(c => c.targetId && c.targetId !== '__new__').length;

  return (
    <section className="space-y-3" aria-label="Screenshot comparison results">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <div>
          <h4 className="text-xs font-black text-text-primary">
            Comparison Results ({preview.comparisons.length} detected)
          </h4>
          <p className="text-[10px] text-text-muted">
            Matches are pre-linked to existing candidates to update in-place.
          </p>
        </div>

        {onApplyAll && (
          <button
            type="button"
            disabled={disabled || applyingAll}
            onClick={handleApplyAll}
            className="px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-black hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {applyingAll ? (
              <Icon icon="solar:refresh-linear" className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Icon icon="solar:magic-stick-3-bold" className="w-3.5 h-3.5" />
            )}
            Apply All ({actionableCount} updates)
          </button>
        )}
      </div>

      {preview.localError && (
        <p className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
          Local screenshot OCR was unavailable. Comparing AI reading directly with queued credits.
        </p>
      )}

      <div className="space-y-2.5">
        {preview.comparisons.map((comparison, index) => (
          <ComparisonRow 
            key={`${preview.id}-${index}`} 
            comparison={comparison} 
            disabled={disabled || applyingAll} 
            compareLocal={preview.engine === 'ai' && !preview.localError} 
            onApply={onApply} 
          />
        ))}
      </div>
    </section>
  );
}

