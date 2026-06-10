import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

export default function AdminAI() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const logEndRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const runTask = async (task, payload = {}) => {
    setIsProcessing(true);
    setActiveTask(task);
    setResults(null);
    setLogs([]);
    addLog(`Initiating ${task.replace('_', ' ')}...`, 'info');
    
    try {
      addLog("Connecting to AI Core (Gemini/Groq)...", "info");
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ task, data: payload })
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 100)}...`);
      }
      
      if (data.error) throw new Error(data.error);

      // AI Telemetry integration
      if (data.telemetry) {
        addLog(`Engine: ${data.telemetry.engine.toUpperCase()}${data.telemetry.reset > 0 ? ` (Reset in ${data.telemetry.reset}s)` : ''}`, data.telemetry.engine === 'groq' ? 'warning' : 'success');
      }

      // Debug info for extract_cast diagnostics
      if (data._debug) {
        addLog(`[DEBUG] Parsed: ${data._debug.parsedCount} | Normalized: ${data._debug.normalizedCount} | Final: ${data._debug.filteredCount}`, 'warning');
        if (data._debug.sampleKeys?.length > 0) {
          addLog(`[DEBUG] AI returned keys: ${data._debug.sampleKeys.join(', ')}`, 'warning');
        }
        if (data._debug.rawPreview) {
          addLog(`[DEBUG] Raw AI: ${data._debug.rawPreview.substring(0, 150)}...`, 'warning');
        }
      }

      setResults(data.results);
      
      if (data.results?.length > 0) {
        addLog(`Found ${data.results.length} items requiring action.`, 'success');
      } else if (data.analyzedCount !== undefined) {
        addLog(data.analyzedCount > 0 
          ? `Analyzed ${data.analyzedCount} items. AI determined no action needed.`
          : 'No relevant items found in database scan.', 'info');
      } else if (data.filtered_out > 0) {
        addLog(`All ${data.filtered_out} suggested items were already in your database.`, 'warning');
      } else {
        addLog("No items required action in this batch.", "info");
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
      toast.error('AI Processing Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const [apiStatus, setApiStatus] = useState({ youtube: 'checking', tmdb: 'checking' });
  useEffect(() => {
    const check = async (s) => {
      try {
        const res = await fetch(`/api/health?service=${s}`);
        const d = await res.json();
        setApiStatus(prev => ({ ...prev, [s]: d.status }));
      } catch { setApiStatus(prev => ({ ...prev, [s]: 'error' })); }
    };
    check('youtube'); check('tmdb');
  }, []);

  const handleApplyAction = async (item, action) => {
    try {
      addLog(`Applying ${action} to ${item.name || item.title || item.id}...`, 'info');
      
      let dbError = null;
      let count = 0;

      // Logic refinement: Discover Cast (new) vs Enrich (existing)
      const isNewPerson = activeTask === 'discover_actors';

      if (isNewPerson) {
        const { error } = await supabase.from('people').insert({
          name: item.name,
          bio: item.biography || item.bio,
          date_of_birth: item.date_of_birth || null,
          photo_url: item.image_url,
          nationality: item.nationality || 'Nigerian',
          created_at: new Date().toISOString()
        });
        dbError = error;
        count = error ? 0 : 1;
      } else if (item.type === 'person') {
        const { data, error } = await supabase.from('people').update({
          bio: item.biography || item.bio,
          date_of_birth: item.date_of_birth || null,
          photo_url: item.image_url
        }).eq('id', item.id).select();
        dbError = error;
        count = data?.length || 0;
      } else if (item.type === 'film') {
        const { data, error } = await supabase.from('films').update({
          synopsis: item.synopsis,
          poster_url: item.image_url
        }).eq('id', item.id).select();
        dbError = error;
        count = data?.length || 0;
      } else if (item.type === 'company') {
        const { data, error } = await supabase.from('companies').update({
          logo_url: item.image_url,
          description: item.bio || item.description
        }).eq('id', item.id).select();
        dbError = error;
        count = data?.length || 0;
      } else if (action === 'MERGE') {
        const { error } = await supabase.rpc('merge_people', {
          p_master_id: item.master_id,
          p_duplicate_ids: item.duplicate_ids
        });
        dbError = error;
        count = error ? 0 : 1;
      } else if (action === 'DELETE') {
        const { error } = await supabase.from('films').delete().eq('id', item.id);
        dbError = error;
        count = error ? 0 : 1;
      } else if (action === 'UPDATE_TITLE') {
        const { data, error } = await supabase.from('films').update({
          title: item.new_title
        }).eq('id', item.id).select();
        dbError = error;
        count = data?.length || 0;
      } else if (action === 'APPLY_CAST') {
        // 1. Update the film title
        const { error: titleErr } = await supabase.from('films').update({
          title: item.new_title
        }).eq('id', item.id);
        if (titleErr) throw titleErr;
        addLog(`Title updated: "${item.old_title}" → "${item.new_title}"`, 'success');

        // 2. Upsert each cast member → people table → credits table
        let castLinked = 0;
        for (const actorName of (item.cast || [])) {
          try {
            // Tier 1: Exact name match (case-insensitive)
            let { data: existingPerson } = await supabase
              .from('people')
              .select('id, name')
              .ilike('name', actorName)
              .maybeSingle();

            // Tier 2: Partial match — name appears WITHIN a longer name
            // e.g. "Lalude" matches "Fatai Adekunle Adetayo (Lalude)"
            if (!existingPerson) {
              const { data: partialMatch } = await supabase
                .from('people')
                .select('id, name')
                .ilike('name', `%${actorName}%`)
                .limit(1)
                .maybeSingle();
              if (partialMatch) {
                existingPerson = partialMatch;
                addLog(`Matched "${actorName}" → existing "${partialMatch.name}"`, 'info');
              }
            }

            let personId = existingPerson?.id;

            if (!personId) {
              // Create new person
              const { data: newPerson, error: pErr } = await supabase
                .from('people')
                .insert({
                  name: actorName,
                  nationality: 'Nigerian',
                  created_at: new Date().toISOString()
                })
                .select('id')
                .single();

              if (pErr) {
                addLog(`⚠ Could not create person "${actorName}": ${pErr.message}`, 'warning');
                continue;
              }
              personId = newPerson.id;
              addLog(`Created new person: ${actorName}`, 'info');
            }

            // Link credit (ignore duplicates)
            const { error: creditErr } = await supabase
              .from('credits')
              .insert({
                film_id: item.id,
                person_id: personId,
                role: 'actor',
                billing_order: castLinked
              });

            if (creditErr && !creditErr.message.includes('duplicate')) {
              addLog(`⚠ Credit link error for ${actorName}: ${creditErr.message}`, 'warning');
            } else {
              castLinked++;
            }
          } catch (castErr) {
            addLog(`⚠ Error processing ${actorName}: ${castErr.message}`, 'warning');
          }
        }
        addLog(`Linked ${castLinked}/${item.cast.length} cast members to "${item.new_title}"`, 'success');
        count = castLinked;
        dbError = null;
      }

      if (dbError) throw dbError;
      
      if (count === 0 && !isNewPerson) {
        addLog(`Warning: No database rows were affected. Check if ID ${item.id || item.master_id} is valid.`, 'warning');
      } else {
        addLog(`Successfully applied changes to ${item.name || item.title || item.id || 'record'}.`, 'success');
        
        // Robust filtering to remove ONLY the processed item
        setResults(prev => {
          if (!prev) return null;
          return prev.filter(i => {
            // Match by ID
            if (item.id && i.id === item.id) return false;
            // Match by Master ID (for deduplication)
            if (item.master_id && i.master_id === item.master_id) return false;
            // Match by object reference fallback
            if (i === item) return false;
            return true;
          });
        });
        toast.success('Database updated');
      }
    } catch (err) {
      addLog(`Database Write Error: ${err.message}`, 'error');
      toast.error('Failed to save changes');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tighter flex items-center gap-3">
            <span className="w-10 h-10 bg-brand rounded-2xl flex items-center justify-center text-on-brand text-xl shadow-lg shadow-brand/20">A</span>
            AI AGENT TERMINAL
          </h1>
          <p className="text-text-muted mt-2 font-medium">Automate database hygiene, enrichment and discovery.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-surface border border-border rounded-xl flex items-center gap-3 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${apiStatus.youtube === 'ok' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">YouTube API</span>
          </div>
          <div className="px-4 py-2 bg-surface border border-border rounded-xl flex items-center gap-3 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${apiStatus.tmdb === 'ok' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">TMDB API</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Controls Panel */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="text-6xl">🤖</span>
            </div>
            
            <h2 className="text-xs font-black text-brand uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
               Available Operations
            </h2>

            <div className="space-y-3">
              <OperationButton 
                icon="🧹"
                title="Hygiene Check"
                desc="Find & Fix broken metadata"
                onClick={() => runTask('cleanup_films')}
                disabled={isProcessing}
              />
              <OperationButton 
                icon="💎"
                title="Enrich Records"
                desc="Discover missing posters/bios"
                onClick={() => runTask('enrich_metadata')}
                disabled={isProcessing}
              />
              <OperationButton 
                icon="🌟"
                title="Discover Cast"
                desc="Identify new people profiles"
                onClick={() => runTask('discover_actors')}
                disabled={isProcessing}
              />
               <OperationButton 
                icon="🧬"
                title="Merge Duplicates"
                desc="Consolidate duplicate people"
                onClick={() => runTask('deduplicate')}
                disabled={isProcessing}
                variant="danger"
              />
              <OperationButton 
                icon="✍️"
                title="Title Polish"
                desc="Clean YouTube noise from titles"
                onClick={() => runTask('cleanup_titles')}
                disabled={isProcessing}
              />
              <OperationButton 
                icon="🎭"
                title="Extract Cast"
                desc="Parse actors from video titles"
                onClick={() => runTask('extract_cast')}
                disabled={isProcessing}
              />
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <div className="flex items-center justify-between text-[10px] font-bold text-text-muted mb-2 uppercase tracking-widest">
                <span>Core Capacity</span>
                <span>{isProcessing ? 'Processing...' : 'Idle'}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${isProcessing ? 'w-full bg-brand animate-pulse' : 'w-1/3 bg-green-500'}`} 
                />
              </div>
              <p className="text-[9px] text-text-muted mt-2 leading-relaxed">
                Active: Gemini-1.5-Flash <br/>
                Secondary: Llama-3 (Auto-Fallback)
              </p>
            </div>
          </div>

          {/* Real-time Logs */}
          <div className="bg-surface-2 border border-border rounded-3xl h-64 flex flex-col overflow-hidden shadow-2xl font-mono text-[11px]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2/50">
              <span className="text-text-muted uppercase font-black tracking-tighter">System Output</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/30" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
                <div className="w-2 h-2 rounded-full bg-green-500/30" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-hide">
              {logs.length === 0 && <p className="text-text-muted/20 italic">Waiting for command...</p>}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 py-0.5 ${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'success' ? 'text-brand font-bold' : 'text-text-secondary'
                }`}>
                  <span className="opacity-40 shrink-0 font-normal">[{log.time}]</span>
                  <span className="break-all">{log.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {!results && !isProcessing && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-surface/50 border-2 border-dashed border-border rounded-3xl text-center p-10">
              <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center text-4xl shadow-lg mb-6 border border-border">🎯</div>
              <h3 className="text-xl font-bold text-text-primary">Execution Results</h3>
              <p className="text-text-muted max-w-sm mt-2">Select an operation to start processing data with Gemini.</p>
            </div>
          )}

          {isProcessing && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-surface border border-border rounded-3xl text-center p-10 animate-pulse">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-brand">G</div>
              </div>
              <h3 className="text-xl font-black text-text-primary mt-8">Gemini is Thinking...</h3>
              <p className="text-text-muted mt-2 tracking-wide uppercase text-[10px] font-bold">Deep scanning database records</p>
            </div>
          )}

          {results && (
            <div className="bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-border bg-brand/5 flex items-center justify-between">
                <h3 className="font-black flex items-center gap-2 text-brand">
                  <span className="text-2xl">{activeTask === 'cleanup_films' ? '🧹' : activeTask === 'discover_actors' ? '🌟' : activeTask === 'extract_cast' ? '🎭' : '🪄'}</span>
                  <span className="tracking-tight">{activeTask?.replace('_', ' ').toUpperCase()} RESULTS</span>
                </h3>
                <div className="flex items-center gap-4">
                  <span className="px-2 py-1 bg-brand/10 text-brand text-[10px] font-black rounded-lg uppercase tracking-widest">{results.length} items found</span>
                  <button 
                    onClick={() => setResults(null)}
                    className="text-text-muted hover:text-red-500 transition-colors font-bold text-xs flex items-center gap-1"
                  >
                    <span>✕</span> Clear
                  </button>
                </div>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto overflow-x-hidden">
                <div className="divide-y divide-border">
                  {results.map((item, idx) => (
                    <ResultItem 
                      key={idx} 
                      item={item} 
                      task={activeTask} 
                      onAction={(item, action) => handleApplyAction(item, action)}
                    />
                  ))}
              {results.length === 0 && (
                <div className="p-20 text-center space-y-4">
                  <div className="text-4xl opacity-20">📂</div>
                  <p className="text-text-muted italic max-w-xs mx-auto">
                    No items found matching the "missing data" criteria in this batch. 
                    Your current records might already be complete or initialized.
                  </p>
                </div>
              )}
                </div>
              </div>
              
              <div className="p-4 bg-surface-2/30 text-[10px] text-center font-black text-brand tracking-widest border-t border-border">
                ALL ACTIONS ARE LOGGED AND REVERSIBLE
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OperationButton({ icon, title, desc, onClick, disabled, variant = 'primary' }) {
  const isDanger = variant === 'danger';
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group ${
        isDanger 
          ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/40 hover:shadow-red-500/5' 
          : 'bg-surface-2/50 border-border hover:border-brand/40 hover:shadow-brand/5'
      } disabled:opacity-50`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 flex items-center justify-center rounded-xl text-xl shadow-inner transition-transform group-hover:scale-110 ${
          isDanger ? 'bg-red-500/10 text-red-500' : 'bg-brand/10 text-brand'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text-primary text-sm truncate">{title}</p>
          <p className="text-[10px] text-text-muted truncate uppercase tracking-wider mt-0.5">{desc}</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
          ➜
        </div>
      </div>
    </button>
  );
}

