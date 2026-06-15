import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function MergeModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  items, 
  type = 'person' 
}) {
  const [primaryId, setPrimaryId] = useState(items[0]?.id);
  const [enrichedData, setEnrichedData] = useState({});
  const [step, setStep] = useState(1); // 1: Select Primary, 2: Enrich Data

  useEffect(() => {
    if (items.length > 0) {
      setPrimaryId(items[0].id);
    }
  }, [items]);

  if (!isOpen || items.length < 2) return null;

  const primary = items.find(item => item.id === primaryId) || items[0];
  const secondaries = items.filter(item => item.id !== primaryId);

  // Fields to compare based on type
  const fieldConfig = type === 'person' ? [
    { key: 'name', label: 'Full Name' },
    { key: 'bio', label: 'Biography', type: 'longtext' },
    { key: 'photo_url', label: 'Photo', type: 'image' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'gender', label: 'Gender' },
    { key: 'youtube_handle', label: 'YouTube Handle' },
    { key: 'youtube_channel_id', label: 'Channel ID' },
  ] : [
    { key: 'title', label: 'Title' },
    { key: 'synopsis', label: 'Synopsis', type: 'longtext' },
    { key: 'poster_url', label: 'Poster', type: 'image' },
    { key: 'year', label: 'Release Year' },
    { key: 'language', label: 'Language' },
    { key: 'runtime_minutes', label: 'Runtime' },
    { key: 'status', label: 'Status' },
    { key: 'release_type', label: 'Release Type' },
  ];

  // Create a composite secondary to show the best available data from ALL duplicates
  const compositeSecondary = secondaries.reduce((acc, curr) => {
    fieldConfig.forEach(f => {
      if (!acc[f.key] && curr[f.key]) acc[f.key] = curr[f.key];
    });
    return acc;
  }, {});

  const handleInitializeEnrichment = () => {
    const initial = {};
    fieldConfig.forEach(f => {
      initial[f.key] = primary[f.key] || compositeSecondary[f.key] || '';
    });
    setEnrichedData(initial);
    setStep(2);
  };

  const toggleField = (key, value) => {
    setEnrichedData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-surface-2/50">
          <div>
            <h2 className="text-xl font-black text-text-primary tracking-tight">
              {step === 1 ? 'Select Primary Identity' : 'Data Enrichment & Conflict Resolution'}
            </h2>
            <p className="text-xs text-text-muted font-medium mt-1">
              {step === 1 
                ? 'Choose the profile that will serve as the primary host.' 
                : 'Choose the best information from both records to create the final profile.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-full transition-colors">
            <Icon icon="solar:close-circle-linear" className="text-xl text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          {step === 1 ? (
            <div className="p-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setPrimaryId(item.id)}
                      className={`flex flex-col gap-4 p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
                        primaryId === item.id 
                          ? 'border-brand bg-brand/5 shadow-xl shadow-brand/10' 
                          : 'border-border bg-surface-2 hover:border-brand/40'
                      }`}
                    >
                      {primaryId === item.id && (
                        <div className="absolute top-0 right-0 bg-brand text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                          Surviving Record
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-surface border border-border overflow-hidden flex-shrink-0 shadow-md">
                          <img src={item.photo_url || item.poster_url || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 pr-4">
                          <div className="font-bold text-text-primary text-base truncate">{item.name || item.title}</div>
                          <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
                            {type === 'person' ? (item.nationality || 'Unknown') : (item.year || 'TBD')}
                          </div>
                          <div className="text-[9px] text-text-muted/50 font-mono mt-1">ID: {item.id}</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                         <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-text-muted uppercase">Data Quality</span>
                            <span className={item.bio || item.synopsis ? 'text-green-500' : 'text-amber-500'}>
                               {item.bio || item.synopsis ? 'High (Has Metadata)' : 'Low (Basic Info)'}
                            </span>
                         </div>
                         <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                            <div className="h-full bg-brand transition-all" style={{ width: (item.bio || item.synopsis) ? '100%' : '30%' }}></div>
                         </div>
                      </div>
                    </button>
                  ))}
               </div>

               <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-xl flex gap-4">
                  <Icon icon="solar:info-circle-bold" className="text-2xl text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black text-amber-600 dark:text-amber-400">Why choose?</h4>
                    <p className="text-[11px] text-text-muted font-medium mt-1 leading-relaxed">
                      All relations (credits, videos, links) will be moved to the primary record automatically. 
                      In the next step, you will be able to pick specific pieces of text or images from the secondary record to update the primary.
                    </p>
                  </div>
               </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Enrichment Table Header */}
              <div className="grid grid-cols-12 bg-surface-2/80 sticky top-0 z-10 backdrop-blur-md border-b border-border">
                <div className="col-span-3 p-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Property</div>
                <div className="col-span-4 p-4 text-[10px] font-black text-brand uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
                  Primary Record
                </div>
                <div className="col-span-1 p-4"></div>
                <div className="col-span-4 p-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Secondary Record</div>
              </div>

              {fieldConfig.map((field) => (
                <div key={field.key} className="grid grid-cols-12 group hover:bg-surface-2/30 transition-colors">
                  {/* Property Name */}
                  <div className="col-span-3 p-6 flex flex-col justify-center border-r border-border">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">{field.label}</span>
                    <span className="text-[9px] text-text-muted/40 font-mono italic">field: {field.key}</span>
                  </div>

                  {/* Primary Option */}
                  <div 
                    onClick={() => toggleField(field.key, primary[field.key])}
                    className={`col-span-4 p-6 cursor-pointer transition-all flex flex-col gap-2 ${
                      enrichedData[field.key] === primary[field.key] 
                        ? 'bg-brand/5 border-x border-brand/20' 
                        : 'opacity-40 grayscale hover:opacity-70'
                    }`}
                  >
                    {field.type === 'image' ? (
                      <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-surface shadow-sm">
                        <img src={primary[field.key] || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                      </div>
                    ) : field.type === 'longtext' ? (
                      <p className="text-xs text-text-primary line-clamp-3 leading-relaxed">{primary[field.key] || <em className="text-text-muted/50">No data</em>}</p>
                    ) : (
                      <span className="text-sm font-bold text-text-primary">{primary[field.key] || <em className="text-text-muted/50">No data</em>}</span>
                    )}
                    {enrichedData[field.key] === primary[field.key] && (
                      <div className="flex items-center gap-1.5 text-brand text-[9px] font-black uppercase mt-1">
                        <Icon icon="solar:check-circle-bold" /> Selected
                      </div>
                    )}
                  </div>

                  {/* Middle Connector */}
                  <div className="col-span-1 flex items-center justify-center">
                     <Icon icon="solar:transfer-horizontal-linear" className="text-text-muted/20 text-xl" />
                  </div>

                  {/* Secondary Option */}
                  <div 
                    onClick={() => toggleField(field.key, compositeSecondary[field.key])}
                    className={`col-span-4 p-6 cursor-pointer transition-all flex flex-col gap-2 ${
                      enrichedData[field.key] === compositeSecondary[field.key] 
                        ? 'bg-brand/5 border-x border-brand/20' 
                        : 'opacity-40 grayscale hover:opacity-70'
                    }`}
                  >
                    {field.type === 'image' ? (
                      <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-surface shadow-sm">
                        <img src={compositeSecondary[field.key] || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                      </div>
                    ) : field.type === 'longtext' ? (
                      <p className="text-xs text-text-primary line-clamp-3 leading-relaxed">{compositeSecondary[field.key] || <em className="text-text-muted/50">No data</em>}</p>
                    ) : (
                      <span className="text-sm font-bold text-text-primary">{compositeSecondary[field.key] || <em className="text-text-muted/50">No data</em>}</span>
                    )}
                    {enrichedData[field.key] === compositeSecondary[field.key] && (
                      <div className="flex items-center gap-1.5 text-brand text-[9px] font-black uppercase mt-1">
                        <Icon icon="solar:check-circle-bold" /> Selected
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-surface-2/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
             {step === 2 && (
               <button 
                 onClick={() => setStep(1)}
                 className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors text-xs font-bold"
               >
                 <Icon icon="solar:alt-arrow-left-linear" />
                 Change Primary Record
               </button>
             )}
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-sm font-bold text-text-muted hover:text-text-primary transition-colors">Abort</button>
            {step === 1 ? (
              <button
                onClick={handleInitializeEnrichment}
                className="px-8 py-2.5 bg-brand text-white font-black text-sm rounded-lg shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
              >
                Configure Data
                <Icon icon="solar:alt-arrow-right-linear" />
              </button>
            ) : (
              <button
                onClick={() => onConfirm(primaryId, secondaries.map(s => s.id), enrichedData)}
                className="px-8 py-2.5 bg-brand text-white font-black text-sm rounded-lg shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
              >
                Finalize & Merge Records
                <Icon icon="solar:magic-stick-bold" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
