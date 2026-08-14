import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { authHeaders } from '../../lib/apiAuth';
import { getFriendlyErrorMessage } from '../../utils/errors';

export default function AdminEditorial() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'calendar' | 'ideas' | 'drafts' | 'published' | 'series' | 'settings'

  // Overview Data
  const [overviewData, setOverviewData] = useState({
    upcomingSlots: [],
    draftsNeedingReview: [],
    reactiveEvents: [],
    recentHistory: [],
  });

  // Calendar Data
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Active Draft / Brief View
  const [activeDraft, setActiveDraft] = useState(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  // Series List
  const [seriesList, setSeriesList] = useState([]);

  // Manual Reactive Event Modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'movie_announcement',
    source_url: '',
    urgency: 'medium',
  });

  // Load Overview Data
  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/social?task=overview');
      if (!res.ok) throw new Error('Failed to fetch overview');
      const data = await res.json();
      setOverviewData(data);
    } catch (err) {
      console.warn('Overview fetch warning:', err);
    }
  };

  // Load Calendar Slots
  const fetchCalendar = async () => {
    try {
      const res = await fetch('/api/social?task=calendar');
      if (!res.ok) throw new Error('Failed to fetch calendar');
      const data = await res.json();
      setCalendarSlots(data.slots || []);
    } catch (err) {
      console.warn('Calendar fetch warning:', err);
    }
  };

  // Load Series Registry
  const fetchSeries = async () => {
    try {
      const res = await fetch('/api/social?task=series');
      if (!res.ok) throw new Error('Failed to fetch series');
      const data = await res.json();
      setSeriesList(data.series || []);
    } catch (err) {
      console.warn('Series fetch warning:', err);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchCalendar();
    fetchSeries();
  }, []);

  // Fetch Candidates for a selected slot's series
  const handleSelectSlot = async (slot) => {
    setSelectedSlot(slot);
    setSelectedCandidate(null);
    setIsLoadingCandidates(true);
    const slug = slot.social_content_series?.slug || 'filmography';

    try {
      const res = await fetch(`/api/social?task=candidates&seriesSlug=${slug}`);
      if (!res.ok) throw new Error('Failed to fetch candidates');
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  // Generate Editorial Brief (Fact-Pack + Angles + Multi-platform copy)
  const handleGenerateBrief = async () => {
    if (!selectedCandidate || !selectedSlot) {
      toast.error('Please select a candidate entity first.');
      return;
    }

    setIsGeneratingBrief(true);
    const toastId = toast.loading(`Building fact pack & generating copy for ${selectedCandidate.candidate.name}…`);

    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          task: 'generate_brief',
          entityType: selectedCandidate.candidate.type,
          entityId: selectedCandidate.candidate.id,
          figmaTemplateKey: selectedSlot.social_content_series?.figma_template_key || 'people-filmography',
          calendarId: selectedSlot.id,
          seriesId: selectedSlot.series_id,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate brief');
      }

      const data = await res.json();
      setActiveDraft(data);
      toast.success('Editorial Brief Generated!', { id: toastId });
      setActiveTab('drafts');
      fetchCalendar();
      fetchOverview();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err), { id: toastId });
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  // Mark Published
  const handleMarkPublished = async (draftId, calendarId, entityType, entityId, platform = 'instagram') => {
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          task: 'mark_published',
          draftId,
          calendarId,
          entityType,
          entityId,
          platform,
        }),
      });

      if (!res.ok) throw new Error('Failed to mark published');
      toast.success('Marked as Published! Entity history updated.');
      fetchOverview();
      fetchCalendar();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    }
  };

  // Save Reactive Event
  const handleSaveEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const { error } = await supabase.from('social_news_events').insert({
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || null,
        event_type: newEvent.event_type,
        source_url: newEvent.source_url.trim() || null,
        urgency: newEvent.urgency,
        source_type: 'manual',
        status: 'new',
      });

      if (error) throw error;
      toast.success('Content opportunity logged!');
      setIsEventModalOpen(false);
      setNewEvent({ title: '', description: '', event_type: 'movie_announcement', source_url: '', urgency: 'medium' });
      fetchOverview();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Editorial Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-border">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">Internal Editorial Studio</p>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">MuviDB Editorial</h1>
          <p className="text-text-muted text-sm mt-1 max-w-2xl font-medium leading-relaxed opacity-80">
            Calendar-driven content pipeline for African cinema, theatre, critics & streaming. Fact-checked candidate selection, Cohere editorial briefs, and Figma design copy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEventModalOpen(true)}
            className="px-4 py-2.5 bg-brand text-black font-black text-xs uppercase tracking-wider rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-sm"
          >
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            + Add Opportunity
          </button>
        </div>
      </header>

      {/* Editorial Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 overflow-x-auto custom-scrollbar pb-1">
        {[
          { id: 'overview', label: 'Overview', icon: 'solar:widget-3-bold' },
          { id: 'calendar', label: 'Calendar', icon: 'solar:calendar-bold' },
          { id: 'ideas', label: 'Ideas & News', icon: 'solar:lightbulb-bold' },
          { id: 'drafts', label: 'Drafts & Briefs', icon: 'solar:document-text-bold' },
          { id: 'published', label: 'Published', icon: 'solar:check-circle-bold' },
          { id: 'series', label: 'Content Series', icon: 'solar:layers-bold' },
          { id: 'settings', label: 'Settings', icon: 'solar:settings-bold' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 rounded-t-lg font-bold text-xs flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
              activeTab === t.id
                ? 'border-brand text-brand bg-brand/5'
                : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-2/40'
            }`}
          >
            <Icon icon={t.icon} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-cal p-5 space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Upcoming Slots (7 Days)</span>
              <p className="text-2xl font-black text-brand">{overviewData.upcomingSlots.length}</p>
              <p className="text-xs text-text-muted">Planned calendar slots</p>
            </div>
            <div className="card-cal p-5 space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Drafts Needing Review</span>
              <p className="text-2xl font-black text-yellow-400">{overviewData.draftsNeedingReview.length}</p>
              <p className="text-xs text-text-muted">Ready for human editor review</p>
            </div>
            <div className="card-cal p-5 space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Reactive Opportunities</span>
              <p className="text-2xl font-black text-blue-400">{overviewData.reactiveEvents.length}</p>
              <p className="text-xs text-text-muted">News drops & DB events</p>
            </div>
            <div className="card-cal p-5 space-y-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Recent Publications</span>
              <p className="text-2xl font-black text-green-400">{overviewData.recentHistory.length}</p>
              <p className="text-xs text-text-muted">Logged in entity history</p>
            </div>
          </div>

          {/* Upcoming 7-Day Editorial Schedule */}
          <div className="card-cal p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-text-primary">Next 7 Days Schedule</h3>
              <button onClick={() => setActiveTab('calendar')} className="text-xs text-brand font-bold hover:underline">
                View Full Calendar →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overviewData.upcomingSlots.map((slot) => (
                <div
                  key={slot.id}
                  onClick={() => {
                    handleSelectSlot(slot);
                    setActiveTab('calendar');
                  }}
                  className="p-4 bg-surface-2/40 border border-border rounded-xl hover:border-brand/50 cursor-pointer transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-brand uppercase tracking-wider">
                      {new Date(slot.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 border border-border">
                      {slot.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">{slot.social_content_series?.name || 'Content Slot'}</h4>
                    <p className="text-xs text-text-muted line-clamp-1">{slot.social_content_series?.description || 'Recurring post'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CALENDAR & SELECTION WORKFLOW */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: 30-Day Slots List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card-cal p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-brand">30-Day Calendar Slots</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {calendarSlots.map((slot) => (
                  <div
                    key={slot.id}
                    onClick={() => handleSelectSlot(slot)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      selectedSlot?.id === slot.id
                        ? 'border-brand bg-brand/10 ring-1 ring-brand/30'
                        : 'border-border bg-surface-2/30 hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-black text-text-primary">
                        {new Date(slot.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        slot.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-surface-2 text-text-muted'
                      }`}>
                        {slot.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-brand truncate">{slot.social_content_series?.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Candidate Rerank & Selection Engine */}
          <div className="lg:col-span-2 space-y-6">
            {selectedSlot ? (
              <div className="card-cal p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="text-[10px] font-black text-brand uppercase tracking-widest">
                      Slot: {new Date(selectedSlot.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                    <h3 className="text-xl font-black text-text-primary">{selectedSlot.social_content_series?.name}</h3>
                  </div>

                  <button
                    disabled={!selectedCandidate || isGeneratingBrief}
                    onClick={handleGenerateBrief}
                    className="px-5 py-2.5 bg-brand text-black font-black text-xs uppercase tracking-wider rounded-lg hover:brightness-110 disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
                  >
                    <Icon icon="solar:sparkles-bold" className="w-4 h-4" />
                    Generate Brief & Copy
                  </button>
                </div>

                {/* Candidate Selection List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-text-muted uppercase tracking-wider">
                    Scored & Reranked Candidate Possibilities ({candidates.length})
                  </h4>

                  {isLoadingCandidates ? (
                    <div className="p-12 text-center text-sm text-text-muted flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin"></div>
                      <span>Querying MuviDB candidate engine...</span>
                    </div>
                  ) : candidates.length === 0 ? (
                    <p className="text-sm text-text-muted italic">No candidates found for this series criteria.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                      {candidates.map((item, idx) => (
                        <div
                          key={item.candidate.id}
                          onClick={() => setSelectedCandidate(item)}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                            selectedCandidate?.candidate.id === item.candidate.id
                              ? 'border-brand bg-brand/10 ring-2 ring-brand/30'
                              : 'border-border bg-surface-2/30 hover:border-brand/40'
                          }`}
                        >
                          {item.candidate.imageUrl ? (
                            <img src={item.candidate.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg bg-surface-2 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-surface-2 border border-border rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                              {item.candidate.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-xs font-bold text-text-primary truncate">{item.candidate.name}</h5>
                              <span className="text-[10px] font-black text-brand shrink-0">Score: {item.score}</span>
                            </div>
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{item.candidate.subtext}</p>
                            <p className="text-[10px] text-text-muted/80 line-clamp-1 mt-1 italic">
                              Why: {item.reasons.slice(0, 2).join(' • ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card-cal p-12 text-center text-text-muted space-y-3">
                <Icon icon="solar:calendar-minimalistic-bold" className="w-12 h-12 mx-auto text-text-muted/40" />
                <p className="text-sm font-medium">Select a calendar slot from the left to explore candidate recommendations.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DRAFTS & BRIEF WORKSPACE */}
      {activeTab === 'drafts' && (
        <div className="space-y-6">
          {activeDraft ? (
            <div className="card-cal p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[10px] font-black text-brand uppercase tracking-widest">
                    Editorial Brief • {activeDraft.factPack?.entity?.name}
                  </span>
                  <h3 className="text-2xl font-black text-text-primary">{activeDraft.chosenAngle?.title}</h3>
                </div>

                <button
                  onClick={() =>
                    handleMarkPublished(
                      activeDraft.draft?.id,
                      activeDraft.draft?.calendar_id,
                      activeDraft.factPack?.entity?.type,
                      activeDraft.factPack?.entity?.id
                    )
                  }
                  className="px-5 py-2.5 bg-green-500 text-black font-black text-xs uppercase tracking-wider rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-sm"
                >
                  <Icon icon="solar:check-read-bold" className="w-4 h-4" />
                  Mark Published
                </button>
              </div>

              {/* Brief Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Figma Design Copy */}
                <div className="lg:col-span-1 space-y-4 bg-surface-2/30 p-4 border border-border rounded-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-brand">Figma Template Key</h4>
                    <span className="text-[10px] font-mono font-bold bg-surface-2 px-2 py-0.5 rounded border border-border">
                      {activeDraft.draft?.figma_template_key || 'people-filmography'}
                    </span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <span className="text-[10px] font-black text-text-muted uppercase">Cover Headline</span>
                      <p className="text-sm font-bold text-text-primary mt-0.5">{activeDraft.copy?.headline}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-black text-text-muted uppercase">Subheadline</span>
                      <p className="text-xs text-text-muted mt-0.5">{activeDraft.copy?.subheadline}</p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-black text-text-muted uppercase">Figma Carousel Slides</span>
                      {(activeDraft.copy?.design_copy?.slides || []).map((slide, idx) => (
                        <div key={idx} className="p-2.5 bg-surface border border-border rounded-lg text-xs space-y-1">
                          <span className="text-[9px] font-black text-brand uppercase">Slide {slide.position}</span>
                          <p className="font-bold text-text-primary">{slide.title}</p>
                          {slide.supporting_text && <p className="text-[11px] text-text-muted">{slide.supporting_text}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Multi-Platform Captions */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="p-4 bg-surface-2/30 border border-border rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-brand">Instagram Caption</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeDraft.copy?.instagram?.caption || '');
                          toast.success('Instagram caption copied!');
                        }}
                        className="text-xs text-brand font-bold hover:underline flex items-center gap-1"
                      >
                        <Icon icon="solar:copy-bold" className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                    <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed font-medium">
                      {activeDraft.copy?.instagram?.caption}
                    </p>
                    <p className="text-xs text-brand font-bold italic">{activeDraft.copy?.instagram?.cta}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-2/30 border border-border rounded-xl space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-brand">X / Twitter Text</h4>
                      <p className="text-xs text-text-primary font-medium">{activeDraft.copy?.x?.text}</p>
                    </div>

                    <div className="p-4 bg-surface-2/30 border border-border rounded-xl space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-brand">Threads Post</h4>
                      <p className="text-xs text-text-primary font-medium">{activeDraft.copy?.threads?.text}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-cal p-12 text-center text-text-muted space-y-3">
              <Icon icon="solar:document-text-bold" className="w-12 h-12 mx-auto text-text-muted/40" />
              <p className="text-sm font-medium">No active brief selected. Generate a brief from the Calendar tab first.</p>
            </div>
          )}
        </div>
      )}

      {/* MANUAL OPPORTUNITY MODAL */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="card-cal max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-brand">+ Add Content Opportunity</h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">Headline / Title *</label>
                <input
                  type="text"
                  className="w-full bg-surface-2 border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="e.g. King of Boys 3 Confirmed for Cinema Release"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">Source URL (optional)</label>
                <input
                  type="url"
                  className="w-full bg-surface-2 border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="https://..."
                  value={newEvent.source_url}
                  onChange={(e) => setNewEvent({ ...newEvent, source_url: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">Notes / Summary</label>
                <textarea
                  rows={3}
                  className="w-full bg-surface-2 border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="Additional context or editorial ideas..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setIsEventModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleSaveEvent} className="px-4 py-2 bg-brand text-black rounded-lg text-xs font-black uppercase">
                Save Opportunity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
