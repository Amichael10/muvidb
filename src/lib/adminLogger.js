import { supabase } from './supabase';

/**
 * Logs an administrative action to public.admin_actions
 * @param {Object} user - The current logged-in user object from AuthContext
 * @param {string} actionType - 'create' | 'update' | 'delete'
 * @param {string} entityType - 'film' | 'person' | 'credit' | 'company'
 * @param {string|number} entityId - The ID of the affected resource
 * @param {string} entityName - The name/title of the affected resource
 * @param {Object} [details] - Optional extra metadata/JSON info
 */
export async function logAdminAction(user, actionType, entityType, entityId, entityName, details = {}) {
  if (!user || !user.id) {
    console.warn('Cannot log admin action: No user provided');
    return;
  }

  // Only log for admins and limited admins
  if (user.role !== 'admin' && user.role !== 'admin_limited') {
    return;
  }

  try {
    const { error } = await supabase
      .from('admin_actions')
      .insert({
        user_id: user.id,
        action_type: actionType,
        entity_type: entityType,
        entity_id: String(entityId),
        entity_name: entityName,
        details: details
      });

    if (error) {
      console.error('Failed to insert admin action log:', error);
    }
  } catch (err) {
    console.error('Exception logging admin action:', err);
  }
}
