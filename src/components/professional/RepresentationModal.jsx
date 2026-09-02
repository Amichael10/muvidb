import { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const NIGERIAN_GUILDS = [
  { id: 'agn', label: 'Actors Guild of Nigeria (AGN)' },
  { id: 'dgn', label: 'Directors Guild of Nigeria (DGN)' },
  { id: 'tampan', label: 'Theatre Arts & Motion Pictures Practitioners Association (TAMPAN)' },
  { id: 'ancop', label: 'Association of Nollywood Core Producers (ANCOP)' },
  { id: 'cdgn', label: 'Creative Designers Guild of Nigeria (CDGN)' },
  { id: 'sag_aftra', label: 'SAG-AFTRA (International)' }
];

export default function RepresentationModal({ person, onClose, onSaved }) {
  const currentStats = person.youtube_stats || {};
  const repData = currentStats.representation || {};

  const [agencyName, setAgencyName] = useState(repData.agency || '');
  const [agentName, setAgentName] = useState(repData.agent_name || '');
  const [agentEmail, setAgentEmail] = useState(repData.agent_email || '');
  const [agentPhone, setAgentPhone] = useState(repData.agent_phone || '');
  const [managerName, setManagerName] = useState(repData.manager_name || '');
  const [managerEmail, setManagerEmail] = useState(repData.manager_email || '');
  const [publicist, setPublicist] = useState(repData.publicist || '');
  const [selectedGuilds, setSelectedGuilds] = useState(repData.guilds || ['agn']);
  const [territory, setTerritory] = useState(repData.territory || 'Pan-African & International');
  const [saving, setSaving] = useState(false);

  const toggleGuild = (guildId) => {
    if (selectedGuilds.includes(guildId)) {
      setSelectedGuilds(selectedGuilds.filter(g => g !== guildId));
    } else {
      setSelectedGuilds([...selectedGuilds, guildId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedRep = {
        agency: agencyName.trim() || null,
        agent_name: agentName.trim() || null,
        agent_email: agentEmail.trim() || null,
        agent_phone: agentPhone.trim() || null,
        manager_name: managerName.trim() || null,
        manager_email: managerEmail.trim() || null,
        publicist: publicist.trim() || null,
        guilds: selectedGuilds,
        territory,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('people')
        .update({
          youtube_stats: {
            ...currentStats,
            representation: updatedRep
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', person.id);

      if (error) throw error;

      toast.success('Representation & Guild credentials updated successfully!');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Representation update failed:', err);
      toast.error(err.message || 'Failed to save representation details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl md:p-8">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 grid h-9 w-9 place-items-center rounded-full bg-white/[.05] text-text-muted hover:bg-white/10 hover:text-white"
        >
          <Icon icon="solar:close-circle-linear" width="22" />
        </button>

        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <Icon icon="solar:users-group-two-rounded-bold" width="22" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">Industry Credentials</p>
            <h2 className="text-xl font-black text-text-primary">Representation & Guild Memberships</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Agency & Agent */}
          <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-brand">Talent Agency & Agent</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-text-muted">Agency Name</label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="e.g. Temple Management Company / Raw Talent"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted">Primary Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Femi Adeyemi"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted">Agent Email (For Casting Direct Inquiries)</label>
                <input
                  type="email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder="agent@agency.com"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted">Agent Phone / WhatsApp</label>
                <input
                  type="text"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          {/* Manager & Publicist */}
          <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-brand">Management & Press</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-text-muted">Personal Manager</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Manager Name"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted">Manager Email</label>
                <input
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder="manager@talent.com"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-text-muted">Publicist / PR Agency (For Media & Press)</label>
                <input
                  type="text"
                  value={publicist}
                  onChange={(e) => setPublicist(e.target.value)}
                  placeholder="e.g. Media Room Hub / PR Contact"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          {/* Guild Affiliations */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Official Guild & Union Affiliations
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {NIGERIAN_GUILDS.map((guild) => (
                <button
                  key={guild.id}
                  type="button"
                  onClick={() => toggleGuild(guild.id)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    selectedGuilds.includes(guild.id)
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-white/10 bg-white/[.02] text-text-muted hover:border-white/20'
                  }`}
                >
                  <span className={`grid h-4 w-4 place-items-center rounded border ${
                    selectedGuilds.includes(guild.id) ? 'border-brand bg-brand text-white' : 'border-white/20'
                  }`}>
                    {selectedGuilds.includes(guild.id) && <Icon icon="solar:check-bold" width="10" />}
                  </span>
                  <span className="text-xs font-bold">{guild.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-xs font-black text-text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-brand/20 hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin" width="18" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" width="18" />
                  Save Credentials
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
