import { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';

const PRESET_PROMPTS = [
  'Compare my filmography genres against top trending African cinema genres',
  'What are the highest performing Nollywood release formats right now?',
  'Give me an executive talent breakdown for leading Nollywood actors & directors',
  'What streaming and YouTube distribution patterns are most effective for African indies?',
];

export default function ProIntelligenceAssistant({ person, credits = [] }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState([]);

  const handleAsk = async (promptToAsk) => {
    const q = (promptToAsk || query).trim();
    if (!q) return;

    setLoading(true);
    setQuery(q);

    try {
      const res = await fetch('/api/pro-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          personContext: person ? { name: person.name, department: person.known_for_department, creditsCount: credits.length } : null,
          history: history.slice(-4),
        }),
      });

      if (!res.ok) {
        throw new Error('Intelligence request failed');
      }

      const data = await res.json();
      setResponse(data);
      setHistory((prev) => [...prev, { q, a: data.answer }]);
    } catch (err) {
      console.error(err);
      toast.error('Could not fetch industry intelligence. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-[#1b120c] via-[#141414] to-[#0f0f0f] p-6 sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Icon icon="solar:magic-stick-3-bold" width="14" />
              Cohere Grounded Intelligence
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-text-primary sm:text-3xl">
              African Cinema Industry Analyst
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted sm:text-sm">
              Ask deep questions about talent filmographies, distribution metrics, box office trends, and market intelligence — grounded strictly on verified MuviDB data.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 text-xs font-bold text-brand md:flex">
            <Icon icon="solar:shield-check-bold" width="20" />
            Verified Nollywood Data
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(query);
          }}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Icon
              icon="solar:magnifer-linear"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              width="18"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Compare box office trends for drama vs comedy in 2025/2026..."
              className="w-full rounded-2xl border border-white/10 bg-black/50 py-3.5 pl-11 pr-4 text-xs font-medium text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon icon="solar:restart-bold" className="animate-spin" width="16" />
                Analyzing...
              </>
            ) : (
              <>
                <Icon icon="solar:stars-minimalistic-bold" width="16" />
                Analyze Query
              </>
            )}
          </button>
        </form>

        {/* Preset Prompt Chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAsk(prompt)}
              className="rounded-full border border-white/5 bg-white/[.03] px-3 py-1.5 text-[11px] font-medium text-text-muted transition hover:border-brand/40 hover:bg-brand/10 hover:text-text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Answer Output */}
      {loading && (
        <div className="rounded-3xl border border-white/10 bg-[#161616] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Icon icon="solar:magic-stick-3-bold" className="animate-pulse" width="24" />
          </div>
          <h3 className="mt-4 text-sm font-black text-text-primary">Grounding Intelligence on Verified Data</h3>
          <p className="mt-1 text-xs text-text-muted">
            Querying Nollywood filmographies, credits, and streaming performance records...
          </p>
        </div>
      )}

      {!loading && response && (
        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#161616] p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-brand">
                <Icon icon="solar:document-text-bold" width="16" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-text-primary">
                Executive Analysis
              </span>
            </div>
            {response.engine && (
              <span className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-0.5 text-[10px] font-bold text-text-muted">
                {response.engine}
              </span>
            )}
          </div>

          <div className="prose prose-invert max-w-none text-xs leading-relaxed text-text-muted sm:text-sm">
            <div className="whitespace-pre-line text-text-primary">{response.answer}</div>
          </div>

          {/* Follow-Up Suggested Inquiries */}
          {response.suggestedQueries && response.suggestedQueries.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand">
                Suggested Follow-Up Inquiries
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {response.suggestedQueries.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(sq)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.02] px-3.5 py-2 text-xs font-semibold text-text-primary transition hover:border-brand hover:bg-brand/5"
                  >
                    <Icon icon="solar:arrow-right-up-linear" width="14" className="text-brand" />
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
