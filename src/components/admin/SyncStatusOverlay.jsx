import React from 'react';

export default function SyncStatusOverlay({ progress, report, onClose }) {
  if (!progress && !report) return null;

  const isComplete = !!report;
  const percent = progress ? Math.round((progress.current / progress.total) * 100) : 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface-2 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-text-primary tracking-tight">
              {isComplete ? 'Synchronization Report' : 'Synchronizing Network'}
            </h3>
            <p className="text-text-muted text-xs font-medium uppercase tracking-widest mt-1 italic">
              {isComplete ? 'Task Completed' : `Processing ${progress.current} of ${progress.total} signals`}
            </p>
          </div>
          {isComplete && (
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/30 transition-all"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isComplete ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="relative w-32 h-32 mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-surface-3"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * percent) / 100}
                    className="text-brand transition-all duration-500 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black text-text-primary">{percent}%</span>
                </div>
              </div>
              <p className="text-lg font-bold text-text-primary mb-2">{progress.status}</p>
              <div className="w-full max-w-md bg-surface-2 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand transition-all duration-500" 
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-lg bg-surface-2 border border-border text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase mb-1">Total</p>
                  <p className="text-xl font-bold">{report.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                  <p className="text-[10px] font-black text-green-500/60 uppercase mb-1">Success</p>
                  <p className="text-xl font-bold text-green-500">{report.filter(r => r.success).length}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                  <p className="text-[10px] font-black text-red-500/60 uppercase mb-1">Failed</p>
                  <p className="text-xl font-bold text-red-500">{report.filter(r => !r.success).length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Detailed Logs</p>
                {report.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-surface-2 border border-border flex items-center justify-between group hover:border-brand/20 transition-all">
                    <div className="flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full ${item.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-sm font-bold text-text-primary">{item.name}</p>
                        {item.error && <p className="text-[10px] text-red-400 mt-0.5">{item.error}</p>}
                      </div>
                    </div>
                    {item.success && (
                      <span className="text-[10px] font-black text-brand uppercase bg-brand/10 px-2 py-1 rounded">
                        +{item.count} videos
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isComplete && (
          <div className="p-6 border-t border-border bg-surface-2">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-text-primary text-surface rounded-lg text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              Acknowledge and Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
