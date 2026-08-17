import { Icon } from '@iconify/react';

export default function CareerPassportWelcome({ firstName, onCreate, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[290] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Welcome to your professional dashboard">
      <section className="relative w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-[#202020] to-[#111] p-7 text-center shadow-2xl md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
        <button onClick={onDismiss} aria-label="Close welcome message" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/10 text-text-muted hover:border-brand hover:text-brand"><Icon icon="solar:close-circle-linear" width="20" /></button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white shadow-xl shadow-brand/20"><Icon icon="solar:passport-bold" width="34" /></span>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[.28em] text-brand">Your professional workspace is ready</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-white md:text-4xl">Welcome to MuviDB Pro{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-text-muted">Manage your verified filmography, complete your public profile and share your career in a polished, social-ready format.</p>
        <div className="mt-7 grid grid-cols-3 gap-2 text-left"><div className="rounded-xl bg-white/[.04] p-3"><Icon icon="solar:verified-check-linear" className="text-brand" /><p className="mt-2 text-[10px] font-bold text-white">Verified credits</p></div><div className="rounded-xl bg-white/[.04] p-3"><Icon icon="solar:chart-2-linear" className="text-brand" /><p className="mt-2 text-[10px] font-bold text-white">Career analytics</p></div><div className="rounded-xl bg-white/[.04] p-3"><Icon icon="solar:share-linear" className="text-brand" /><p className="mt-2 text-[10px] font-bold text-white">Career Passport</p></div></div>
        <button onClick={onCreate} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-xs font-black text-white shadow-xl shadow-brand/20"><Icon icon="solar:magic-stick-3-bold" width="19" />Create and share my Career Passport</button>
        <button onClick={onDismiss} className="mt-3 px-4 py-2 text-xs font-bold text-text-muted hover:text-white">Explore my dashboard first</button>
      </section>
    </div>
  );
}
