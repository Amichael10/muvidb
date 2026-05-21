import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const pageSize = 20;

  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction, filterEntity]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_actions')
        .select('*, users(name, email, role)', { count: 'exact' });

      if (filterAction !== 'all') {
        query = query.eq('action_type', filterAction);
      }
      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
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

        <div className="flex items-center gap-3 w-full md:w-auto">
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
