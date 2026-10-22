import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';

const STARTER_PROMPTS = [
  {
    icon: 'solar:film-strip-bold',
    label: 'Spotlight Upcoming Movie',
    prompt: 'Check the database for an upcoming Nigerian movie releasing soon and create an engaging Instagram and Threads announcement post draft for it.',
  },
  {
    icon: 'solar:user-star-bold',
    label: 'Actor Spotlight with @handle',
    prompt: 'Look up Timini Egbuson in our database, fetch his credits and Instagram handle, and write a high-energy spotlight post celebrating his career.',
  },
  {
    icon: 'solar:masks-bold',
    label: "What's On Stage in Lagos",
    prompt: 'Check for upcoming or running stage plays in our database and draft a post highlighting the production and venue.',
  },
  {
    icon: 'solar:chat-round-line-bold',
    label: 'Critic Review Debate',
    prompt: 'Check critic reviews for A Tribe Called Judah or Jagun Jagun, quote a top critic, and write a debate caption asking the audience their take.',
  },
  {
    icon: 'solar:calendar-add-bold',
    label: 'Schedule 5 Latest Streaming/YT Films',
    prompt: 'Schedule posts for the 5 latest youtube, streaming platforms movie with portrait poster in our db.',
  },
  {
    icon: 'solar:calendar-mark-bold',
    label: 'Inspect My Queue & Schedule',
    prompt: 'What posts do we have scheduled or drafted in the queue right now? Give me a quick summary.',
  },
];

