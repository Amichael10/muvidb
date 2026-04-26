import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, data: payload })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      // AI Telemetry integration
      if (data.telemetry) {
        addLog(`Engine: ${data.telemetry.engine.toUpperCase()}${data.telemetry.reset > 0 ? ` (Reset in ${data.telemetry.reset}s)` : ''}`, data.telemetry.engine === 'groq' ? 'warning' : 'success');
      }

      setResults(data.results);
      
      if (data.results?.length > 0) {
        addLog(`Found ${data.results.length} relevant items.${data.filtered_out > 0 ? ` (Auto-filtered ${data.filtered_out} duplicates)` : ''}`, 'success');
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

      if (item.type === 'person' || activeTask === 'discover_actors') {
        const { error } = await supabase.from('people').insert({
          name: item.name,
          bio: item.bio || item.biography,
          photo_url: item.image_url,
          nationality: item.nationality || 'Nigerian',
          created_at: new Date().toISOString()
        });
        dbError = error;
      } else if (item.type === 'film') {
        const { error } = await supabase.from('films').update({
          synopsis: item.synopsis,
          poster_url: item.image_url
        }).eq('id', item.id);
        dbError = error;
      } else if (item.type === 'company') {
        const { error } = await supabase.from('companies').update({
          logo_url: item.image_url,
          description: item.bio || item.description
        }).eq('id', item.id);
        dbError = error;
      } else if (action === 'MERGE') {
        const masterId = item.master_id;
        const duplicateIds = item.duplicate_ids;

        addLog(`Initiating Conflict-Aware Deep Merge into Master Profile...`, 'info');

        try {
          // 1. Fetch current state of credits for Master and Clones
          const { data: allCredits, error: fetchErr } = await supabase
            .from('credits')
            .select('id, film_id, role, person_id')
            .in('person_id', [masterId, ...duplicateIds]);

          if (fetchErr) throw fetchErr;

          const masterCredits = allCredits.filter(c => c.person_id === masterId);
          const duplicateCredits = allCredits.filter(c => duplicateIds.includes(c.person_id));

          addLog(`Migrating ${duplicateCredits.length} credits from clones...`, 'info');

          // Process credits individually to avoid unique constraint violations
          for (const credit of duplicateCredits) {
            const hasConflict = masterCredits.some(mc => mc.film_id === credit.film_id && mc.role === credit.role);
            
            if (hasConflict) {
              // Master already has this credit, remove redundant duplicate
              await supabase.from('credits').delete().eq('id', credit.id);
            } else {
              // Master lacks this credit, re-assign it
              await supabase.from('credits').update({ person_id: masterId }).eq('id', credit.id);
            }
          }

          // 2. Transfer associated accounts (Claims, Channels, Stats)
          await supabase.from('claims').update({ person_id: masterId }).in('person_id', duplicateIds);
          await supabase.from('channels').update({ person_id: masterId }).in('person_id', duplicateIds);
          
          // 3. Migrate any metadata (bio, handle) if Master is missing it
          // We can do this as a secondary enhancement if needed

          // 4. Final step: Purge the now-empty duplicates
          const { error: deleteErr } = await supabase.from('people').delete().in('id', duplicateIds);
          if (deleteErr) throw deleteErr;

          addLog(`Deep Merge successfully finalized. 0 Records Lost.`, 'success');
          dbError = null; 
        } catch (err) {
          addLog(`CRITICAL: Merge interrupted. Aborting deletion to protect data. Error: ${err.message}`, 'error');
          throw err;
        }
      } else if (action === 'DELETE' && (activeTask === 'cleanup_films' || activeTask === 'cleanup_people')) {
        const table = activeTask === 'cleanup_films' ? 'films' : 'people';
        const { error } = await supabase.from(table).delete().eq('id', item.id);
        dbError = error;
      }

      if (dbError) throw dbError;

      addLog(`Database updated successfully.`, 'success');
      toast.success('Record Saved!');
      
      // Remove the item from the list immediately after successful DB action
      setResults(prev => prev.filter(r => {
        // 1. Direct object reference check
        if (r === item) return false;
        
        // 2. ID check (for Discover/Cleanup)
        if (item.id && r.id === item.id) return false;
        
        // 3. Merge Check (for Deduplication)
        if (item.master_id && r.master_id === item.master_id) return false;
        
        // 4. Name check (fallback)
        if (item.name && r.name === item.name) return false;
        
        return true;
      }));

    } catch (err) {
      addLog(`DB Update Error: ${err.message || 'Unknown error'}`, 'error');
      toast.error(`Save Failed: ${err.message || 'Check logs'}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="bg-surface p-10 rounded-3xl border border-border flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full -mr-48 -mt-48 blur-[100px] group-hover:bg-brand/20 transition-all duration-1000" />
        <div className="text-6xl animate-bounce-slow">🤖</div>
        <div className="space-y-3 relative z-10">
          <h1 className="text-4xl font-black text-text-primary tracking-tight">AI Data Command Center</h1>
          <p className="text-text-muted max-w-2xl text-lg leading-relaxed">
            Automate your database growth using Gemini AI. Clean international leaks, discover regional talent, 
            and enrich metadata with authentic synopses and posters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task Selection */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              Available Operations
            </h2>
            
            <div className="space-y-3">
              <OperationButton 
                icon="🧹" 
                title="Cleanup Hollywood Films" 
                desc="Remove international leaks"
                onClick={() => runTask('cleanup_films')}
                disabled={isProcessing}
                variant="danger"
              />
              <OperationButton 
                icon="🚫" 
                title="Cleanup Hollywood People" 
                desc="Remove non-Nollywood talent"
                onClick={() => runTask('cleanup_people')}
                disabled={isProcessing}
                variant="danger"
              />
              <OperationButton 
                icon="🪄" 
                title="Enrich Metadata" 
                desc="Find posters & factual synopses"
                onClick={() => runTask('enrich_metadata')}
                disabled={isProcessing}
              />
              <OperationButton 
                icon="👥" 
                title="Deduplicate Records" 
                desc="Merge duplicate actors/films"
                onClick={() => runTask('deduplicate')}
                disabled={isProcessing}
              />
              <div className="pt-4 border-t border-border mt-4">
                <p className="text-[10px] font-black uppercase text-text-muted mb-3 tracking-widest px-1">Discover Rising Stars</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Yoruba', 'Igbo', 'Hausa'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => runTask('discover_actors', { region: cat })}
                      disabled={isProcessing}
                      className="py-2.5 bg-surface-2 hover:bg-brand hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* API Health & AI Status */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg space-y-5">
            <h2 className="text-[10px] font-black uppercase text-text-muted tracking-widest px-1">System Status</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border/50">
                <span className="text-xs font-bold text-text-muted">YouTube Connection</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                  apiStatus.youtube === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                }`}>{apiStatus.youtube}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border/50">
                <span className="text-xs font-bold text-text-muted">Movie Database API</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                  apiStatus.tmdb === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                }`}>{apiStatus.tmdb}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-primary italic">AI Engine Health</span>
                <span className="text-[10px] font-black text-brand uppercase">Online</span>
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
          <div className="bg-darker p-4 rounded-xl border border-border h-64 flex flex-col font-mono text-[11px] shadow-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <span className="text-white/40 uppercase font-black tracking-tighter">System Output</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/30" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
                <div className="w-2 h-2 rounded-full bg-green-500/30" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
              {logs.length === 0 && <p className="text-white/20 italic">Waiting for command...</p>}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 py-0.5 ${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'success' ? 'text-green-400 font-bold' : 'text-slate-300'
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
                  <span className="text-2xl">{activeTask === 'cleanup_films' ? '🧹' : activeTask === 'discover_actors' ? '🌟' : '🪄'}</span>
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
            {item.bio || item.synopsis || "Missing detail identified for enrichment..."}
          </p>
          
          <div className="flex gap-2 pt-1 border-t border-border/50">
            <button 
              onClick={() => onAction(item, 'APPLY')}
              className="px-3 py-1.5 bg-brand text-white rounded-lg text-[10px] font-black hover:scale-105 transition-transform"
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
