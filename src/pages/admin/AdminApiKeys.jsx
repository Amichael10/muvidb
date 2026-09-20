import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';

const AVAILABLE_SCOPES = [
  {
    id: 'films:read',
    label: 'Films (Read)',
    description: 'Search films, view details, synopses, posters, and streaming links',
    default: true,
  },
  {
    id: 'people:read',
    label: 'People (Read)',
    description: 'Access talent bios, primary departments, and full filmography',
    default: true,
  },
  {
    id: 'credits:read',
    label: 'Credits (Read)',
    description: 'Detailed cast and crew lists with character names and departments',
    default: true,
  },
  {
    id: 'boxoffice:read',
    label: 'Box Office (Read)',
    description: 'Weekend cinema rankings, total grosses, and box office rankings',
    default: false,
  },
];

export default function AdminApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Edit Key state
  const [editingKey, setEditingKey] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    tier: 'free',
    scopes: ['films:read', 'people:read', 'credits:read'],
    rate_limit_per_min: 60,
  });

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data?_r=api-keys');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch API keys');

      if (data.needs_migration) {
        setNeedsMigration(true);
      } else {
        setNeedsMigration(false);
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleToggleScope = (scopeId) => {
    setFormData((prev) => {
      const exists = prev.scopes.includes(scopeId);
      const updated = exists ? prev.scopes.filter((s) => s !== scopeId) : [...prev.scopes, scopeId];
      return { ...prev, scopes: updated };
    });
  };

  const handleToggleEditScope = (scopeId) => {
    setEditFormData((prev) => {
      if (!prev) return prev;
      const exists = prev.scopes.includes(scopeId);
      const updated = exists ? prev.scopes.filter((s) => s !== scopeId) : [...prev.scopes, scopeId];
      return { ...prev, scopes: updated };
    });
  };

  const applyTierPresets = (tier, isEdit = false) => {
    let rate = 60;
    let scopes = ['films:read', 'people:read', 'credits:read'];
    if (tier === 'pro') {
      rate = 600;
      scopes = ['films:read', 'people:read', 'credits:read', 'boxoffice:read'];
    } else if (tier === 'enterprise') {
      rate = 2000;
      scopes = ['films:read', 'people:read', 'credits:read', 'boxoffice:read'];
    }

    if (isEdit) {
      setEditFormData((prev) => ({
        ...prev,
        tier,
        rate_limit_per_min: rate,
        scopes,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        tier,
        rate_limit_per_min: rate,
        scopes,
      }));
    }
  };

  const handleOpenEdit = (key) => {
    setEditingKey(key);
    setEditFormData({
      id: key.id,
      name: key.name || '',
      tier: key.tier || 'free',
      scopes: Array.isArray(key.scopes) ? [...key.scopes] : ['films:read'],
      rate_limit_per_min: key.rate_limit_per_min || 60,
      is_active: Boolean(key.is_active),
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData || !editFormData.name.trim()) return;
    if (editFormData.scopes.length === 0) {
      alert('Please select at least one permission scope.');
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch('/api/data?_r=api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update key');

      setEditingKey(null);
      setEditFormData(null);
      fetchKeys();
    } catch (err) {
      alert(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (formData.scopes.length === 0) {
      alert('Please select at least one permission scope.');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/data?_r=api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate key');

      setNewKeyResult(data.api_key);
      setIsCreateOpen(false);
      setFormData({
        name: '',
        tier: 'free',
        scopes: ['films:read', 'people:read', 'credits:read'],
        rate_limit_per_min: 60,
      });
      fetchKeys();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleStatus = async (key) => {
    const nextStatus = !key.is_active;
    const confirmMsg = nextStatus
      ? `Reactivate API key for "${key.name}"?`
      : `Revoke API key for "${key.name}"? All requests using this key will be blocked.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/data?_r=api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key.id, is_active: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update key status');
      }
      fetchKeys();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteKey = async (key) => {
    if (!window.confirm(`Permanently delete key for "${key.name}"? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/data?_r=api-keys&id=${key.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete key');
      }
      fetchKeys();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Icon icon="solar:key-minimalistic-square-bold" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Developer API & Partner Access</h1>
              <p className="text-sm text-text-muted mt-0.5">
                Issue, configure, and manage scoped API keys for external developers, streamers, and research partners.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/developers"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border border-border text-white font-medium text-sm transition active:scale-95 shadow-sm"
          >
            <Icon icon="solar:document-text-linear" className="w-4 h-4 text-amber-400" />
            <span>Developer Portal ↗</span>
          </Link>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
            <span>Generate New Key</span>
          </button>
        </div>
      </div>

      {/* Migration Notice if table not created */}
      {needsMigration && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-amber-400">
            <Icon icon="solar:danger-triangle-bold" className="w-5 h-5" />
            <span>Database Setup Required</span>
          </div>
          <p className="text-sm leading-relaxed text-amber-300/90">
            The <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200">public.api_keys</code> table has not been initialized in Supabase yet.
            Please run the migration script <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200">supabase/migrations/20260920_api_keys.sql</code> in your Supabase SQL Editor to enable API key storage.
          </p>
        </div>
      )}

      {/* One-Time Generated Key Modal */}
      {newKeyResult && (
        <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-white space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-lg">
              <Icon icon="solar:check-circle-bold" className="w-6 h-6" />
              <span>API Key Generated Successfully</span>
            </div>
            <button
              onClick={() => setNewKeyResult(null)}
              className="text-text-muted hover:text-white transition p-1"
            >
              <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
            <Icon icon="solar:shield-warning-bold" className="w-4 h-4 shrink-0" />
            <span>
              <strong>Important:</strong> Copy this secret now. For security purposes, MuviDB never stores the plain key and it will never be displayed again.
            </span>
          </div>

          <div className="flex items-center gap-2 bg-black/60 border border-border p-2.5 rounded-xl font-mono text-sm">
            <span className="flex-1 select-all text-emerald-300 break-all px-2">{newKeyResult}</span>
            <button
              onClick={() => copyToClipboard(newKeyResult)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition flex items-center gap-1.5 shrink-0"
            >
              <Icon icon={copiedKey ? 'solar:check-read-bold' : 'solar:copy-bold'} className="w-4 h-4" />
              <span>{copiedKey ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Keys Table / List */}
      <div className="bg-surface/50 border border-border/60 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="p-4 sm:p-5 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white text-base">Active & Issued Keys</h2>
            <span className="px-2 py-0.5 rounded-full text-xs bg-surface border border-border text-text-muted font-mono">
              {keys.length}
            </span>
          </div>

          <button
            onClick={fetchKeys}
            className="p-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-border text-text-muted hover:text-white transition"
            title="Refresh list"
          >
            <Icon icon="solar:refresh-linear" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-text-muted flex flex-col items-center gap-3">
            <Icon icon="solar:spinner-line" className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-sm">Loading API keys...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 space-y-2">
            <p className="text-sm">{error}</p>
            <button onClick={fetchKeys} className="text-xs underline hover:text-white">
              Retry
            </button>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-16 text-center text-text-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface mx-auto flex items-center justify-center text-text-muted/60 border border-border">
              <Icon icon="solar:key-linear" className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-white text-sm">No API keys issued yet</p>
              <p className="text-xs text-text-muted mt-1">Generate your first partner key to start granting API access.</p>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              <span>+ Create First Key</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/40">
                <tr>
                  <th className="py-3 px-4 font-medium">Organization / Client</th>
                  <th className="py-3 px-4 font-medium">Prefix</th>
                  <th className="py-3 px-4 font-medium">Tier</th>
                  <th className="py-3 px-4 font-medium">Granted Scopes</th>
                  <th className="py-3 px-4 font-medium text-right">Usage</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 text-white/90">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>{key.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Created {new Date(key.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-text-muted">
                      <span className="bg-black/30 border border-border/50 px-2 py-1 rounded-md text-amber-200/80">
                        {key.key_prefix}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                          key.tier === 'enterprise'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : key.tier === 'pro'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {key.tier}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {(key.scopes || []).map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs">
                      <div>{Number(key.usage_count || 0).toLocaleString()} calls</div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {key.last_used_at ? `Last: ${new Date(key.last_used_at).toLocaleDateString()}` : 'Never used'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          key.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${key.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span>{key.is_active ? 'Active' : 'Revoked'}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(key)}
                          className="p-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition"
                          title="Edit Key, Tier & Permissions"
                        >
                          <Icon icon="solar:pen-bold" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(key)}
                          className={`p-1.5 rounded-lg border text-xs font-medium transition ${
                            key.is_active
                              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={key.is_active ? 'Revoke Key' : 'Reactivate Key'}
                        >
                          <Icon icon={key.is_active ? 'solar:forbidden-circle-bold' : 'solar:check-circle-bold'} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKey(key)}
                          className="p-1.5 rounded-lg border border-border/40 text-text-muted hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition"
                          title="Delete Key"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Free vs Pro vs Enterprise Tier Reference Guide */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-surface/80 via-surface/40 to-surface/80 border border-border space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
              <Icon icon="solar:shield-check-bold" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Tier Access Matrix: Free vs. Pro vs. Enterprise</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Understand and configure what each client tier receives across rate limits, scopes, and box office analytics.
              </p>
            </div>
          </div>
          <Link
            to="/developers"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 px-3 py-1.5 rounded-xl transition"
          >
            <span>View Public Developer Page</span>
            <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Free Tier */}
          <div className="p-4 rounded-xl bg-surface-2/40 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Free Tier</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                Standard
              </span>
            </div>
            <p className="text-text-muted text-[11px] leading-relaxed">
              For non-commercial indie developers, students, researchers, and hobby projects.
            </p>
            <ul className="space-y-1.5 text-text-muted pt-1">
              <li className="flex items-center gap-2 text-white/90">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Limited Catalog: <strong>Max 500 Films &amp; 500 People</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white/90">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Limited Credits: <strong>Top 10 cast/crew per film, max 500 credits</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white/90">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Rate Limit: <strong>60 req/min</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white/90">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Max page size: <strong>20 items</strong></span>
              </li>
              <li className="flex items-center gap-2 text-text-muted">
                <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5 text-red-400/80 shrink-0" />
                <span className="line-through text-text-muted/60">Box Office Intelligence</span>
              </li>
              <li className="flex items-center gap-2 text-text-muted">
                <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5 text-red-400/80 shrink-0" />
                <span>Attribution required (Non-commercial)</span>
              </li>
            </ul>
          </div>

          {/* Pro Tier */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Pro Partner</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Recommended
              </span>
            </div>
            <p className="text-blue-200/80 text-[11px] leading-relaxed">
              For streaming portals, talent agencies, media publications, production studios, and fintech apps.
            </p>
            <ul className="space-y-1.5 text-text-muted pt-1">
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span><strong>Full Unrestricted Database</strong> (All 12,000+ Films, 15,000+ People &amp; Complete Credits)</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span><strong>Box Office Intelligence</strong> (<code className="text-blue-300">boxoffice:read</code>)</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>High Rate Limit: <strong>600 req/min</strong> (10 req/s)</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Max page size: <strong>100 items</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span><strong>Full Commercial License</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Streaming URLs &amp; Deep Metadata</span>
              </li>
            </ul>
          </div>

          {/* Enterprise Tier */}
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Enterprise</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30">
                Custom
              </span>
            </div>
            <p className="text-purple-200/80 text-[11px] leading-relaxed">
              For major telecom platforms, OTT streaming services, broadcast networks, and data syndicators.
            </p>
            <ul className="space-y-1.5 text-text-muted pt-1">
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Everything in Pro</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Ultra Throughput: <strong>2,000+ req/min</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Dedicated DB Connection Pool</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>99.9% Uptime SLA Guarantee</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Custom Webhooks &amp; Data Dumps</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
          <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>How to edit or change a partner&apos;s tier:</strong> Click the <Icon icon="solar:pen-bold" className="inline w-3 h-3 text-amber-400 mx-0.5" /> (pencil icon) on any row in the table above. Selecting <em>Pro</em> automatically sets the rate limit to 600 req/min and adds the <code>boxoffice:read</code> scope.
          </div>
        </div>
      </div>

      {/* Developer API Documentation Accordion */}
      <div className="bg-surface/30 border border-border/40 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Icon icon="solar:code-square-bold" className="w-6 h-6 text-amber-500" />
          <h2 className="text-lg font-bold text-white">Partner API Quick Reference</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-black/40 border border-border/40 space-y-2">
            <span className="font-semibold text-amber-400 uppercase tracking-wider text-[11px]">Authentication Header</span>
            <p className="text-text-muted leading-relaxed">
              Include your key in every request using either the <code className="text-amber-200">x-api-key</code> header or Bearer token:
            </p>
            <pre className="bg-black/60 p-2.5 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto">
              x-api-key: muvi_live_7fa83b9c...
            </pre>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-border/40 space-y-2">
            <span className="font-semibold text-amber-400 uppercase tracking-wider text-[11px]">Example cURL</span>
            <p className="text-text-muted leading-relaxed">Fetch film metadata with pagination:</p>
            <pre className="bg-black/60 p-2.5 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto">
              curl -H "x-api-key: YOUR_KEY" \<br />
              &nbsp;&nbsp;https://muvidb.com/api/v1/films?limit=10
            </pre>
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-border/30 rounded-xl overflow-hidden">
            <thead className="bg-surface text-text-muted">
              <tr>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Endpoint</th>
                <th className="py-2.5 px-3">Required Scope</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 text-white/80">
              <tr>
                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GET</td>
                <td className="py-2.5 px-3 font-mono">/api/v1/films</td>
                <td className="py-2.5 px-3 font-mono text-amber-300">films:read</td>
                <td className="py-2.5 px-3">List, filter, and search published films</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GET</td>
                <td className="py-2.5 px-3 font-mono">/api/v1/films/:id</td>
                <td className="py-2.5 px-3 font-mono text-amber-300">films:read</td>
                <td className="py-2.5 px-3">Full film details, synopsis, genres, and watch links</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GET</td>
                <td className="py-2.5 px-3 font-mono">/api/v1/films/:id/credits</td>
                <td className="py-2.5 px-3 font-mono text-amber-300">credits:read</td>
                <td className="py-2.5 px-3">Complete cast and crew breakdown</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GET</td>
                <td className="py-2.5 px-3 font-mono">/api/v1/people</td>
                <td className="py-2.5 px-3 font-mono text-amber-300">people:read</td>
                <td className="py-2.5 px-3">Search actors and crew with department tags</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GET</td>
                <td className="py-2.5 px-3 font-mono">/api/v1/people/:id</td>
                <td className="py-2.5 px-3 font-mono text-amber-300">people:read</td>
                <td className="py-2.5 px-3">Talent bio, aliases, and full filmography</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GET</td>
                <td className="py-2.5 px-3 font-mono">/api/v1/boxoffice</td>
                <td className="py-2.5 px-3 font-mono text-amber-300">boxoffice:read</td>
                <td className="py-2.5 px-3">Weekend grosses and actor box office rankings</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Key Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:key-minimalistic-square-bold" className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-white text-lg">Generate Developer API Key</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-text-muted hover:text-white transition p-1"
              >
                <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Organization / Client Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Showmax, NollyWire, Film School Research"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Tier & Rate Limit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Plan Tier</label>
                  <select
                    value={formData.tier}
                    onChange={(e) => applyTierPresets(e.target.value, false)}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  >
                    <option value="free">Free (Standard - 60/min)</option>
                    <option value="pro">Pro Partner (600/min + Box Office)</option>
                    <option value="enterprise">Enterprise (2000/min)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Rate Limit (/min)</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formData.rate_limit_per_min}
                    onChange={(e) => setFormData({ ...formData, rate_limit_per_min: e.target.value })}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              {/* Scopes Checkboxes */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Permission Scopes <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = formData.scopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        onClick={() => handleToggleScope(scope.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-surface/40 border-border hover:bg-surface'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-surface border-border"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{scope.label}</span>
                            <code className="text-[10px] text-amber-400 font-mono px-1.5 py-0.5 rounded bg-black/40">
                              {scope.id}
                            </code>
                          </div>
                          <p className="text-xs text-text-muted leading-relaxed">{scope.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-surface text-text-muted hover:text-white text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {createLoading && <Icon icon="solar:spinner-line" className="w-4 h-4 animate-spin" />}
                  <span>Generate Key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Key & Tier Permissions Modal */}
      {editingKey && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Icon icon="solar:pen-bold" className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Edit API Key Access &amp; Tier</h3>
                  <p className="text-xs text-text-muted font-mono">{editingKey.key_prefix}</p>
                </div>
              </div>
              <button
                onClick={() => { setEditingKey(null); setEditFormData(null); }}
                className="text-text-muted hover:text-white transition p-1"
              >
                <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Organization / Client Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Plan Tier Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Plan Tier &amp; Preset
                  </label>
                  <span className="text-[11px] text-text-muted">Click to apply tier defaults</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'free', label: 'Free Tier', rate: '60 req/min', desc: 'Standard' },
                    { id: 'pro', label: 'Pro Partner', rate: '600 req/min', desc: '+ Box Office' },
                    { id: 'enterprise', label: 'Enterprise', rate: '2,000 req/min', desc: 'Custom SLA' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTierPresets(t.id, true)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        editFormData.tier === t.id
                          ? t.id === 'pro'
                            ? 'bg-blue-500/15 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/10'
                            : t.id === 'enterprise'
                            ? 'bg-purple-500/15 border-purple-500 text-white font-bold shadow-lg shadow-purple-500/10'
                            : 'bg-amber-500/15 border-amber-500 text-white font-bold'
                          : 'bg-surface/50 border-border text-text-muted hover:text-white hover:bg-surface'
                      }`}
                    >
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] opacity-80 font-mono mt-0.5">{t.rate}</div>
                      <div className="text-[9px] text-text-muted mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate Limit */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Rate Limit (/min)
                  </label>
                  <span className="text-[11px] text-text-muted">Max queries allowed per minute</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={editFormData.rate_limit_per_min}
                  onChange={(e) => setEditFormData({ ...editFormData, rate_limit_per_min: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border">
                <div>
                  <div className="text-xs font-bold text-white">Key Activation Status</div>
                  <div className="text-[11px] text-text-muted">Revoking blocks all incoming calls with this key immediately.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, is_active: !editFormData.is_active })}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    editFormData.is_active
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {editFormData.is_active ? 'Active' : 'Revoked'}
                </button>
              </div>

              {/* Scopes */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Permission Scopes <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = editFormData.scopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        onClick={() => handleToggleEditScope(scope.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-surface/40 border-border hover:bg-surface'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-surface border-border"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{scope.label}</span>
                            <code className="text-[10px] text-amber-400 font-mono px-1.5 py-0.5 rounded bg-black/40">
                              {scope.id}
                            </code>
                          </div>
                          <p className="text-xs text-text-muted leading-relaxed">{scope.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => { setEditingKey(null); setEditFormData(null); }}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-surface text-text-muted hover:text-white text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {editLoading && <Icon icon="solar:spinner-line" className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
