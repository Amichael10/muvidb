import React from 'react';
import { Icon } from '@iconify/react';
import WhatsAppHealth from '../../components/admin/WhatsAppHealth';
import SEO from '../../components/SEO';

export default function AdminWhatsApp() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <SEO title="WhatsApp Alerts & Delivery Health | Admin" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Icon icon="ri:whatsapp-fill" className="text-sm" />
              Messaging Queue & Deliveries
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight font-heading">
            WhatsApp Movie Release Alerts
          </h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            Monitor real-time delivery status, queued notifications, subscriber broadcasts, and delivery retries for verified Nollywood cinema and streaming releases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/cron/sync?task=whatsapp_alerts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-primary text-xs font-bold transition-all"
          >
            <Icon icon="solar:play-circle-bold" className="text-emerald-400 text-sm" />
            <span>Trigger Worker Check</span>
          </a>
        </div>
      </div>

      {/* WhatsApp Health & Queued Deliveries Section */}
      <div className="space-y-6">
        <WhatsAppHealth />
      </div>
    </div>
  );
}
