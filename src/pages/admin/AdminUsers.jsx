import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
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
      console.log('--- ADMIN DEBUG: Fetching Users ---');
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          people:linked_profile_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase Error:', error);
        toast.error(`Load failed: ${error.message}`);
        throw error;
      }
      
      console.log('Raw Data Received:', data);
      setUsers(data || []);
    } catch (error) {
      console.error('Fetch Exception:', error);
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

      if (error) {
        console.error('Error updating role:', error);
        toast.error(`Update failed: ${error.message}`);
        throw error;
      }

      toast.success(`Role updated to ${newRole}`);
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error('Error updating role:', error);
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
    <div className="space-y-8 p-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Access Control</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">User Management</h1>
          <p className="text-text-muted text-sm mt-1 font-medium">Manage platform access and security for <span className="text-text-primary">{users.length}</span> active users.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total users', count: users.length, icon: 'solar:users-group-rounded-linear', color: 'from-brand/10 to-transparent' },
          { label: 'Standard users', count: users.filter(u => u.role === 'user').length, icon: 'solar:user-linear', color: 'from-blue-500/10 to-transparent' },
          { label: 'Professionals', count: users.filter(u => u.role === 'professional').length, icon: 'solar:star-linear', color: 'from-orange-500/10 to-transparent' },
          { label: 'Administrators', count: users.filter(u => u.role === 'admin').length, icon: 'solar:shield-user-linear', color: 'from-brand/10 to-transparent' },
        ].map((stat, i) => (
          <div key={i} className="card-cal p-6 group transition-all hover:border-brand/30">
            <div className="flex items-center justify-between mb-4">
              <Icon icon={stat.icon} className="text-2xl text-text-muted group-hover:text-brand transition-colors" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {isLoading ? <div className="h-8 w-16 bg-surface-2 rounded-lg animate-pulse" /> : stat.count}
            </div>
            <p className="text-[10px] font-bold text-text-muted mt-1.5 opacity-60 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card-cal p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-2 relative">
            <label className="block text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2">Search records</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, or identifier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 pl-10 text-text-primary text-sm focus:border-brand focus:outline-none transition-all"
              />
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
          </div>
          
          <div>
            <label className="block text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2">Security role</label>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-text-primary text-sm focus:border-brand focus:outline-none appearance-none cursor-pointer pr-10"
              >
                <option value="All">All roles</option>
                <option value="user">User</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </select>
              <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
            </div>
          </div>
        </div>
      </div>

      <div className="card-cal overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-surface-2/30 border-b border-border text-text-muted text-[10px] font-bold uppercase tracking-wider">
                <th className="px-6 py-5 w-24 text-center">ID</th>
                <th className="px-6 py-5">Profile</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Last Active</th>
                <th className="px-6 py-5">Registered</th>
                <th className="px-6 py-5">Linked record</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} columns={7} />)
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-text-muted italic font-medium">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => (
                  <tr 
                    key={u.id} 
                    className="group transition-all duration-200 hover:bg-surface-2/40"
                  >
                    <td className="px-6 py-6 text-center align-middle font-mono text-[10px] text-text-muted opacity-50">
                      {u.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border group-hover:border-brand transition-all" />
                          ) : (
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs border border-border ${getAvatarColor(u.role)}`}>
                              {getInitials(u.name || u.email)}
                            </div>
                          )}
                          {u.is_verified && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-brand rounded-full border-2 border-surface flex items-center justify-center">
                              <Icon icon="solar:check-read-bold" className="text-[10px] text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-text-primary text-sm truncate group-hover:text-brand transition-colors">{u.name || 'Anonymous User'}</div>
                          <div className="text-[11px] text-text-muted font-medium truncate mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                        {u.is_banned && (
                          <span className="bg-red-500/10 text-red-500 text-[8px] font-bold uppercase px-2 py-0.5 rounded border border-red-500/20">Banned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-left">
                        {u.last_sign_in_at ? (
                          <>
                            <p className="text-text-primary font-bold text-xs tracking-tight">
                              {new Date(u.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-text-muted font-bold opacity-60 mt-0.5 uppercase tracking-wider">
                              {new Date(u.last_sign_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </>
                        ) : (
                          <p className="text-text-muted italic text-[10px] font-bold opacity-40 uppercase tracking-wider">Never logged in</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-left">
                        <p className="text-text-primary font-bold text-xs tracking-tight">
                          {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-text-muted font-bold opacity-60 mt-0.5 uppercase tracking-wider">Account created</p>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      {u.linked_profile_id ? (
                        <Link 
                          to={`/people/${u.linked_profile_id}`} 
                          className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-md text-brand text-[10px] font-bold hover:border-brand/40 transition-all shadow-sm w-fit"
                          target="_blank"
                        >
                          <Icon icon="solar:user-linear" className="text-xs" />
                          {u.people?.name || 'Linked Profile'}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-1.5 opacity-30">
                          <div className="w-1 h-1 rounded-full bg-text-muted" />
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Standalone</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3" title={u.id === currentUser?.id ? "You cannot alter your own access." : ""}>
                        <div className="relative">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChangeSelect(u, e.target.value)}
                            disabled={u.id === currentUser?.id || isProcessing}
                            className="bg-surface-2 border border-border text-text-primary rounded-md pl-3 pr-8 py-2 text-[10px] font-bold uppercase focus:border-brand focus:outline-none appearance-none disabled:opacity-50 cursor-pointer hover:border-brand/50 transition-all"
                          >
                            <option value="user">User</option>
                            <option value="professional">Pro</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Icon icon="solar:alt-arrow-down-linear" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setBanData({ user: u, isBanning: !u.is_banned })}
                            disabled={u.id === currentUser?.id || isProcessing}
                            className={`p-2 rounded-md border transition-all ${
                              u.is_banned 
                                ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white' 
                                : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'
                            }`}
                            title={u.is_banned ? "Unban User" : "Ban User"}
                          >
                            <Icon icon={u.is_banned ? "solar:user-plus-linear" : "solar:user-block-linear"} className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteData({ user: u })}
                            disabled={u.id === currentUser?.id || isProcessing}
                            className="p-2 bg-surface-2 text-text-muted border border-border rounded-md hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                            title="Delete User"
                          >
                            <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
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
