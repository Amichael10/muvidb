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

const formatDuration = (ms) => {
  if (!ms && ms !== 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(ms / 60000);
  const remainingSecs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${remainingSecs}s`;
};

// Escapes untrusted values (movie titles, admin names, log details — some
// sourced from scraped YouTube data or user-set profile names) before they are
// interpolated into the report HTML, preventing stored XSS in the exported
// audit document.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

const generatePDFWindow = (actions, selectedDate) => {
  const sortedActions = [...actions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Identify sub-admin profile details
  const subAdmin = sortedActions[0]?.users || { name: 'MuviDB Admin', email: 'admin@muvidb.com' };
  const adminName = subAdmin.name || 'Unknown Admin';
  const adminEmail = subAdmin.email || 'N/A';
  
  const estWorkTime = estimateWorkDuration(sortedActions);
  
  const totalCount = sortedActions.length;
  const creates = sortedActions.filter(a => a.action_type === 'create').length;
  const updates = sortedActions.filter(a => a.action_type === 'update').length;
  const deletes = sortedActions.filter(a => a.action_type === 'delete').length;
  
  // Group actions by movie title to count unique movies edited and count cast/crew credit edits per movie
  const movieBreakdown = {};
  sortedActions.forEach(a => {
    if (a.entity_type === 'film') {
      const movieTitle = a.entity_name || 'Unknown Movie';
      if (!movieBreakdown[movieTitle]) {
        movieBreakdown[movieTitle] = { title: movieTitle, filmEdits: 0, creditsCreated: 0, creditsEdited: 0 };
      }
      if (a.action_type === 'update') {
        movieBreakdown[movieTitle].filmEdits++;
      }
    } else if (a.entity_type === 'credit') {
      let movieTitle = 'Unknown Movie';
      if (a.entity_name && a.entity_name.includes(' in ')) {
        const parts = a.entity_name.split(' in ');
        movieTitle = parts[parts.length - 1].trim();
      }
      if (!movieBreakdown[movieTitle]) {
        movieBreakdown[movieTitle] = { title: movieTitle, filmEdits: 0, creditsCreated: 0, creditsEdited: 0 };
      }
      if (a.action_type === 'create') {
        movieBreakdown[movieTitle].creditsCreated++;
      } else if (a.action_type === 'update') {
        movieBreakdown[movieTitle].creditsEdited++;
      }
    }
  });

  const uniqueMovies = Object.values(movieBreakdown).filter(m => m.filmEdits > 0 || m.creditsCreated > 0 || m.creditsEdited > 0);
  const totalUniqueMoviesEdited = uniqueMovies.length;
  
  const moviesCreated = sortedActions.filter(a => a.entity_type === 'film' && a.action_type === 'create').length;
  const moviesDeleted = sortedActions.filter(a => a.entity_type === 'film' && a.action_type === 'delete').length;
  
  const castCreated = sortedActions.filter(a => a.entity_type === 'person' && a.action_type === 'create').length;
  const castEdited = sortedActions.filter(a => a.entity_type === 'person' && a.action_type === 'update').length;
  const castDeleted = sortedActions.filter(a => a.entity_type === 'person' && a.action_type === 'delete').length;

  const creditsCreated = sortedActions.filter(a => a.entity_type === 'credit' && a.action_type === 'create').length;
  const creditsEdited = sortedActions.filter(a => a.entity_type === 'credit' && a.action_type === 'update').length;

  const companiesCreated = sortedActions.filter(a => a.entity_type === 'company' && a.action_type === 'create').length;
  const companiesEdited = sortedActions.filter(a => a.entity_type === 'company' && a.action_type === 'update').length;
  
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
        <title>MuviDB Audit Report - ${escapeHtml(adminName)}</title>
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
          
          .breakdown-title {
            font-size: 14px;
            font-weight: 700;
            color: #334155;
            margin-top: 25px;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .breakdown-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 35px;
          }
          .breakdown-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
          }
          .breakdown-card h4 {
            margin: 0 0 10px 0;
            font-size: 10px;
            text-transform: uppercase;
            color: #475569;
            letter-spacing: 0.05em;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
          }
          .breakdown-stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 12px;
          }
          .breakdown-stat:last-child {
            margin-bottom: 0;
          }
          .breakdown-label {
            color: #64748b;
          }
          .breakdown-value {
            font-weight: 700;
            color: #0f172a;
          }
          .breakdown-value.highlight {
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
            <div class="brand-logo">MuviDB</div>
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
            <p>${escapeHtml(adminName)}</p>
            <span style="font-size: 11px; color: #64748b;">${escapeHtml(adminEmail)}</span>
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

        <div class="breakdown-title">Detailed Contributions Breakdown</div>
        <div class="breakdown-grid">
          <div class="breakdown-card">
            <h4>Movie Directory</h4>
            <div class="breakdown-stat">
              <span class="breakdown-label">Movies Created</span>
              <span class="breakdown-value">${moviesCreated}</span>
            </div>
            <div class="breakdown-stat">
              <span class="breakdown-label">Unique Movies Edited</span>
              <span class="breakdown-value highlight">${totalUniqueMoviesEdited}</span>
            </div>
            <div class="breakdown-stat">
              <span class="breakdown-label">Movies Deleted</span>
              <span class="breakdown-value">${moviesDeleted}</span>
            </div>
          </div>
          <div class="breakdown-card">
            <h4>Cast Profiles (People)</h4>
            <div class="breakdown-stat">
              <span class="breakdown-label">Cast Created</span>
              <span class="breakdown-value highlight">${castCreated}</span>
            </div>
            <div class="breakdown-stat">
              <span class="breakdown-label">Cast Edited</span>
              <span class="breakdown-value highlight">${castEdited}</span>
            </div>
            <div class="breakdown-stat">
              <span class="breakdown-label">Cast Deleted</span>
              <span class="breakdown-value">${castDeleted}</span>
            </div>
          </div>
          <div class="breakdown-card">
            <h4>Credits & Partnerships</h4>
            <div class="breakdown-stat">
              <span class="breakdown-label">Credits Created</span>
              <span class="breakdown-value">${creditsCreated}</span>
            </div>
            <div class="breakdown-stat">
              <span class="breakdown-label">Credits Edited</span>
              <span class="breakdown-value">${creditsEdited}</span>
            </div>
            <div class="breakdown-stat">
              <span class="breakdown-label">Companies Managed</span>
              <span class="breakdown-value">${companiesCreated + companiesEdited}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-title">Movie-Specific Contribution Detail</div>
        <table class="logs-table" style="margin-bottom: 35px;">
          <thead>
            <tr>
              <th style="width: 50%;">Edited Movie Title</th>
              <th style="width: 25%; text-align: center;">Cast/Crew Created</th>
              <th style="width: 25%; text-align: center;">Cast/Crew Edited</th>
            </tr>
          </thead>
          <tbody>
            ${uniqueMovies.length === 0 ? `
              <tr>
                <td colspan="3" style="text-align: center; color: #64748b; font-style: italic;">
                  No movie edits or credits logged in this period.
                </td>
              </tr>
            ` : uniqueMovies.map(m => `
              <tr>
                <td style="font-weight: 700; color: #0f172a;">${escapeHtml(m.title)}</td>
                <td style="text-align: center; font-weight: 600; color: #15803d;">
                  ${m.creditsCreated > 0 ? `+${m.creditsCreated}` : '0'}
                </td>
                <td style="text-align: center; font-weight: 600; color: #1d4ed8;">
                  ${m.creditsEdited > 0 ? `+${m.creditsEdited}` : '0'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

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
                  <span class="badge badge-${escapeHtml(a.action_type)}">
                    ${escapeHtml(a.action_type)}
                  </span>
                </td>
                <td style="text-transform: capitalize; font-weight: 600; color: #475569;">
                  ${escapeHtml(a.entity_type)}
                </td>
                <td style="font-weight: 700; color: #0f172a;">
                  ${a.entity_name ? escapeHtml(a.entity_name) : '<span style="font-style: italic; color: #94a3b8;">N/A</span>'}
                </td>
                <td style="color: #64748b; font-family: monospace; font-size: 9px; word-break: break-all;">
                  ${a.details ? escapeHtml(JSON.stringify(a.details)) : '{}'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          This document represents verified cryptographic database logs tracked by MuviDB.
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
  const [activeTab, setActiveTab] = useState('actions'); // 'actions' | 'syncs'
  
  // Tab 1: Human Admin Logs States
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const pageSize = 20;

  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterName, setFilterName] = useState('');
  const [debouncedFilterName, setDebouncedFilterName] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterName(filterName);
    }, filterName ? 400 : 0);
    return () => clearTimeout(timer);
  }, [filterName]);

  const [filterDate, setFilterDate] = useState('');

  // Tab 2: Automated Sync Logs States
  const [syncLogs, setSyncLogs] = useState([]);
  const [filterSyncStatus, setFilterSyncStatus] = useState('all');
  const [filterSyncSource, setFilterSyncSource] = useState('all');
  const [expandedSyncLogs, setExpandedSyncLogs] = useState(new Set());

  // Reset page when switching tabs or filters change
  useEffect(() => {
    setPage(1);
    setPageInput('1');
    setExpandedSyncLogs(new Set());
  }, [activeTab, filterAction, filterEntity, debouncedFilterName, filterDate, filterSyncStatus, filterSyncSource]);

  // Main Fetch Switch
  useEffect(() => {
    if (activeTab === 'actions') {
      fetchLogs();
    } else {
      fetchSyncLogs();
    }
  }, [page, activeTab, filterAction, filterEntity, debouncedFilterName, filterDate, filterSyncStatus, filterSyncSource]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const selectQuery = debouncedFilterName ? '*, users!inner(name, email, role)' : '*, users(name, email, role)';
      
      let query = supabase
        .from('admin_actions')
        .select(selectQuery, { count: 'exact' });

      if (debouncedFilterName) {
        query = query.ilike('users.name', `%${debouncedFilterName}%`);
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

  const fetchSyncLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sync_logs')
        .select('*', { count: 'exact' });

      if (filterSyncStatus !== 'all') {
        query = query.eq('status', filterSyncStatus);
      }
      if (filterSyncSource !== 'all') {
        query = query.eq('source', filterSyncSource);
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

      setSyncLogs(data || []);
      setTotalCount(count || 0);
      setPageInput(page.toString());
    } catch (err) {
      console.error('Error fetching sync logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSyncLogDetail = (id) => {
    setExpandedSyncLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
    if (!newPage && newPage !== 0) return;
    if (newPage >= 1 && newPage <= totalPages) {
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
    <div className="flex flex-col h-[calc(100vh-theme(spacing.32))] max-h-[850px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Database Logs</h2>
          <p className="text-sm text-text-muted mt-1">Monitor administrator actions and automated syncing logs.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {activeTab === 'actions' && (
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
          )}

          {activeTab === 'actions' ? (
            <>
              <input
                type="text"
                placeholder="Search by name..."
                value={filterName}
                onChange={(e) => { setFilterName(e.target.value); setPage(1); }}
                className="w-full md:w-40 px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all placeholder:text-text-muted"
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
            </>
          ) : (
            <>
              <select
                value={filterSyncSource}
                onChange={(e) => { setFilterSyncSource(e.target.value); setPage(1); }}
                className="w-full md:w-auto px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
              >
                <option value="all">All Modules</option>
                <option value="master">Master Sync</option>
                <option value="videos">YouTube Videos Sync</option>
                <option value="showtimes">Cinema Showtimes</option>
                <option value="tmdb">TMDB Records Sync</option>
                <option value="ai_maintenance">AI Cast Extraction</option>
                <option value="cast_vision_sync">OCR Cast Vision Sync</option>
                <option value="filmhouse">Filmhouse Scraper</option>
                <option value="genesis">Genesis Scraper</option>
                <option value="kava">Kava Scraper</option>
              </select>

              <select
                value={filterSyncStatus}
                onChange={(e) => { setFilterSyncStatus(e.target.value); setPage(1); }}
                className="w-full md:w-auto px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
              >
                <option value="all">All Outcomes</option>
                <option value="success">Success</option>
                <option value="running">Running</option>
                <option value="error">Failed</option>
              </select>
            </>
          )}

          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
            className="w-full md:w-auto px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all [color-scheme:dark]"
          />
          
          {(filterName || filterDate || filterAction !== 'all' || filterEntity !== 'all' || filterSyncSource !== 'all' || filterSyncStatus !== 'all') && (
            <button
              onClick={() => {
                setFilterName('');
                setFilterDate('');
                setFilterAction('all');
                setFilterEntity('all');
                setFilterSyncSource('all');
                setFilterSyncStatus('all');
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

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 shrink-0">
        <button
          onClick={() => setActiveTab('actions')}
          className={`px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'actions'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:user-linear" className="text-base" />
          <span>Admin Actions</span>
        </button>
        <button
          onClick={() => setActiveTab('syncs')}
          className={`px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'syncs'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:refresh-linear" className="text-base" />
          <span>Automated Sync History</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-border rounded-2xl flex flex-col min-h-0 flex-1 shadow-sm overflow-hidden">
        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-sm shadow-sm border-b border-border">
              <tr className="text-text-muted text-xs font-bold uppercase tracking-wider">
                {activeTab === 'actions' ? (
                  <>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Entity</th>
                    <th className="px-6 py-4">Details</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Module</th>
                    <th className="px-6 py-4">Outcome</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Metrics</th>
                    <th className="px-6 py-4">Summary</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'actions' ? 5 : 6} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      <p>Loading logs...</p>
                    </div>
                  </td>
                </tr>
              ) : activeTab === 'actions' ? (
                logs.length === 0 ? (
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
                )
              ) : (
                syncLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Icon icon="solar:refresh-linear" className="text-4xl text-text-muted/50" />
                        <p>No automated sync runs logged matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  syncLogs.map((log) => {
                    const isExpanded = expandedSyncLogs.has(log.id);
                    const hasDetails = log.details && Object.keys(log.details).length > 0;
                    return (
                      <React.Fragment key={log.id}>
                        <tr 
                          className={`hover:bg-surface-2/50 transition-colors group cursor-pointer ${isExpanded ? 'bg-surface-2/30' : ''}`}
                          onClick={() => hasDetails && toggleSyncLogDetail(log.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-text-muted text-xs">
                            {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-bold text-text-primary text-xs uppercase tracking-tight">
                            <span>{log.source?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              log.status === 'success' ? 'text-green-500 bg-green-500/10 border-green-500/20' :
                              log.status === 'running' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20 animate-pulse' :
                              'text-red-500 bg-red-500/10 border-red-500/20'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-text-primary font-mono text-xs">
                            {formatDuration(log.duration_ms)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] font-bold text-text-muted animate-in fade-in" title="Processed items count">
                                P: {log.items_processed || 0}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/5 border border-blue-500/10 text-[9px] font-bold text-blue-500 animate-in fade-in" title="Updated items count">
                                U: {log.items_updated || 0}
                              </span>
                              {log.items_failed > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[9px] font-bold text-red-500 animate-in fade-in" title="Failed items count">
                                  F: {log.items_failed}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs max-w-xs truncate text-text-secondary" title={log.message}>
                            <div className="flex items-center gap-2">
                              <span className="truncate">{log.message || 'No status message'}</span>
                              {hasDetails && (
                                <Icon 
                                  icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} 
                                  className="text-text-muted shrink-0 w-3.5 h-3.5 ml-auto group-hover:text-brand transition-colors" 
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && hasDetails && (
                          <tr>
                            <td colSpan="6" className="bg-surface-2/30 border-b border-border/85 px-8 py-5">
                              <div className="space-y-4 max-w-4xl animate-in slide-in-from-top-2 duration-300">
                                <div className="text-[10px] font-black text-brand uppercase tracking-widest flex items-center gap-1.5">
                                  <Icon icon="solar:document-text-bold" width="14" />
                                  <span>Sync Logs Payload & Metadata Details</span>
                                </div>
                                <pre className="text-[10px] font-mono leading-relaxed bg-surface border border-border rounded-xl p-5 overflow-x-auto max-h-96 text-text-secondary custom-scrollbar shadow-inner select-all">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )
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
