import { supabase } from './supabase.js';

export async function recordWhatsAppDeliveryStatuses(body: any) {
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      for (const status of change?.value?.statuses || []) {
        if (!status.id || !['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
        const errors = (status.errors || []).map((error: any) =>
          `${error.code}: ${error.error_data?.details || error.message || error.title || 'Delivery failed'}`
        ).join('; ');
        // Delivery confirmations outrank out-of-order sent events.
        const previous = status.status === 'sent' ? ['sent']
          : status.status === 'delivered' ? ['sent', 'delivered']
          : status.status === 'failed' ? ['sent', 'failed'] : ['sent', 'delivered', 'read'];
        const { error } = await supabase.from('whatsapp_movie_alert_log').update({
          status: status.status,
          error_message: status.status === 'failed' ? errors || 'Meta reported failed delivery' : null,
        }).eq('message_id', status.id).in('status', previous);
        if (error) throw new Error(`Cannot save WhatsApp delivery status: ${error.message}`);
        if (status.status === 'failed') console.error('[WhatsApp delivery failed]', status.id, errors);
      }
    }
  }
}