function ResultItem({ item, task, onAction }) {
  if (task === 'cleanup_films') {
    return (
      <div className="p-6 flex items-center justify-between hover:bg-surface-2 group transition-colors border-b border-border/50">
        <div className="space-y-1 min-w-0 flex-1">
          <p className={`text-lg font-black truncate ${item.is_african ? 'text-text-primary' : 'text-red-500 underline'}`}>
            {item.title || "Untitled Record"}
          </p>
          <p className="text-xs text-text-muted italic line-clamp-2 pr-4">{item.reason}</p>
        </div>
        {!item.is_african && (
          <button 
            onClick={() => onAction(item, 'DELETE')}
            className="flex-shrink-0 px-6 py-2.5 bg-red-500 text-white rounded-xl text-xs font-black shadow-lg hover:bg-red-600 transition-all hover:scale-105"
          >
            DELETE
          </button>
        )}
      </div>
    );
  }

  if (task === 'cleanup_titles') {
    return (
      <div className="p-6 flex items-center justify-between hover:bg-surface-2 group transition-colors border-b border-border/50">
        <div className="space-y-1 min-w-0 flex-1 pr-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-red-500/50 line-through truncate max-w-[200px] block">{item.old_title}</span>
            <span className="text-xs text-text-muted">➜</span>
          </div>
          <p className="text-lg font-black text-text-primary truncate">
            {item.new_title}
          </p>
        </div>
        <button 
          onClick={() => onAction(item, 'UPDATE_TITLE')}
          className="flex-shrink-0 px-6 py-2.5 bg-brand text-on-brand rounded-xl text-xs font-black shadow-lg hover:scale-105 transition-all"
        >
          UPDATE TITLE
        </button>
      </div>
    );
  }

  if (task === 'extract_cast') {
    return (
      <div className="p-6 hover:bg-surface-2 group transition-colors border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-red-500/50 line-through truncate max-w-[250px] block">{item.old_title}</span>
              <span className="text-xs text-text-muted">➜</span>
            </div>
            <p className="text-lg font-black text-text-primary truncate">
              {item.new_title}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(item.cast || []).map((name, i) => (
                <span key={i} className="px-2 py-1 bg-brand/10 text-brand text-[10px] font-black rounded-lg">
                  🎭 {name}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {item.cast?.length || 0} cast member{(item.cast?.length || 0) !== 1 ? 's' : ''} detected
            </p>
          </div>
          <button 
            onClick={() => onAction(item, 'APPLY_CAST')}
            className="flex-shrink-0 px-5 py-2.5 bg-brand text-on-brand rounded-xl text-xs font-black shadow-lg hover:scale-105 transition-all whitespace-nowrap"
          >
            APPLY CAST
          </button>
        </div>
      </div>
    );
  }

  const isEnrichment = task === 'enrich_metadata';
  const isDiscovery = task === 'discover_actors';

  if (isEnrichment || isDiscovery) {
    const isPerson = item.type === 'person' || isDiscovery;
    const isCompany = item.type === 'company';
    const isFilm = item.type === 'film';

    return (
      <div className="p-6 flex gap-6 hover:bg-surface-2 transition-colors">
        <div className="w-20 h-20 bg-surface-3 rounded-2xl overflow-hidden shrink-0 border border-border flex items-center justify-center relative group/img">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl opacity-20">{isPerson ? '👤' : isCompany ? '🏢' : '🎞️'}</span>
          )}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[8px] px-1.5 py-0.5 bg-brand/10 text-brand rounded font-black uppercase">
              {item.type || (isDiscovery ? 'person' : 'item')}
            </span>
            <p className="font-bold text-text-primary truncate">{item.name || item.title || item.id}</p>
          </div>
          
          <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
            {item.biography || item.bio || item.synopsis || "Missing detail identified for enrichment..."}
          </p>
          {item.date_of_birth && (
            <p className="text-[10px] font-black text-brand/60 uppercase">
              🎂 Born: {item.date_of_birth}
            </p>
          )}
          
          <div className="flex gap-2 pt-1 border-t border-border/50">
            <button 
              onClick={() => onAction(item, 'APPLY')}
              className="px-3 py-1.5 bg-brand text-on-brand rounded-lg text-[10px] font-black hover:scale-105 transition-transform"
            >
              Update Data
            </button>
            {item.image_url && (
              <a href={item.image_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-surface-3 text-[10px] font-bold rounded-lg text-text-muted">
                View Image
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback / Deduplicate
  return (
    <div className="p-6 flex items-center justify-between hover:bg-surface-2 group transition-colors">
      <div className="space-y-1">
        <p className="font-bold text-text-primary text-lg">Master Record: {item.master_name || item.name || "Unknown Master"}</p>
        <p className="text-xs text-brand font-black uppercase tracking-widest">
           Found {item.duplicate_ids?.length || 0} Redundant Profiles
        </p>
        <p className="text-[10px] text-text-muted italic max-w-lg mt-2">Reason: {item.reason}</p>
      </div>
      <button 
        onClick={() => onAction(item, 'MERGE')}
        className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black shadow-lg transition-all hover:scale-105"
      >
        MERGE & DELETE CLONES
      </button>
    </div>
  );
}
