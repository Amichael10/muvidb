import json
import os
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo"

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

print("🚀 BUILDING MOVIES APPROVAL DASHBOARD...")

if not os.path.exists("movies_enrichment_candidates.json"):
    print("❌ movies_enrichment_candidates.json not found! Run python scripts/scan_movies_enrichment.py first.")
    exit(1)

with open("movies_enrichment_candidates.json", "r", encoding="utf-8") as f:
    movies = json.load(f)

json_str = json.dumps(movies)
total_count = len(movies)

html_template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MuviDB - Interactive Movie Synopsis & Genre Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; transition: all 0.2s ease; cursor: pointer; }
    .card:hover { border-color: #38bdf8; transform: translateY(-2px); }
    .badge-have { background-color: #064e3b; color: #34d399; border: 1px solid #059669; }
    .badge-missing { background-color: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; }
    .modal-backdrop { background-color: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); }
  </style>
</head>
<body class="p-8 max-w-7xl mx-auto">

  <!-- Header -->
  <header class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-700 pb-6 gap-4">
    <div>
      <div class="flex items-center gap-3">
        <span class="text-3xl">🍿</span>
        <h1 class="text-3xl font-bold text-amber-400">MuviDB Movie Synopsis Studio</h1>
      </div>
      <p class="text-slate-400 mt-2 text-sm">
        Review & edit synopses and genres for all <span class="text-amber-300 font-bold">__TOTAL_COUNT__</span> incomplete movies. Click any movie card to edit, write, or copy YouTube links.
      </p>
       <div class="flex gap-3">
      <button onclick="approveAll()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow transition flex items-center gap-2">
        <span>✓</span> Approve All (__TOTAL_COUNT__)
      </button>
      <button onclick="applyApprovedToSupabase()" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow transition flex items-center gap-2">
        <span>⚡</span> Apply Approved to Supabase
      </button>
      <button onclick="exportApprovedJSON()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow transition flex items-center gap-2">
        <span>📥</span> Export JSON
      </button>
    </div>
  </header>

  <!-- Controls Bar -->
  <div class="mb-6 flex flex-col md:flex-row justify-between items-center bg-slate-800/60 p-4 rounded-xl border border-slate-700 gap-4">
    <div class="flex items-center gap-4 w-full md:w-auto">
      <input type="text" id="search-input" onkeyup="filterCards()" placeholder="🔍 Search movie title, genre, or ID..." class="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-4 py-2 w-full md:w-80 focus:outline-none focus:border-amber-500">
      <select id="filter-status" onchange="filterCards()" class="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
        <option value="all">All Incomplete Movies</option>
        <option value="pending">Pending Only</option>
        <option value="approved">Approved Only</option>
      </select>
    </div>

    <div class="text-sm text-slate-300">
      Status: <span id="approved-count" class="font-bold text-emerald-400">0</span> approved | <span id="total-count" class="font-bold text-white">__TOTAL_COUNT__</span> movies
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="cards-grid"></div>

  <!-- Pagination Bar -->
  <div class="mt-8 flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700">
    <button onclick="prevPage()" id="btn-prev" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-semibold">◄ Previous Page</button>
    <span class="text-xs text-slate-400">Page <strong id="current-page-num" class="text-amber-400">1</strong> of <strong id="total-pages-num" class="text-white">1</strong> (<span id="showing-range">0-50</span> items)</span>
    <button onclick="nextPage()" id="btn-next" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-semibold">Next Page ►</button>
  </div>

  <!-- Closable Edit Modal -->
  <div id="edit-modal" onclick="handleBackdropClick(event)" class="fixed inset-0 modal-backdrop hidden items-center justify-center p-4 z-50 overflow-y-auto">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative" onclick="event.stopPropagation()">
      <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-sm">✕</button>

      <div class="flex items-center gap-4 border-b border-slate-800 pb-4 mb-6">
        <div id="modal-poster-preview" class="w-16 h-24 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center text-xs text-slate-500 border border-slate-700">No Poster</div>
        <div>
          <h2 id="modal-movie-title" class="text-2xl font-bold text-white">Edit Movie Details</h2>
          <span id="modal-movie-id" class="text-xs font-mono text-slate-400">ID: --</span>
        </div>
      </div>

      <div class="space-y-4 text-sm">
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Movie Title</label>
          <input type="text" id="input-title" class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-amber-500">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Genres (comma separated)</label>
            <input type="text" id="input-genres" placeholder="e.g. Drama, Nollywood Epic, Romance" class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-amber-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Age Rating</label>
            <select id="input-age-rating" class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-amber-500">
              <option value="18">18</option>
              <option value="15">15</option>
              <option value="PG-13">PG-13</option>
              <option value="PG">PG</option>
              <option value="G">G</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">YouTube Video Link</label>
          <div class="flex gap-2">
            <input type="text" id="input-yt" placeholder="https://youtube.com/watch?v=..." class="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:border-amber-500 text-xs">
            <button onclick="copyToClipboard('input-yt')" class="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs px-3 rounded border border-slate-700">📋 Copy</button>
            <button onclick="visitLink('input-yt')" class="bg-red-950/60 hover:bg-red-900 text-red-300 text-xs px-3 rounded border border-red-700">▶️ Watch YouTube</button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">MuviDB Synopsis</label>
          <textarea id="input-synopsis" rows="5" placeholder="Write or paste a MuviDB-worthy short synopsis..." class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-amber-500 leading-relaxed"></textarea>
        </div>
      </div>

      <div class="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
        <button onclick="clearSynopsisField()" class="text-rose-400 hover:text-rose-300 text-xs font-semibold">🗑️ Clear Synopsis</button>
        <div class="flex gap-3">
          <button onclick="saveModalChanges()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow">💾 Save Edits</button>
          <button onclick="approveModalCard()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow">✓ Approve Movie</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const rawCandidates = __JSON_DATA__;
    const appliedIds = new Set(JSON.parse(localStorage.getItem('applied_film_ids') || '[]'));
    let candidates = rawCandidates.filter(c => c.film_id && !appliedIds.has(c.film_id));
    const approvedSet = new Set();
    let filteredList = [...candidates];
    let currentPage = 1;
    const pageSize = 50;
    let activeEditIndex = null;

    const SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co";
    const SUPABASE_ANON_KEY = "__SERVICE_KEY__";

    async function applyApprovedToSupabase() {
      const approvedList = candidates.filter((_, idx) => approvedSet.has(idx));
      if (approvedList.length === 0) {
        alert('Please approve at least one movie first!');
        return;
      }

      if (!confirm(`Apply ${approvedList.length} approved movie synopses, genres & age ratings directly to Supabase?`)) return;

      let successCount = 0;
      for (const item of approvedList) {
        if (!item.film_id) continue;
        try {
          const payload = {};
          if (item.proposed_synopsis) payload.synopsis = item.proposed_synopsis;
          if (item.proposed_genres && item.proposed_genres.length) payload.genres = item.proposed_genres;
          if (item.proposed_age_rating) payload.nfvcb_rating = item.proposed_age_rating;

          const res = await fetch(`${SUPABASE_URL}/rest/v1/films?id=eq.${item.film_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            successCount++;
            appliedIds.add(item.film_id);
          }
        } catch (e) {
          console.error('Error applying film:', item.title, e);
        }
      }

      localStorage.setItem('applied_film_ids', JSON.stringify(Array.from(appliedIds)));
      candidates = candidates.filter(c => !appliedIds.has(c.film_id));
      approvedSet.clear();
      filterCards();

      alert(`🎉 Successfully updated ${successCount} / ${approvedList.length} movies in Supabase! Approved movies have been saved and removed from this view.`);
    }

    // Escape Key Handler to Close Modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    function handleBackdropClick(e) {
      if (e.target.id === 'edit-modal') closeModal();
    }

    function filterCards() {
      const query = document.getElementById('search-input').value.toLowerCase().trim();
      const statusFilter = document.getElementById('filter-status').value;

      filteredList = candidates.filter((item, idx) => {
        const genresStr = (item.proposed_genres || []).join(' ').toLowerCase();
        const matchesQuery = !query || 
          (item.title && item.title.toLowerCase().includes(query)) ||
          (item.film_id && item.film_id.toLowerCase().includes(query)) ||
          genresStr.includes(query);

        const isApproved = approvedSet.has(idx);
        const matchesStatus = statusFilter === 'all' || 
          (statusFilter === 'approved' && isApproved) || 
          (statusFilter === 'pending' && !isApproved);

        return matchesQuery && matchesStatus;
      });

      currentPage = 1;
      renderCards();
    }

    function renderCards() {
      const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
      document.getElementById('total-pages-num').innerText = totalPages;
      document.getElementById('current-page-num').innerText = currentPage;

      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = Math.min(startIdx + pageSize, filteredList.length);
      document.getElementById('showing-range').innerText = `${startIdx + 1}-${endIdx}`;

      const pageItems = filteredList.slice(startIdx, endIdx);

      const grid = document.getElementById('cards-grid');
      grid.innerHTML = pageItems.map((item) => {
        const origIdx = candidates.indexOf(item);
        const isApproved = approvedSet.has(origIdx);
        const genresDisplay = item.proposed_genres ? item.proposed_genres.join(', ') : 'Drama';
        const ratingDisplay = item.proposed_age_rating || '13+';

        return `
          <div class="card p-6 flex flex-col justify-between ${isApproved ? 'border-emerald-600 bg-emerald-950/20' : ''}" onclick="openEditModal(${origIdx})">
            <div>
              <div class="flex justify-between items-start mb-2">
                <div>
                  <h2 class="text-xl font-bold text-white">${item.title} (${item.year})</h2>
                  <span class="text-xs text-slate-400">ID: ${item.film_id}</span>
                </div>
                <span class="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-700 text-xs font-bold rounded-full">${item.confidence}</span>
              </div>

              <!-- Genres Tag & Age Rating -->
              <div class="mb-3 text-xs text-amber-300 font-medium flex gap-3">
                <span>🎭 <strong>Genres:</strong> <span class="bg-slate-800 text-amber-200 px-2 py-0.5 rounded border border-slate-700">${genresDisplay}</span></span>
                <span>🔞 <strong>Rating:</strong> <span class="bg-slate-800 text-emerald-300 px-2 py-0.5 rounded border border-slate-700 font-bold">${ratingDisplay}</span></span>
              </div>

              <div class="flex gap-4 mb-4">
                ${item.poster_url ? `<img src="${item.poster_url}" class="w-24 h-36 object-cover rounded-lg border border-slate-600" alt="${item.title}">` : `<div class="w-24 h-36 bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-500 border border-slate-700 text-center p-2">No Poster</div>`}
                <div class="flex-1 text-sm space-y-2">
                  <div>
                    <span class="text-xs font-bold uppercase text-slate-400">✓ Already Have:</span>
                    <div class="mt-1 flex flex-wrap gap-1">
                      ${item.already_have.length ? item.already_have.map(h => `<span class="badge-have px-2 py-0.5 rounded text-xs font-medium">${h}</span>`).join('') : `<span class="text-xs text-slate-500 italic">None</span>`}
                    </div>
                  </div>
                  <div class="pt-1">
                    <span class="text-xs font-bold uppercase text-slate-400">⚡ Discovered:</span>
                    <div class="mt-1 flex flex-wrap gap-1">
                      ${item.discovered.map(d => `<span class="badge-missing px-2 py-0.5 rounded text-xs font-medium">${d}</span>`).join('')}
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed italic">
                "${item.proposed_synopsis || 'No synopsis entered yet...'}"
              </div>
            </div>

            <div class="flex justify-between items-center mt-4 pt-3 border-t border-slate-800">
              <span class="text-xs ${isApproved ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${isApproved ? '✓ APPROVED' : '⌛ Pending Review'}</span>
              <button onclick="event.stopPropagation(); approve(${origIdx})" class="px-3 py-1.5 ${isApproved ? 'bg-slate-700 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} rounded text-xs font-semibold transition">
                ${isApproved ? 'Unapprove' : '✓ Approve'}
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    function openEditModal(idx) {
      activeEditIndex = idx;
      const item = candidates[idx];

      document.getElementById('modal-movie-title').innerText = item.title + (item.year ? ` (${item.year})` : '');
      document.getElementById('modal-movie-id').innerText = `ID: ${item.film_id}`;

      document.getElementById('input-title').value = item.title || '';
      document.getElementById('input-genres').value = (item.proposed_genres || []).join(', ');
      if (document.getElementById('input-age-rating')) {
        document.getElementById('input-age-rating').value = item.proposed_age_rating || '13+';
      }
      document.getElementById('input-yt').value = item.youtube_url || '';
      document.getElementById('input-synopsis').value = item.proposed_synopsis || '';

      const posterPreview = document.getElementById('modal-poster-preview');
      if (item.poster_url) {
        posterPreview.innerHTML = `<img src="${item.poster_url}" class="w-full h-full object-cover">`;
      } else {
        posterPreview.innerHTML = `<span class="text-xs text-slate-500 text-center">No Poster</span>`;
      }

      document.getElementById('edit-modal').classList.remove('hidden');
      document.getElementById('edit-modal').classList.add('flex');
    }

    function closeModal() {
      document.getElementById('edit-modal').classList.add('hidden');
      document.getElementById('edit-modal').classList.remove('flex');
      activeEditIndex = null;
    }

    function saveModalChanges() {
      if (activeEditIndex === null) return;
      const item = candidates[activeEditIndex];
      item.title = document.getElementById('input-title').value;
      const rawGenres = document.getElementById('input-genres').value;
      item.proposed_genres = rawGenres.split(',').map(g => g.trim()).filter(Boolean);
      if (document.getElementById('input-age-rating')) {
        item.proposed_age_rating = document.getElementById('input-age-rating').value;
      }
      item.youtube_url = document.getElementById('input-yt').value;
      item.proposed_synopsis = document.getElementById('input-synopsis').value;

      renderCards();
      alert('✓ Movie edits saved in memory!');
    }

    function approveModalCard() {
      if (activeEditIndex === null) return;
      saveModalChanges();
      approve(activeEditIndex);
      closeModal();
    }

    function clearSynopsisField() {
      document.getElementById('input-synopsis').value = '';
    }

    function copyToClipboard(inputId) {
      const val = document.getElementById(inputId).value;
      if (!val) {
        alert('Field is empty');
        return;
      }
      navigator.clipboard.writeText(val);
      alert('📋 Copied link: ' + val);
    }

    function visitLink(inputId) {
      const val = document.getElementById(inputId).value;
      if (val) window.open(val, '_blank');
    }

    function approve(idx) {
      approvedSet.add(idx);
      document.getElementById('approved-count').innerText = approvedSet.size;
      renderCards();
    }

    function approveAll() {
      candidates.forEach((_, idx) => approvedSet.add(idx));
      document.getElementById('approved-count').innerText = approvedSet.size;
      renderCards();
    }

    function nextPage() {
      const totalPages = Math.ceil(filteredList.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderCards();
      }
    }

    function prevPage() {
      if (currentPage > 1) {
        currentPage--;
        renderCards();
      }
    }

    function exportApprovedJSON() {
      const approvedList = candidates.filter((_, idx) => approvedSet.has(idx));
      if (approvedList.length === 0) {
        alert('Please approve at least one movie first!');
        return;
      }
      const blob = new Blob([JSON.stringify(approvedList, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'approved_movies_enrichments.json';
      a.click();
    }

    filterCards();
  </script>
</body>
</html>"""

html_output = html_template.replace("__TOTAL_COUNT__", str(total_count)).replace("__JSON_DATA__", json_str).replace("__SERVICE_KEY__", SERVICE_KEY)

with open("movies_approval_dashboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)

print(f"✅ SUCCESS: Interactive Movie Dashboard saved to movies_approval_dashboard.html with {total_count} candidates!")
