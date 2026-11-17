import { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

export default function AiAssistantTab({ user }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [personalToken, setPersonalToken] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [activeGuide, setActiveGuide] = useState('chatgpt');

  const mcpUrl = 'https://muvidb.com/api/mcp';

  const samplePrompts = [
    {
      id: 'prompt-1',
      category: 'New Releases & Reviews',
      icon: 'solar:fire-bold',
      iconColor: 'text-amber-500',
      title: 'Released this week with reviews & watch link',
      prompt:
        'Which Nollywood movie was released this week with great ratings and reviews? e.g. Orisunmbare on SceneOne with the direct play link.',
      explanation: 'Finds newly released Nigerian movies, critic verdicts, and streaming links in real-time.'
    },
    {
      id: 'prompt-2',
      category: 'Where to Watch',
      icon: 'solar:play-circle-bold',
      iconColor: 'text-brand',
      title: 'Find where to stream any movie',
      prompt:
        'Where can I stream "Five Figurines" or "No Fury" right now? Give me direct watch links or cinema info.',
      explanation: 'Checks Netflix, Prime Video, YouTube channels, and Nigerian cinema circuits.'
    },
    {
      id: 'prompt-3',
      category: 'Artist Filmography',
      icon: 'solar:user-bold',
      iconColor: 'text-purple-400',
      title: 'Verified credits & filmography',
      prompt:
        'Show me Lateef Adedimeji’s full verified filmography, his character roles, and awards he has won.',
      explanation: 'Zero hallucinations. Pulls verified billing orders and character names directly from MuviDB.'
    },
    {
      id: 'prompt-4',
      category: 'Box Office & Cinemas',
      icon: 'solar:ticket-bold',
      iconColor: 'text-emerald-400',
      title: 'Nigerian Cinema & Box Office radar',
      prompt:
        'What films are showing in Nigerian cinemas this weekend, and what is the current #1 Nollywood movie at the box office?',
      explanation: 'Instant showtime updates and all-time/yearly cinema revenue stats.'
    }
  ];

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) {
        toast.error('Please log in again to generate your token.');
        setGeneratingToken(false);
        return;
      }

      const res = await fetch('/api/oauth/create-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.message || 'Failed to generate token');
      }

      setPersonalToken(data.token);
      toast.success('Personal AI Access Token generated!');
    } catch (err) {
      toast.error(err.message || 'Could not generate token');
    } finally {
      setGeneratingToken(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/10 via-surface to-surface p-7 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-[11px] font-black uppercase tracking-wider mb-4">
            <Icon icon="solar:magic-stick-3-bold" className="text-sm" />
            MuviDB AI & MCP · Personal Cinema Concierge
          </div>
          <h2 className="font-heading text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight leading-tight">
            Connect MuviDB to <span className="text-brand">ChatGPT</span> & AI Assistants
          </h2>
          <p className="mt-3 text-sm sm:text-base text-text-muted leading-relaxed">
            Turn ChatGPT, Claude, and Gemini into your personal African cinema concierge. Ask for
            new releases, streaming links, verified actor credits, and cinema showtimes powered by live MuviDB data.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleCopy(mcpUrl, 'mcp-url-hero')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/20 active:scale-95"
            >
              <Icon icon={copiedKey === 'mcp-url-hero' ? 'solar:check-circle-bold' : 'solar:copy-linear'} className="text-base" />
              {copiedKey === 'mcp-url-hero' ? 'Server URL Copied!' : 'Copy Server URL'}
            </button>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>OAuth 2.1 Protected · Free for MuviDB Fans</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 1: Ready-to-Use Prompts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Supercharge your Prompts</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Click any prompt to copy it, then ask ChatGPT or Claude once connected.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {samplePrompts.map((item) => (
            <div
              key={item.id}
              className="group relative bg-surface border border-border hover:border-brand/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    <Icon icon={item.icon} className={`text-sm ${item.iconColor}`} />
                    {item.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.prompt, item.id)}
                    className="opacity-80 group-hover:opacity-100 text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <Icon
                      icon={copiedKey === item.id ? 'solar:check-circle-bold' : 'solar:copy-linear'}
                      className="text-sm"
                    />
                    {copiedKey === item.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <h4 className="text-sm font-bold text-text-primary mb-2">{item.title}</h4>
                <div className="p-3 rounded-xl bg-bg/80 border border-border/70 font-mono text-xs text-text-secondary leading-relaxed mb-3">
                  "{item.prompt}"
                </div>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                💡 {item.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 2: Step-by-Step Setup Guide */}
      <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-text-primary">How to Connect (30-Second Setup)</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Choose your preferred AI tool to see connection instructions.
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-bg p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveGuide('chatgpt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeGuide === 'chatgpt' ? 'bg-brand text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="simple-icons:openai" className="text-sm" />
              ChatGPT
            </button>
            <button
              type="button"
              onClick={() => setActiveGuide('claude')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeGuide === 'claude' ? 'bg-brand text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="simple-icons:anthropic" className="text-sm" />
              Claude / Cursor
            </button>
          </div>
        </div>

        {activeGuide === 'chatgpt' ? (
          <div className="space-y-5">
            <ol className="space-y-4">
              <li className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-text-primary">Open ChatGPT Custom MCP Settings</p>
                  <p className="text-text-muted mt-0.5">
                    In ChatGPT (Plus, Team, or Pro), open <strong>Settings → Connected apps</strong> (or <strong>Apps & Connectors</strong>) and click <strong>Add custom MCP server</strong>.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-text-primary">Enter the MuviDB MCP Server URL</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={mcpUrl}
                      className="bg-bg border border-border px-3.5 py-2 rounded-xl text-xs font-mono text-text-primary w-full max-w-md select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(mcpUrl, 'input-mcp-url')}
                      className="px-3 py-2 rounded-xl bg-surface-elevated border border-border hover:border-brand text-xs font-bold text-text-primary transition-colors shrink-0"
                    >
                      {copiedKey === 'input-mcp-url' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-text-primary">Select Authentication: OAuth</p>
                  <p className="text-text-muted mt-0.5">
                    Set Authentication to <strong>OAuth</strong>. ChatGPT will discover our metadata and open the MuviDB consent window to authorize your account in one click.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Add MuviDB to your <code>claude_desktop_config.json</code> or Cursor / Windsurf settings:
            </p>
            <div className="relative">
              <pre className="bg-bg border border-border p-4 rounded-2xl text-xs font-mono text-text-primary overflow-x-auto">
{`{
  "mcpServers": {
    "muvidb": {
      "url": "https://muvidb.com/api/mcp",
      "headers": {
        "Authorization": "Bearer ${personalToken || '<CLICK_GENERATE_TOKEN_BELOW>'}"
      }
    }
  }
}`}
              </pre>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `{\n  "mcpServers": {\n    "muvidb": {\n      "url": "https://muvidb.com/api/mcp",\n      "headers": {\n        "Authorization": "Bearer ${personalToken || '<YOUR_TOKEN>'}"\n      }\n    }\n  }\n}`,
                    'config-json'
                  )
                }
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-surface border border-border text-[11px] font-bold text-text-muted hover:text-text-primary transition-colors"
              >
                {copiedKey === 'config-json' ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
          </div>
        )}

        {/* Feature 3: Personal Token Generator */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Personal AI Access Token</h4>
            <p className="text-xs text-text-muted mt-0.5">
              Need a direct Bearer token for local agents or developer tools? Generate one for your account ({user?.email}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {personalToken ? (
              <button
                type="button"
                onClick={() => handleCopy(personalToken, 'personal-token')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all"
              >
                <Icon
                  icon={copiedKey === 'personal-token' ? 'solar:check-circle-bold' : 'solar:copy-linear'}
                  className="text-base"
                />
                {copiedKey === 'personal-token' ? 'Token Copied!' : 'Copy Token'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateToken}
                disabled={generatingToken}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-elevated border border-border hover:border-brand text-xs font-bold text-text-primary transition-all disabled:opacity-50"
              >
                {generatingToken ? (
                  <>
                    <Icon icon="solar:spinner-linear" className="animate-spin text-base" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:key-bold" className="text-base text-brand" />
                    Generate Personal Token
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