export default function StudioCopilot({
  onOpenDraftInComposer,
  onSwitchToTab,
  onRefreshStudioData,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your **MuviDB Social Copilot**, powered by **Cohere Command-R**.

I have direct access to your MuviDB database and publishing tools:
- 🎬 **Film Intelligence**: Check release dates, synopses, and streaming platforms (Netflix, Prime, YouTube, Cinemas).
- ⭐ **Cast & Talent**: Pull actor filmographies and verified social handles (@Instagram, @Twitter).
- 🍿 **Critic Reviews**: Pull quotes and ratings from top Nollywood critics.
- 🎭 **Stage Plays**: Discover live Nigerian theatre productions.
- ✍️ **Automated Drafting**: Instruct me to write and save drafts or schedule posts directly into your studio queue!

What would you like to create or explore today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeToolStatus, setActiveToolStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');
    const userMsgId = crypto.randomUUID();
    const newHistory = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(newHistory);
    setLoading(true);
    setActiveToolStatus('Connecting to Cohere...');

    // Convert UI messages to API chatHistory
    const apiHistory = newHistory
      .filter((m) => m.id !== 'welcome' && m.id !== userMsgId)
      .map((m) => ({
        role: m.role === 'user' ? 'USER' : 'CHATBOT',
        message: m.content,
      }));

    try {
      setActiveToolStatus('Thinking & inspecting database...');
      const res = await fetch('/api/social?task=copilot_chat', {
        method: 'POST',
        headers: {
          ...(await authHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          chatHistory: apiHistory,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const botReply = data.response || 'Task completed.';
      const actions = data.actionsExecuted || [];

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: botReply,
          actions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      const createdDrafts = actions.filter((a) => a.tool === 'create_social_draft');
      const batchScheduled = actions.filter((a) => a.tool === 'batch_schedule_posts');
      if (batchScheduled.length > 0) {
        const total = batchScheduled.reduce((acc, a) => acc + (a.result?.count || 0), 0);
        toast.success(`🚀 Scheduled ${total} posts across upcoming calendar slots!`);
        if (onRefreshStudioData) onRefreshStudioData();
      } else if (createdDrafts.length > 0) {
        toast.success('Social post drafted successfully!');
        if (onRefreshStudioData) onRefreshStudioData();
      }
    } catch (err) {
      console.error('[Copilot Error]', err);
      toast.error(err.message || 'Copilot could not process your instruction');
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ **Error**: ${err.message || 'Something went wrong while contacting Cohere. Please try again.'}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setActiveToolStatus(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Chat cleared. How can I help you with your Nollywood social campaigns today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="flex h-[750px] flex-col rounded-3xl border border-white/10 bg-surface shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-surface-2/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand via-orange-500 to-amber-400 text-white shadow-lg shadow-brand/20">
            <Icon icon="solar:chat-round-line-bold" width="22" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-text-primary">Studio Copilot</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cohere Command-R Active
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Autonomous Nollywood content agent with live DB tools & direct publishing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearChat}
            title="Clear Chat History"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all"
          >
            <Icon icon="solar:restart-bold" width="14" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-amber-500 text-white shadow-sm mt-1">
                <Icon icon="solar:stars-bold" width="16" />
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-2xl p-4.5 text-sm leading-relaxed transition-all shadow-sm ${
                msg.role === 'user'
                  ? 'bg-brand text-white rounded-br-xs font-medium'
                  : msg.isError
                  ? 'border border-red-500/20 bg-red-500/10 text-red-300 rounded-bl-xs'
                  : 'border border-white/10 bg-surface-2/80 text-text-primary rounded-bl-xs'
              }`}
            >
              {/* Message text with basic Markdown handling */}
              <div className="space-y-2 whitespace-pre-wrap font-sans">
                {msg.content}
              </div>

              {/* Action Cards (if tools created drafts) */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3.5 space-y-2.5 pt-3 border-t border-white/10">
                  {msg.actions.map((act, idx) => {
                    if (act.tool === 'create_social_draft' && act.result?.success) {
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 text-xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                              <Icon icon="solar:check-circle-bold" width="16" />
                              Draft Created in Studio
                            </span>
                            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                              {act.result.status || 'draft'}
                            </span>
                          </div>

                          <p className="font-semibold text-white text-sm mb-1">{act.result.title}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(act.result.platforms || []).map((p) => (
                              <span
                                key={p}
                                className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-bold text-text-muted capitalize"
                              >
                                {p}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSwitchToTab) onSwitchToTab('drafts');
                              }}
                              className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all"
                            >
                              <Icon icon="solar:posts-carousel-vertical-bold" width="13" />
                              <span>View in Queue</span>
                            </button>

                            {act.result.content_item_id && onOpenDraftInComposer && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenDraftInComposer({ id: act.result.content_item_id });
                                }}
                                className="flex items-center gap-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 font-bold text-text-primary hover:bg-surface-3 transition-all"
                              >
                                <Icon icon="solar:pen-new-square-bold" width="13" />
                                <span>Edit in Composer</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (act.tool === 'batch_schedule_posts' && act.result?.success) {
                      const items = act.result.scheduled_items || [];
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5 text-xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 font-bold text-indigo-400">
                              <Icon icon="solar:calendar-mark-bold" width="16" />
                              {act.result.count} Posts Scheduled in Studio
                            </span>
                            <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-300">
                              {act.result.status || 'scheduled'}
                            </span>
                          </div>

                          <div className="space-y-1.5 mb-3">
                            {items.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-center justify-between bg-black/40 rounded-lg px-2.5 py-1.5">
                                <span className="font-semibold text-white truncate max-w-[65%]">
                                  {item.film_title || item.title}
                                </span>
                                <span className="text-[10px] font-mono text-indigo-300 shrink-0">
                                  {item.scheduled_date} {item.scheduled_time?.slice(0, 5) || ''} WAT
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSwitchToTab) onSwitchToTab('calendar');
                              }}
                              className="flex items-center gap-1 rounded-lg bg-indigo-500/20 px-3 py-1.5 font-bold text-indigo-300 hover:bg-indigo-500/30 transition-all"
                            >
                              <Icon icon="solar:calendar-bold" width="13" />
                              <span>View Calendar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (onSwitchToTab) onSwitchToTab('drafts');
                              }}
                              className="flex items-center gap-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 font-bold text-text-primary hover:bg-surface-3 transition-all"
                            >
                              <Icon icon="solar:posts-carousel-vertical-bold" width="13" />
                              <span>View in Queue</span>
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}

              {/* Bottom bar inside assistant bubble */}
              {msg.role === 'assistant' && (
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-text-muted">
                  <span>{msg.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(msg.content)}
                    className="flex items-center gap-1 text-text-muted hover:text-white transition-colors"
                  >
                    <Icon icon="solar:copy-linear" width="12" />
                    <span>Copy</span>
                  </button>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-surface-3 text-text-muted mt-1 border border-white/10">
                <Icon icon="solar:user-bold" width="16" />
              </div>
            )}
          </div>
        ))}

        {/* Loading state with tool activity */}
        {loading && (
          <div className="flex gap-3.5 justify-start">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-amber-500 text-white shadow-sm mt-1 animate-pulse">
              <Icon icon="solar:stars-bold" width="16" />
            </div>
            <div className="rounded-2xl rounded-bl-xs border border-white/10 bg-surface-2/80 p-4 text-sm text-text-muted flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-brand animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-brand animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-xs font-semibold text-text-primary">
                {activeToolStatus || 'Cohere is analyzing & formulating response...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts Carousel (when input is clean) */}
      <div className="border-t border-white/10 bg-surface-2/30 px-6 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-black uppercase tracking-wider text-text-muted shrink-0 flex items-center gap-1">
            <Icon icon="solar:bolt-bold" width="13" className="text-amber-400" />
            Quick Ideas:
          </span>
          {STARTER_PROMPTS.map((starter, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSubmit(starter.prompt)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs text-text-muted hover:border-brand/40 hover:text-white hover:bg-surface-3 transition-all"
            >
              <Icon icon={starter.icon} width="13" className="text-brand" />
              <span>{starter.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="border-t border-white/10 bg-surface-2/70 p-4">
        <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-surface p-2 shadow-inner focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/20 transition-all">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or instruct: 'Spotlight Jagun Jagun on IG', 'Draft a post for stage play in Lagos', 'Find top reviews for Timini'..."
            className="flex-1 resize-none bg-transparent px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || loading}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-all ${
              input.trim() && !loading
                ? 'bg-brand shadow-md shadow-brand/30 hover:bg-brand/90 hover:scale-105 active:scale-95'
                : 'bg-surface-3 text-text-muted cursor-not-allowed opacity-50'
            }`}
          >
            <Icon icon="solar:plain-bold" width="18" />
          </button>
        </div>
      </div>
    </div>
  );
}
