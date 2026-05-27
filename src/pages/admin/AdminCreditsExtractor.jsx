import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';
import { toast } from 'react-hot-toast';

export default function AdminCreditsExtractor() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core State
  const [films, setFilms] = useState([]);
  const [selectedFilmId, setSelectedFilmId] = useState('');
  const [activeTab, setActiveTab] = useState('cast'); // 'cast' or 'crew'
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrLogs, setOcrLogs] = useState([]);

  // Upload/Image State
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [screenshotBase64, setScreenshotBase64] = useState('');

  // Roster Rows (editable)
  const [castRows, setCastRows] = useState([]);
  const [crewRows, setCrewRows] = useState([]);

  // Double-click write lock states
  const [savingRows, setSavingRows] = useState(new Set());
  const [savedRows, setSavedRows] = useState(new Set());

  // Dropdown Film search
  const [filmSearch, setFilmSearch] = useState('');
  const [isFilmDropdownOpen, setIsFilmDropdownOpen] = useState(false);

  // Load films on mount
  useEffect(() => {
    async function loadFilms() {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, poster_url, release_type')
          .order('title');
        if (error) throw error;
        setFilms(data || []);
      } catch (err) {
        console.error('Failed to load films:', err);
        toast.error('Could not load film index.');
      }
    }
    loadFilms();
  }, []);

  // Fetch live matches from database whenever the name list changes
  const runLiveProfileVerification = async (rows, setter) => {
    if (!rows.length) return;
    
    // Extract unique name strings
    const nameStrings = rows.map(r => r.name.trim()).filter(Boolean);
    if (!nameStrings.length) return;

    try {
      // Direct exact match query
      const { data: matchedPeople, error } = await supabase
        .from('people')
        .select('id, name, photo_url')
        .in('name', nameStrings);

      if (error) throw error;

      const matchMap = new Map(matchedPeople.map(p => [p.name.toLowerCase(), p]));

      // Update match status for each row
      setter(prevRows =>
        prevRows.map(row => {
          const match = matchMap.get(row.name.toLowerCase());
          if (match) {
            return {
              ...row,
              matchId: match.id,
              photoUrl: match.photo_url,
              status: 'matched'
            };
          } else {
            return {
              ...row,
              matchId: null,
              photoUrl: null,
              status: 'new'
            };
          }
        })
      );
    } catch (err) {
      console.error('Error running live profile verification:', err);
    }
  };

  // Convert uploaded image file to Base64
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG/JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result);
      setScreenshotBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Run Vision AI OCR to extract cast or crew
  const handleExtractCredits = async () => {
    if (!screenshotBase64) {
      toast.error('Please upload a screenshot first.');
      return;
    }

    setIsProcessingOCR(true);
    setOcrLogs(['Parsing base64 image data...', 'Initializing Vision connection...', 'Running Gemini Flash OCR...']);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'extract_credits_from_image',
          data: {
            image: screenshotBase64,
            creditType: activeTab
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server returned an error');
      }

      const resData = await response.json();
      const extracted = resData.results || [];

      if (!extracted.length) {
        toast.error('Vision could not find any text listings in this screenshot. Please try a clearer crop.');
        setOcrLogs(prev => [...prev, '❌ Extraction finished with 0 credits.']);
        setIsProcessingOCR(false);
        return;
      }

      // Map raw OCR records into row objects with a local unique key
      const formattedRows = extracted.map((item, idx) => ({
        key: `${activeTab}-${idx}-${Date.now()}`,
        name: item.name || '',
        roleOrCharacter: item.role_or_character || '',
        selected: true,
        status: 'checking', // 'checking', 'matched', 'new'
        matchId: null,
        photoUrl: null
      }));

      if (activeTab === 'cast') {
        setCastRows(prev => [...prev, ...formattedRows]);
        await runLiveProfileVerification([...castRows, ...formattedRows], setCastRows);
      } else {
        setCrewRows(prev => [...prev, ...formattedRows]);
        await runLiveProfileVerification([...crewRows, ...formattedRows], setCrewRows);
      }

      toast.success(`Extracted ${extracted.length} credit entries!`);
      setOcrLogs(prev => [...prev, `✅ Successfully parsed ${extracted.length} rows.`]);
    } catch (err) {
      console.error('OCR Error:', err);
      toast.error(`OCR Extraction failed: ${err.message}`);
      setOcrLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // Re-run matching if an admin edits a name input cell manually
  const handleNameCellChange = async (key, newName, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter(prev =>
      prev.map(row => (row.key === key ? { ...row, name: newName, status: 'checking' } : row))
    );

    // Debounce/Trigger live search for this edited row
    try {
      const { data: matched, error } = await supabase
        .from('people')
        .select('id, name, photo_url')
        .ilike('name', newName)
        .maybeSingle();

      if (error) throw error;

      setter(prev =>
        prev.map(row => {
          if (row.key === key) {
            if (matched) {
              return {
                ...row,
                matchId: matched.id,
                photoUrl: matched.photo_url,
                status: 'matched'
              };
            } else {
              return {
                ...row,
                matchId: null,
                photoUrl: null,
                status: 'new'
              };
            }
          }
          return row;
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Update specific property on cell edit
  const handleCellChange = (key, field, val, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter(prev =>
      prev.map(row => (row.key === key ? { ...row, [field]: val } : row))
    );
  };

  // Delete a specific extracted row
  const handleDeleteRow = (key, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter(prev => prev.filter(row => row.key !== key));
  };

  // Batch Save Selected Roster to Supabase (with double-click protection locks)
  const handleBatchSave = async () => {
    if (!selectedFilmId) {
      toast.error('Please select a Film asset first.');
      return;
    }

    const currentRows = activeTab === 'cast' ? castRows : crewRows;
    const selectedRows = currentRows.filter(r => r.selected && !savedRows.has(r.key) && !savingRows.has(r.key));

    if (!selectedRows.length) {
      toast.error('No pending/selected credits to save.');
      return;
    }

    // Set double-click lock on all saving keys
    const newSaving = new Set(savingRows);
    selectedRows.forEach(r => newSaving.add(r.key));
    setSavingRows(newSaving);

    toast.loading(`Saving ${selectedRows.length} credits...`, { id: 'savingCredits' });

    let countSaved = 0;
    const filmName = films.find(f => f.id === selectedFilmId)?.title || 'Selected Film';

    for (const row of selectedRows) {
      try {
        let personId = row.matchId;

        // Step A: If new profile, insert to people first
        if (!personId) {
          const { data: newPerson, error: pErr } = await supabase
            .from('people')
            .insert({
              name: row.name.trim(),
              nationality: 'Nigerian',
              photo_url: null,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (pErr) throw pErr;
          personId = newPerson.id;
        }

        // Step B: Connect Credit link
        const creditRole = activeTab === 'cast' ? 'actor' : row.roleOrCharacter.toLowerCase().trim().replace(/\s+/g, '_');
        const characterName = activeTab === 'cast' ? row.roleOrCharacter.trim() : null;

        // Check if exact credit link exists to prevent database exceptions
        const { data: existingLink } = await supabase
          .from('credits')
          .select('id')
          .eq('film_id', selectedFilmId)
          .eq('person_id', personId)
          .eq('role', creditRole)
          .maybeSingle();

        if (!existingLink) {
          const { error: cErr } = await supabase
            .from('credits')
            .insert({
              film_id: selectedFilmId,
              person_id: personId,
              role: creditRole,
              character_name: characterName,
              billing_order: 99
            });

          if (cErr) throw cErr;
        }

        // Update successful states
        setSavedRows(prev => {
          const next = new Set(prev);
          next.add(row.key);
          return next;
        });

        // Log admin activity
        await logAdminAction(user, 'create', 'credit', selectedFilmId, `${row.name} as ${creditRole} in ${filmName}`);
        countSaved++;
      } catch (err) {
        console.error(`Failed to save row: ${row.name}`, err);
        toast.error(`Error saving ${row.name}: ${err.message}`);
      } finally {
        // Unlock saving lock
        setSavingRows(prev => {
          const next = new Set(prev);
          next.delete(row.key);
          return next;
        });
      }
    }

    toast.dismiss('savingCredits');
    if (countSaved > 0) {
      toast.success(`Successfully saved ${countSaved} Nollywood credits!`);
    }
  };

  // Dropdown Filtering
  const filteredFilms = films.filter(f =>
    f.title.toLowerCase().includes(filmSearch.toLowerCase())
  );
  const selectedFilm = films.find(f => f.id === selectedFilmId);

  const activeRoster = activeTab === 'cast' ? castRows : crewRows;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Premium Sub-Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-border">
        <div>
          <button
            onClick={() => navigate('/admin/credits')}
            className="text-text-muted hover:text-brand font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-3 group transition-colors"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Attributions
          </button>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">OCR Credits Harvester</p>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Nollywood Credits Extractor</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium leading-relaxed opacity-80">
            Paste screenshots of opening or closing video credits. AI Vision parses details, verifies against existing database talent profiles, and links them seamlessly.
          </p>
        </div>
      </header>

      {/* Main Extractor Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Film Selection & Upload */}
        <div className="space-y-6 lg:col-span-1">
          {/* Film Selection Card */}
          <div className="card-cal p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-brand mb-2">1. Select Target Film</h3>
            
            <div className="relative">
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.1em] mb-2">Film Asset *</label>
              
              <div 
                className="w-full bg-surface-2 border border-border text-text-primary rounded-lg px-4 py-3 text-sm focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10 cursor-pointer flex items-center justify-between transition-all"
                onClick={() => setIsFilmDropdownOpen(!isFilmDropdownOpen)}
              >
                {selectedFilm ? (
                  <div className="flex items-center gap-3">
                    {selectedFilm.poster_url ? (
                      <img src={selectedFilm.poster_url} alt="" className="w-8 h-8 object-cover bg-surface-2 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 bg-surface-2 flex items-center justify-center text-[10px] font-black rounded-lg">
                        {selectedFilm.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold truncate">{selectedFilm.title}</span>
                  </div>
                ) : (
                  <span className="text-text-muted font-medium">Choose Film Asset...</span>
                )}
                <svg className={`w-4 h-4 text-text-muted transition-transform ${isFilmDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isFilmDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-lg shadow-xl max-h-72 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 border-b border-border bg-surface-2/30">
                    <input
                      type="text"
                      className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-brand focus:outline-none transition-all"
                      placeholder="Search films..."
                      value={filmSearch}
                      onChange={(e) => setFilmSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
                    {filteredFilms.length === 0 ? (
                      <div className="p-8 text-center text-sm text-text-muted font-medium">No results found</div>
                    ) : (
                      filteredFilms.map(f => (
                        <div
                          key={f.id}
                          className={`p-2.5 rounded-md cursor-pointer flex items-center gap-3 hover:bg-surface-2 transition-all ${selectedFilmId === f.value ? 'bg-brand/5' : ''}`}
                          onClick={() => {
                            setSelectedFilmId(f.id);
                            setIsFilmDropdownOpen(false);
                            setFilmSearch('');
                          }}
                        >
                          {f.poster_url ? (
                            <img src={f.poster_url} alt="" className="w-8 h-8 object-cover bg-surface-2 rounded-lg" />
                          ) : (
                            <div className="w-8 h-8 bg-surface-2 flex items-center justify-center text-xs font-black rounded-lg">
                              {f.title.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-bold truncate">{f.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot Upload Card */}
          <div className="card-cal p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-brand mb-2">2. Upload Credit Screen</h3>
            
            {/* Upload Area */}
            <div className="border-2 border-dashed border-border/80 hover:border-brand/40 rounded-xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer relative bg-surface-2/20 group">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept="image/*"
              />
              {screenshotPreview ? (
                <div className="space-y-3 w-full">
                  <img src={screenshotPreview} alt="Credits Screenshot" className="max-h-48 object-contain rounded-lg mx-auto border border-border shadow-md" />
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest group-hover:text-brand transition-colors">Click to replace screenshot</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-surface-2 border border-border rounded-full flex items-center justify-center mx-auto text-text-muted group-hover:scale-110 transition-transform shadow-sm">
                    📷
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">Drag or Drop Image</p>
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest mt-1">Supports PNG, JPG, JPEG</p>
                  </div>
                </div>
              )}
            </div>

            {/* Run Extraction Button */}
            <button
              onClick={handleExtractCredits}
              disabled={isProcessingOCR || !screenshotBase64}
              className="w-full bg-brand text-white font-black py-3.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isProcessingOCR ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Harvesting Credits...
                </>
              ) : (
                '🚀 Run AI Vision Extraction'
              )}
            </button>

            {/* AI Log Outputs */}
            {ocrLogs.length > 0 && (
              <div className="bg-surface-2/80 border border-border/80 rounded-lg p-4 font-mono text-[10px] text-text-muted space-y-1.5 max-h-40 overflow-y-auto">
                <p className="font-bold text-brand uppercase tracking-widest border-b border-border/40 pb-1 mb-1">OCR System Telemetry:</p>
                {ocrLogs.map((log, idx) => (
                  <p key={idx} className="leading-relaxed">{log}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Extracted Editable Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-cal p-6 space-y-6">
            {/* Header with Switcher Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('cast')}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                    activeTab === 'cast'
                      ? 'bg-brand/10 text-brand border-brand/20 shadow-sm'
                      : 'bg-transparent text-text-muted border-transparent hover:text-text-primary'
                  }`}
                >
                  🎭 Cast / Osere
                </button>
                <button
                  onClick={() => setActiveTab('crew')}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                    activeTab === 'crew'
                      ? 'bg-brand/10 text-brand border-brand/20 shadow-sm'
                      : 'bg-transparent text-text-muted border-transparent hover:text-text-primary'
                  }`}
                >
                  🎬 Crew / Technical
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {activeRoster.length > 0 && (
                  <button
                    onClick={() => {
                      if (activeTab === 'cast') setCastRows([]);
                      else setCrewRows([]);
                      setSavedRows(new Set());
                    }}
                    className="text-text-muted hover:text-red-500 text-[10px] font-black uppercase tracking-widest border border-border hover:border-red-500/20 px-4 py-2.5 rounded-lg hover:bg-red-500/5 transition-all"
                  >
                    🗑️ Clear List
                  </button>
                )}
                
                <button
                  onClick={handleBatchSave}
                  disabled={!activeRoster.filter(r => r.selected && !savedRows.has(r.key)).length}
                  className="bg-brand text-white font-black px-6 py-2.5 rounded-lg text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-lg shadow-brand/10"
                >
                  💾 Save Roster
                </button>
              </div>
            </div>

            {/* Editable Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-2/10 text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={activeRoster.length > 0 && activeRoster.every(r => r.selected)}
                        onChange={(e) => {
                          const setter = activeTab === 'cast' ? setCastRows : setCrewRows;
                          setter(prev => prev.map(r => ({ ...r, selected: e.target.checked })));
                        }}
                        disabled={activeRoster.length === 0}
                        className="w-4 h-4 rounded border-border bg-surface-2 accent-brand cursor-pointer focus:ring-brand/20"
                      />
                    </th>
                    <th className="px-4 py-3.5">Talent Name</th>
                    <th className="px-4 py-3.5">
                      {activeTab === 'cast' ? 'Character Role' : 'Specific Function'}
                    </th>
                    <th className="px-4 py-3.5">Database Status</th>
                    <th className="px-4 py-3.5 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {activeRoster.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-3xl opacity-20">📷</span>
                          <p className="text-text-muted font-bold text-base">Roster empty.</p>
                          <p className="text-[10px] text-text-muted/60 font-semibold uppercase tracking-widest max-w-xs">Upload a screenshot of closing credits on the left and run OCR to generate a list.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeRoster.map((row) => (
                      <tr
                        key={row.key}
                        className={`group transition-all duration-200 ${
                          savedRows.has(row.key)
                            ? 'bg-green-500/5 hover:bg-green-500/5'
                            : 'hover:bg-surface-2/30'
                        }`}
                      >
                        {/* Checkbox select */}
                        <td className="px-4 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onChange={(e) => {
                              const setter = activeTab === 'cast' ? setCastRows : setCrewRows;
                              setter(prev => prev.map(r => r.key === row.key ? { ...r, selected: e.target.checked } : r));
                            }}
                            className="w-4 h-4 rounded border-border bg-surface-2 accent-brand cursor-pointer focus:ring-brand/20 disabled:opacity-40"
                          />
                        </td>

                        {/* Editable Name */}
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            value={row.name}
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onChange={(e) => handleNameCellChange(row.key, e.target.value, activeTab)}
                            className="w-full bg-transparent border-b border-transparent focus:border-brand/40 text-text-primary text-sm font-bold focus:outline-none focus:ring-0 py-0.5 placeholder:text-text-muted/30"
                            placeholder="Enter full name..."
                          />
                        </td>

                        {/* Editable Character / Function */}
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            value={row.roleOrCharacter}
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onChange={(e) => handleCellChange(row.key, 'roleOrCharacter', e.target.value, activeTab)}
                            className="w-full bg-transparent border-b border-transparent focus:border-brand/40 text-text-primary text-sm font-bold focus:outline-none focus:ring-0 py-0.5 placeholder:text-text-muted/30"
                            placeholder={activeTab === 'cast' ? 'e.g. Arojojoye' : 'e.g. Makeup Artist'}
                          />
                        </td>

                        {/* Live Database Matching Alerts */}
                        <td className="px-4 py-4">
                          {savedRows.has(row.key) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">
                              🎉 Synced Successfully
                            </span>
                          ) : savingRows.has(row.key) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-brand/10 text-brand border border-brand/20">
                              <div className="w-2.5 h-2.5 border border-brand/30 border-t-brand rounded-full animate-spin"></div>
                              Saving...
                            </span>
                          ) : row.status === 'matched' ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                Link to existing profile
                              </span>
                              {row.photoUrl && (
                                <img src={row.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-border shadow-sm" />
                              )}
                            </div>
                          ) : row.status === 'new' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/20">
                              ✨ Creates new profile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-surface-2 text-text-muted border border-border">
                              🔍 Verification pending
                            </span>
                          )}
                        </td>

                        {/* Delete Action */}
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onClick={() => handleDeleteRow(row.key, activeTab)}
                            className="p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:hover:scale-100 cursor-pointer"
                            title="Remove row"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
