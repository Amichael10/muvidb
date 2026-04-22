import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [roleChangeData, setRoleChangeData] = useState(null);
  const [banData, setBanData] = useState(null);
  const [deleteData, setDeleteData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          people!fk_users_linked_profile(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChangeSelect = (targetUser, newRole) => {
    if (targetUser.role === newRole) return;
    setRoleChangeData({ user: targetUser, newRole });
  };

  const confirmRoleChange = async () => {
    if (!roleChangeData) return;
    const { user, newRole } = roleChangeData;
    setIsProcessing(true);
    
    try {
      const { error } = await supabase.rpc('admin_change_role', { 
        target_user_id: user.id, 
        new_role: newRole 
      });

      if (error) throw error;

      toast.success(`Role updated to ${newRole}`);
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setIsProcessing(false);
      setRoleChangeData(null);
    }
  };

  const confirmBanUser = async () => {
    if (!banData) return;
    const { user, isBanning } = banData;
    setIsProcessing(true);

    try {
      const { error } = await supabase.rpc('admin_ban_user', {
        target_user_id: user.id,
        ban_status: isBanning
      });

      if (error) throw error;

      toast.success(`User ${isBanning ? 'banned' : 'unbanned'} successfully`);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_banned: isBanning } : u));
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to update ban status');
    } finally {
      setIsProcessing(false);
      setBanData(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteData) return;
    const { user } = deleteData;
    setIsProcessing(true);

    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        target_user_id: user.id
      });

      if (error) throw error;

      toast.success('User deleted permanently');
      setUsers(users.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsProcessing(false);
      setDeleteData(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (u.name && u.name.toLowerCase().includes(searchLower)) || 
      (u.email && u.email.toLowerCase().includes(searchLower));
    
    const matchesRole = roleFilter === 'All' || u.role.toLowerCase() === roleFilter.toLowerCase();
    
    return matchesSearch && matchesRole;
  });

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (role) => {
    switch(role) {
      case 'admin': return 'bg-brand text-white';
      case 'professional': return 'bg-orange-500/20 text-brand';
      default: return 'bg-surface-2 text-text-primary';
    }
  };

  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin': return 'bg-brand text-white';
      case 'professional': return 'bg-orange-500/10 text-brand border-brand/20';
      default: return 'bg-surface-2 text-text-muted border-border/50';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-10">
        <div>
          <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-1 italic">Access Control</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">User Management</h1>
          <p className="text-text-muted text-sm mt-1 font-medium">Lumi Ecosystem Accounts • <span className="text-text-primary">{users.length}</span> active souls</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Base', count: users.length, icon: '👥', color: 'from-brand/10 to-transparent' },
          { label: 'Professionals', count: users.filter(u => u.role === 'professional').length, icon: '🌟', color: 'from-orange-500/10 to-transparent' },
          { label: 'Lumi Admins', count: users.filter(u => u.role === 'admin').length, icon: '🛡️', color: 'from-brand/10 to-transparent' },
          { label: 'Banned Users', count: users.filter(u => u.is_banned).length, icon: '⛔', color: 'from-red-500/10 to-transparent' }
        ].map((stat, i) => (
          <div key={i} className="relative group bg-surface border border-border p-5 rounded-md overflow-hidden transition-all duration-300 hover:border-brand/30">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-40`} />
            <div className="relative z-10">
              <span className="text-xl mb-3 block">{stat.icon}</span>
              <div className="text-2xl font-black text-text-primary tracking-tighter">{stat.count}</div>
              <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-2 relative">
            <label className="block text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Search Directory</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by full name, email, or user ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 pl-10 text-text-primary text-sm focus:border-brand focus:outline-none transition-all placeholder-[#7A8099]"
              />
              <span className="absolute left-3.5 top-3 text-text-muted">🔍</span>
            </div>
          </div>
          
          <div>
            <label className="block text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Access Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-text-primary text-sm focus:border-brand focus:outline-none appearance-none cursor-pointer pr-10"
            >
              <option value="All">ALL ROLES</option>
              <option value="Fan">FANS / GENERAL</option>
              <option value="Professional">PROFESSIONALS</option>
              <option value="Admin">SYSTEM ADMINS</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-md shadow-2xl overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-text-muted text-[10px] font-bold uppercase tracking-widest">
                <th className="pl-8 pr-2 py-6 w-12 text-center">UID</th>
                <th className="px-6 py-6 border-l border-border/30">Profile Identity</th>
                <th className="px-6 py-6 border-l border-border/30 text-center">Status / Access</th>
                <th className="px-6 py-6 border-l border-border/30">Onboarding</th>
                <th className="px-6 py-6 border-l border-border/30">Association</th>
                <th className="px-8 py-6 text-right border-l border-border/30">Command Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252D45]">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} columns={6} />)
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-text-muted italic font-medium">
                    No matching accounts found in the ecosystem.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => (
                  <tr 
                    key={u.id} 
                    className={`group transition-all duration-200 hover:bg-surface-2 ${
                      i % 2 === 0 ? 'bg-surface' : 'bg-surface-2/20'
                    }`}
                  >
                    <td className="pl-8 pr-2 py-6 text-center align-middle font-mono text-[9px] text-text-muted opacity-50">
                      {u.id.substring(0, 4)}...
                    </td>
                    <td className="px-6 py-6 border-l border-border/30">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-border group-hover:border-brand transition-colors duration-300" />
                          ) : (
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border-2 border-border ${getAvatarColor(u.role)}`}>
                              {getInitials(u.name || u.email)}
                            </div>
                          )}
                          {u.is_verified && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-brand rounded-full border-2 border-surface flex items-center justify-center">
                              <span className="text-[8px] text-white font-black">✓</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-text-primary text-sm truncate group-hover:text-brand transition-colors">{u.name || 'Anonymous User'}</div>
                          <div className="text-[10px] text-text-muted font-medium truncate mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 border-l border-border/30 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                        {u.is_banned && (
                          <span className="bg-red-500/10 text-red-500 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-red-500/20">ACCESS REVOKED</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 border-l border-border/30">
                      <div className="text-left">
                        <p className="text-text-primary font-bold text-xs tracking-tight">
                          {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mt-0.5">Joined System</p>
                      </div>
                    </td>
                    <td className="px-6 py-6 border-l border-border/30">
                      {u.linked_profile_id ? (
                        <Link 
                          to={`/people/${u.linked_profile_id}`} 
                          className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-md text-brand text-[10px] font-black uppercase tracking-tighter hover:border-brand/40 transition-all shadow-sm w-fit"
                          target="_blank"
                        >
                          👤 {u.people?.name || 'Linked Profile'}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-1.5 opacity-30">
                          <div className="w-1 h-1 rounded-full bg-[#7A8099]" />
                          <span className="text-[10px] text-text-muted font-black uppercase tracking-tighter">Standalone Account</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right border-l border-border/30">
                      <div className="flex items-center justify-end gap-3" title={u.id === currentUser?.id ? "You cannot alter your own access." : ""}>
                        <div className="relative group/select">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChangeSelect(u, e.target.value)}
                            disabled={u.id === currentUser?.id || isProcessing}
                            className="bg-surface-2 border border-border text-text-primary rounded-md pl-3 pr-8 py-2 text-[10px] font-black uppercase tracking-widest focus:border-brand focus:outline-none appearance-none disabled:opacity-50 cursor-pointer group-hover/select:border-brand/50 transition-all"
                          >
                            <option value="fan">FAN</option>
                            <option value="professional">PRO</option>
                            <option value="admin">ADMIN</option>
                          </select>
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover/select:text-brand transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setBanData({ user: u, isBanning: !u.is_banned })}
                            disabled={u.id === currentUser?.id || isProcessing}
                            className={`p-2 rounded-md border transition-all ${
                              u.is_banned 
                                ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-black' 
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-black'
                            }`}
                            title={u.is_banned ? "Restore Access" : "Revoke Access"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={u.is_banned ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} /></svg>
                          </button>
                          <button
                            onClick={() => setDeleteData({ user: u })}
                            disabled={u.id === currentUser?.id || isProcessing}
                            className="p-2 bg-red-950/20 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500 hover:text-white transition-all"
                            title="Permanent Deletion"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {roleChangeData && (
        <ConfirmModal
          title="Change Role"
          message={`Change ${roleChangeData.user.name || roleChangeData.user.email}'s role to ${roleChangeData.newRole}?`}
          confirmLabel="Change Role"
          confirmColor="bg-brand text-white hover:bg-brand/90"
          onConfirm={confirmRoleChange}
          onCancel={() => setRoleChangeData(null)}
          isProcessing={isProcessing}
        />
      )}

      {banData && (
        <ConfirmModal
          title={banData.isBanning ? "Ban User" : "Unban User"}
          message={`Are you sure you want to ${banData.isBanning ? 'ban' : 'unban'} ${banData.user.name || banData.user.email}? They will be logged out and unable to access the system.`}
          confirmLabel={banData.isBanning ? "Ban User" : "Unban User"}
          confirmColor="bg-yellow-500 text-black hover:bg-yellow-400"
          onConfirm={confirmBanUser}
          onCancel={() => setBanData(null)}
          isProcessing={isProcessing}
        />
      )}

      {deleteData && (
        <ConfirmModal
          title="Delete User permanently"
          message={`Are you sure you want to delete ${deleteData.user.name || deleteData.user.email}? This will completely remove them and all their associated data (comments, reviews) cascaded downstream.`}
          confirmLabel="Delete User"
          confirmColor="bg-red-500 text-white hover:bg-red-600"
          onConfirm={confirmDeleteUser}
          onCancel={() => setDeleteData(null)}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
