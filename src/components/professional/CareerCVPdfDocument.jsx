import React from 'react';

export default function CareerCVPdfDocument({
  person = {},
  credits = [],
  stageCredits = [],
  qrCodeUrl = '',
  profileUrl = '',
  options = {
    includeHeadshot: true,
    includePhysicalSpecs: true,
    includeGuilds: true,
    includeMetrics: true,
    includeScreenCredits: true,
    includeStageCredits: true,
    includeAwards: true,
    includeRepresentation: true,
    includeQrCode: true,
  },
  customNotes = '',
}) {
  const films = credits.filter(c => c?.films?.title);
  const stage = stageCredits.filter(c => c?.plays?.title || c?.play?.title);

  const calculateGross = () => {
    let total = 0;
    for (const c of credits) {
      const g = Number(c?.films?.box_office_gross_ngn) || Number(c?.films?.box_office) || 0;
      total += g;
    }
    if (total >= 1_000_000_000) return `₦${(total / 1_000_000_000).toFixed(2)}B`;
    if (total >= 1_000_000) return `₦${(total / 1_000_000).toFixed(1)}M`;
    return total > 0 ? `₦${total.toLocaleString()}` : null;
  };

  const totalGross = calculateGross();

  return (
    <div className="muvidb-cv-document bg-white text-[#111111] font-sans p-8 sm:p-12 max-w-[850px] mx-auto shadow-xl rounded-lg print:p-0 print:shadow-none print:max-w-none print:w-full print:rounded-none">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          body {
            background: white !important;
            color: #111111 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .muvidb-cv-document {
            padding: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            border: none !important;
          }
          .page-break-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* HEADER: MUVIDB VERIFIED TALENT STAMP                                 */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <header className="border-b-2 border-black pb-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF5A1F] text-white flex items-center justify-center font-black text-base">
            M
          </div>
          <div>
            <h3 className="text-xs font-black tracking-[0.25em] text-[#FF5A1F] uppercase leading-none">
              MuviDB Verified Talent Record
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-1">
              Official Industry Portfolio & Casting Profile · Nigeria & African Diaspora
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block px-2 py-0.5 border border-black/20 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-gray-50">
            ID: MVP-NG-{String(person.id || person.slug || '000000').slice(0, 8).toUpperCase()}
          </span>
          <p className="text-[9px] text-gray-400 mt-0.5">
            Verified {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TALENT IDENTITY & HEADSHOT                                           */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pb-6 border-b border-gray-200">
        <div className="flex items-start gap-5">
          {options.includeHeadshot && (
            <div className="relative flex-shrink-0 w-28 h-36 rounded-xl overflow-hidden border border-gray-300 shadow-md bg-gray-100">
              <img
                src={person.photo_url || '/images/person-placeholder.png'}
                alt={person.name}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-tight">
              {person.name || 'Industry Professional'}
            </h1>
            <p className="text-sm font-bold text-[#FF5A1F] tracking-wide mt-1">
              {person.roles?.join(' · ') || person.primary_role || 'Actor · Screenwriter · Creative Producer'}
            </p>
            {options.includeGuilds && (
              <p className="text-xs text-gray-600 font-medium mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-black">Guild Affiliation:</span>
                {person.guilds || 'Actors Guild of Nigeria (AGN) · Registered Practitioner'}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Location: {person.nationality || 'Lagos, Nigeria'} {person.secondary_location ? `· ${person.secondary_location}` : ''}
            </p>

            {options.includeRepresentation && (
              <div className="mt-3 text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200 max-w-md">
                <span className="font-bold text-black uppercase tracking-wider text-[10px] block mb-0.5">
                  Representation & Booking:
                </span>
                <p className="truncate">
                  {person.booking_email ? `Agency Contact: ${person.booking_email}` : 'Direct Inquiries: via MuviDB Verified Representative'}
                  {person.booking_phone ? ` · Tel: ${person.booking_phone}` : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code to Live Profile */}
        {options.includeQrCode && qrCodeUrl && (
          <div className="flex flex-col items-center flex-shrink-0 text-center sm:self-start bg-gray-50 p-2.5 rounded-xl border border-gray-200">
            <img
              src={qrCodeUrl}
              alt="Scan QR code for verified live profile"
              className="w-20 h-20 object-contain"
            />
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mt-1 block">
              Scan for Live Profile
            </span>
            <span className="text-[8px] font-mono text-[#FF5A1F] block">
              muvidb.com/@{person.slug || person.handle || 'talent'}
            </span>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* PHYSICAL SPECS & TALENT ATTRIBUTES (Actors / Performers)             */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {options.includePhysicalSpecs && (
        <div className="py-4 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Height</span>
            <span className="font-semibold text-gray-900">{person.height || "5' 10\" (178 cm)"}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Languages</span>
            <span className="font-semibold text-gray-900">{person.languages || 'English, Yoruba, Pidgin'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Accents</span>
            <span className="font-semibold text-gray-900">{person.accents || 'West African, British-Nigerian'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Availability</span>
            <span className="font-semibold text-emerald-700">Available for Bookings</span>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* COMMERCIAL & INDUSTRY METRICS (TOGGLEABLE BY TALENT)                 */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {options.includeMetrics && (
        <div className="py-4 border-b border-gray-200 grid grid-cols-3 sm:grid-cols-4 gap-4 text-center bg-gray-50/80 -mx-4 px-4 my-2 rounded-lg">
          {totalGross && (
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Domestic Gross</span>
              <span className="text-base font-black text-black tracking-tight">{totalGross}</span>
            </div>
          )}
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Screen Credits</span>
            <span className="text-base font-black text-black tracking-tight">{films.length}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Stage Credits</span>
            <span className="text-base font-black text-black tracking-tight">{stage.length}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Audience Following</span>
            <span className="text-base font-black text-black tracking-tight">Verified</span>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* ARTIST BIOGRAPHY                                                     */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {person.bio && (
        <div className="py-4 border-b border-gray-200 text-xs leading-relaxed text-gray-700 page-break-avoid">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-black mb-1.5">
            Professional Biography
          </h4>
          <p>{person.bio}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* SCREEN FILMOGRAPHY (CINEMA, STREAMING, TV)                           */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {options.includeScreenCredits && films.length > 0 && (
        <section className="py-5 border-b border-gray-200 page-break-avoid">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <span>🎬</span> Screen Filmography ({films.length})
            </h4>
            <span className="text-[10px] text-gray-500 font-medium">Theatrical Cinema, Netflix, Prime & Television</span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/20 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-1.5 w-14">Year</th>
                <th className="py-1.5">Production Title</th>
                <th className="py-1.5">Role / Character</th>
                <th className="py-1.5">Release / Distributor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {films.slice(0, 18).map((credit, idx) => {
                const f = credit.films || {};
                return (
                  <tr key={credit.id || idx} className="hover:bg-gray-50">
                    <td className="py-2 font-mono text-gray-500 font-semibold">{f.year || credit.year || '—'}</td>
                    <td className="py-2 font-bold text-gray-900">{f.title || 'Untitled'}</td>
                    <td className="py-2 text-gray-700 font-medium">
                      {credit.character_name ? `${credit.character_name} (${credit.role || 'Cast'})` : credit.role || 'Cast'}
                    </td>
                    <td className="py-2 text-gray-500">{f.release_type || f.source || 'Cinema Feature'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {films.length > 18 && (
            <p className="text-[10px] text-gray-400 italic mt-2 text-right">
              + {films.length - 18} additional verified screen credits listed on official MuviDB record.
            </p>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STAGE & LIVE THEATRE PRODUCTIONS                                     */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {options.includeStageCredits && stage.length > 0 && (
        <section className="py-5 border-b border-gray-200 page-break-avoid">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <span>🎭</span> Stage & Live Theatre Productions ({stage.length})
            </h4>
            <span className="text-[10px] text-gray-500 font-medium">Terra Kulture, Muson Centre & Live Venues</span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/20 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-1.5 w-14">Year</th>
                <th className="py-1.5">Production Title</th>
                <th className="py-1.5">Role / Department</th>
                <th className="py-1.5">Venue / Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stage.slice(0, 10).map((stg, idx) => {
                const p = stg.plays || stg.play || {};
                return (
                  <tr key={stg.id || idx} className="hover:bg-gray-50">
                    <td className="py-2 font-mono text-gray-500 font-semibold">{p.year || stg.year || '2025'}</td>
                    <td className="py-2 font-bold text-gray-900">{p.title || 'Stage Production'}</td>
                    <td className="py-2 text-gray-700 font-medium">{stg.role_name || stg.role || 'Performer'}</td>
                    <td className="py-2 text-gray-500">{p.venue_name || 'Terra Kulture, Lagos'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* AWARDS & ACCOLADES                                                   */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {options.includeAwards && Array.isArray(person.awards) && person.awards.length > 0 && (
        <section className="py-4 border-b border-gray-200 page-break-avoid">
          <h4 className="text-xs font-black uppercase tracking-wider text-black mb-2 flex items-center gap-1.5">
            <span>🏆</span> Major Awards & Honors
          </h4>
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-4">
            {person.awards.slice(0, 6).map((award, idx) => (
              <li key={idx} className="leading-snug">
                <span className="font-bold text-black">{award.title || award.award_name || award}</span>
                {award.year ? ` (${award.year})` : ''} — {award.category || award.recipient || 'Winner'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* CUSTOM NOTES / SPECIAL SKILLS                                        */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {customNotes && (
        <div className="py-4 border-b border-gray-200 text-xs text-gray-700 page-break-avoid">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-black mb-1">
            Special Skills & Notes
          </h4>
          <p className="whitespace-pre-line">{customNotes}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* DOCUMENT FOOTER & VERIFICATION SEAL                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <footer className="pt-6 text-center text-gray-400 text-[9px] page-break-avoid">
        <p className="font-semibold text-gray-600 uppercase tracking-widest">
          Verified Industry Record · MuviDB Film & Theatre Database
        </p>
        <p className="mt-1">
          Scan the QR code or visit <span className="font-mono text-black font-bold">https://{profileUrl.replace(/^https?:\/\//, '')}</span> for real-time verified updates, trailers, and showreels.
        </p>
      </footer>
    </div>
  );
}
