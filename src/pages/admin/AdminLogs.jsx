import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';

const estimateWorkDuration = (actions) => {
  if (!actions || actions.length === 0) return '0 mins';
  
  // Sort actions chronologically (ascending)
  const sorted = [...actions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  let totalMs = 0;
  let sessionStart = new Date(sorted[0].created_at);
  let prevActionTime = sessionStart;
  
  const SESSION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes threshold
  const DEFAULT_BUFFER_MS = 10 * 60 * 1000; // 10 minutes buffer
  
  for (let i = 1; i < sorted.length; i++) {
    const currentTime = new Date(sorted[i].created_at);
    const gap = currentTime - prevActionTime;
    
    if (gap > SESSION_THRESHOLD_MS) {
      // Add duration + buffer for completed session
      totalMs += (prevActionTime - sessionStart) + DEFAULT_BUFFER_MS;
      sessionStart = currentTime;
    }
    
    prevActionTime = currentTime;
  }
  
  // Add the last session duration + buffer
  totalMs += (prevActionTime - sessionStart) + DEFAULT_BUFFER_MS;
  
  const totalMinutes = Math.floor(totalMs / (60 * 1000));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  if (hrs === 0) return `${mins} min${mins > 1 ? 's' : ''}`;
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
};

const generatePDFWindow = (actions, selectedDate) => {
  const sortedActions = [...actions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Identify sub-admin profile details
  const subAdmin = sortedActions[0]?.users || { name: 'Ensembla Admin', email: 'admin@ensembla.xyz' };
  const adminName = subAdmin.name || 'Unknown Admin';
  const adminEmail = subAdmin.email || 'N/A';
  
  const estWorkTime = estimateWorkDuration(sortedActions);
  
  const totalCount = sortedActions.length;
  const creates = sortedActions.filter(a => a.action_type === 'create').length;
  const updates = sortedActions.filter(a => a.action_type === 'update').length;
  const deletes = sortedActions.filter(a => a.action_type === 'delete').length;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the PDF report.');
    return;
  }
  
  const dateRangeStr = selectedDate 
    ? new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'All Time';
    
  printWindow.document.write(`
    <html>
      <head>
        <title>Ensembla Audit Report - ${adminName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 40px;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .brand-logo {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.05em;
            color: #ff5c00;
          }
          .brand-subtitle {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 800;
            color: #94a3b8;
            letter-spacing: 0.15em;
            margin-top: 2px;
          }
          .report-meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
          }
          .report-title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 4px;
          }
          .summary-title {
            font-size: 14px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 35px;
          }
          .summary-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
          }
          .summary-card h4 {
            margin: 0 0 6px 0;
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.05em;
          }
          .summary-card p {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }
          .summary-card .highlight {
            color: #ff5c00;
          }
          .logs-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 30px;
          }
          .logs-table th, .logs-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
          }
          .logs-table th {
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.05em;
          }
          .badge {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-create { background: #dcfce7; color: #15803d; }
          .badge-update { background: #dbeafe; color: #1d4ed8; }
          .badge-delete { background: #fee2e2; color: #b91c1c; }
          
          .footer {
            border-top: 1px dashed #cbd5e1;
            padding-top: 15px;
            margin-top: 50px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
          }
          
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-logo">ENSEMBLA</div>
            <div class="brand-subtitle">Database Audit System</div>
          </div>
          <div class="report-meta">
            <div class="report-title">Admin Work Audit Report</div>
            <div>Date Range: <strong>${dateRangeStr}</strong></div>
            <div>Generated: <strong>${new Date().toLocaleString()}</strong></div>
          </div>
        </div>

        <div class="summary-title">Work Session Summary</div>
        <div class="summary-grid">
          <div class="summary-card" style="grid-column: span 2;">
            <h4>Audited Administrator</h4>
            <p>${adminName}</p>
            <span style="font-size: 11px; color: #64748b;">${adminEmail}</span>
          </div>
          <div class="summary-card">
            <h4>Est. Active Duration</h4>
            <p class="highlight">${estWorkTime}</p>
            <span style="font-size: 9px; color: #94a3b8;">Gap-based active estimate</span>
          </div>
          <div class="summary-card">
            <h4>Total Edits Logged</h4>
            <p>${totalCount}</p>
            <span style="font-size: 9px; color: #64748b;">C: ${creates} | U: ${updates} | D: ${deletes}</span>
          </div>
        </div>

        <div class="summary-title">Chronological Log Trail (${totalCount} Entries)</div>
        <table class="logs-table">
          <thead>
            <tr>
              <th style="width: 15%;">Timestamp</th>
              <th style="width: 10%;">Action</th>
              <th style="width: 15%;">Entity</th>
              <th style="width: 30%;">Title / Name</th>
              <th style="width: 30%;">Audit Parameters</th>
            </tr>
          </thead>
          <tbody>
            ${sortedActions.map(a => `
              <tr>
                <td style="color: #64748b; font-size: 10px;">
                  ${new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <span class="badge badge-${a.action_type}">
                    ${a.action_type}
                  </span>
                </td>
                <td style="text-transform: capitalize; font-weight: 600; color: #475569;">
                  ${a.entity_type}
                </td>
                <td style="font-weight: 700; color: #0f172a;">
                  ${a.entity_name || '<span style="font-style: italic; color: #94a3b8;">N/A</span>'}
                </td>
                <td style="color: #64748b; font-family: monospace; font-size: 9px; word-break: break-all;">
                  ${a.details ? JSON.stringify(a.details) : '{}'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          This document represents verified cryptographic database logs tracked by Ensembla.
          All working durations are scientifically estimated using chronological action-gap clustering.
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export default function AdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const pageSize = 20;

  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterName, setFilterName] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction, filterEntity, filterName, filterDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const selectQuery = filterName ? '*, users!inner(name, email, role)' : '*, users(name, email, role)';
      
      let query = supabase
        .from('admin_actions')
        .select(selectQuery, { count: 'exact' });

      if (filterName) {
        query = query.ilike('users.name', `%${filterName}%`);
      }
      if (filterAction !== 'all') {
        query = query.eq('action_type', filterAction);
      }
      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }
      if (filterDate) {
        const [year, month, day] = filterDate.split('-');
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        query = query.gte('created_at', startOfDay.toISOString());
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
      setPageInput(page.toString());
    } catch (err) {
      console.error('Error fetching admin logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setExporting(true);
    try {
      const selectQuery = filterName ? '*, users!inner(name, email, role)' : '*, users(name, email, role)';
      
      let query = supabase
        .from('admin_actions')
        .select(selectQuery);

      if (filterName) {
        query = query.ilike('users.name', `%${filterName}%`);
      }
      if (filterAction !== 'all') {
        query = query.eq('action_type', filterAction);
      }
      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }
      if (filterDate) {
        const [year, month, day] = filterDate.split('-');
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        query = query.gte('created_at', startOfDay.toISOString());
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        alert('No activity logs found matching your filters to generate a report.');
        return;
      }

      generatePDFWindow(data, filterDate);
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Failed to generate audit report.');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handlePageSubmit = (e) => {
    e.preventDefault();
    const newPage = parseInt(pageInput, 10);
    if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    } else {
      setPageInput(page.toString());
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'create': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'update': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'delete': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-text-muted bg-surface-2 border-border';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.32))] max-h-[800px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Activity Logs</h2>
          <p className="text-sm text-text-muted mt-1">Monitor all administrative actions across the platform.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleGenerateReport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white font-bold text-sm rounded-xl hover:scale-[1.02] shadow-lg shadow-brand/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Icon icon="solar:document-text-bold" width="18" />
                <span>Export Audit PDF</span>
              </>
            )}
          </button>
          <input
            type="text"
            placeholder="Search by name..."
            value={filterName}
            onChange={(e) => { setFilterName(e.target.value); setPage(1); }}
            className="w-full md:w-40 px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all placeholder:text-text-muted"
          />

          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
            className="w-full md:w-auto px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all [color-scheme:dark]"
          />

          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="w-full md:w-auto px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
          >
            <option value="all">All Actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>

          <select
            value={filterEntity}
            onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
            className="w-full md:w-auto px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
          >
            <option value="all">All Entities</option>
            <option value="film">Films</option>
            <option value="person">People</option>
            <option value="credit">Credits</option>
            <option value="company">Companies</option>
          </select>
          
          {(filterName || filterDate || filterAction !== 'all' || filterEntity !== 'all') && (
            <button
              onClick={() => {
                setFilterName('');
                setFilterDate('');
                setFilterAction('all');
                setFilterEntity('all');
                setPage(1);
              }}
              className="p-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text-primary transition-all"
              title="Clear Filters"
            >
              <Icon icon="solar:trash-bin-trash-linear" width="20" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-border rounded-2xl flex flex-col min-h-0 flex-1 shadow-sm overflow-hidden">
        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b border-border text-text-muted text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      <p>Loading activity logs...</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Icon icon="solar:history-linear" className="text-4xl text-text-muted/50" />
                      <p>No activity logs found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-2/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-text-muted text-xs">
                      {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-brand font-bold text-xs border border-border">
                          {log.users?.name?.charAt(0) || log.users?.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{log.users?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-text-muted">{log.users?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize text-text-primary">{log.entity_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-text-primary text-sm line-clamp-1" title={log.entity_name}>
                        {log.entity_name || <span className="italic text-text-muted">Unknown</span>}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-border bg-surface-2/30 px-6 py-4 flex items-center justify-between shrink-0">
          <p className="text-xs text-text-muted font-medium">
            Showing {Math.min(totalCount, (page - 1) * pageSize + 1)} to {Math.min(totalCount, page * pageSize)} of {totalCount} logs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(1); setPageInput('1'); }}
              disabled={page === 1 || loading}
              className="p-2 rounded-lg bg-surface border border-border text-text-primary hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="First Page"
            >
              <Icon icon="solar:double-alt-arrow-left-linear" className="text-lg" />
            </button>
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); setPageInput(String(Math.max(1, page - 1))); }}
              disabled={page === 1 || loading}
              className="p-2 rounded-lg bg-surface border border-border text-text-primary hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
            </button>
            
            <form onSubmit={handlePageSubmit} className="flex items-center gap-2 px-2">
              <span className="text-sm text-text-muted">Page</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageSubmit}
                className="w-16 px-2 py-1 bg-surface border border-border rounded-lg text-sm text-center text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none"
              />
              <span className="text-sm text-text-muted">of {totalPages}</span>
            </form>

            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setPageInput(String(Math.min(totalPages, page + 1))); }}
              disabled={page === totalPages || loading}
              className="p-2 rounded-lg bg-surface border border-border text-text-primary hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
            </button>
            <button
              onClick={() => { setPage(totalPages); setPageInput(String(totalPages)); }}
              disabled={page === totalPages || loading}
              className="p-2 rounded-lg bg-surface border border-border text-text-primary hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Last Page"
            >
              <Icon icon="solar:double-alt-arrow-right-linear" className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
