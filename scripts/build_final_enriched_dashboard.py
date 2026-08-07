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

print("🚀 UPDATING DASHBOARD WITH KNOWN MOVIES/ROLES & CLOSABLE MODAL...")

with open("google_socials_enriched_people.json", "r", encoding="utf-8") as f:
    enriched_items = json.load(f)

json_str = json.dumps(enriched_items)
total_count = len(enriched_items)

html_template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MuviDB - Interactive People Data Enrichment Studio</title>
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
        <span class="text-3xl">🎬</span>
        <h1 class="text-3xl font-bold text-sky-400">MuviDB Enrichment Studio</h1>
      </div>
      <p class="text-slate-400 mt-2 text-sm">
        Review & edit all <span class="text-sky-300 font-bold">__TOTAL_COUNT__</span> enriched profiles. Click any card to edit fields, copy social links, view movie credits, or delete incorrect info.
      </p>
    </div>
    <div class="flex gap-3">
      <button onclick="approveAll()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow transition flex items-center gap-2">
        <span>✓</span> Approve All (__TOTAL_COUNT__)
      </button>
      <button onclick="applyApprovedToSupabase()" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow transition flex items-center gap-2">
        <span>⚡</span> Apply Approved to Supabase
      </button>
      <button onclick="exportApprovedJSON()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow transition flex items-center gap-2">
        <span>📥</span> Export Approved JSON
      </button>
    </div>
  </header>

  <!-- Controls Bar -->
  <div class="mb-6 flex flex-col md:flex-row justify-between items-center bg-slate-800/60 p-4 rounded-xl border border-slate-700 gap-4">
    <div class="flex items-center gap-4 w-full md:w-auto">
      <input type="text" id="search-input" onkeyup="filterCards()" placeholder="🔍 Search name, film title, ID, or handle..." class="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-4 py-2 w-full md:w-80 focus:outline-none focus:border-sky-500">
      <select id="filter-status" onchange="filterCards()" class="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
        <option value="all">All Candidates</option>
        <option value="pending">Pending Only</option>
        <option value="approved">Approved Only</option>
      </select>
    </div>

    <div class="text-sm text-slate-300">
      Status: <span id="approved-count" class="font-bold text-emerald-400">0</span> approved | <span id="total-count" class="font-bold text-white">__TOTAL_COUNT__</span> candidates
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="cards-grid"></div>

  <!-- Pagination Bar -->
  <div class="mt-8 flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700">
    <button onclick="prevPage()" id="btn-prev" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-semibold">◄ Previous Page</button>
    <span class="text-xs text-slate-400">Page <strong id="current-page-num" class="text-sky-400">1</strong> of <strong id="total-pages-num" class="text-white">1</strong> (<span id="showing-range">0-50</span> items)</span>
    <button onclick="nextPage()" id="btn-next" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-semibold">Next Page ►</button>
  </div>

  <!-- Closable Edit Modal -->
  <div id="edit-modal" onclick="handleBackdropClick(event)" class="fixed inset-0 modal-backdrop hidden items-center justify-center p-4 z-50 overflow-y-auto">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative" onclick="event.stopPropagation()">
      <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-sm">✕</button>

      <div class="flex items-center gap-4 border-b border-slate-800 pb-4 mb-6">
        <div id="modal-photo-preview" class="w-16 h-20 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center text-xs text-slate-500 border border-slate-700">No Photo</div>
        <div>
          <h2 id="modal-person-name" class="text-2xl font-bold text-white">Edit Person Profile</h2>
          <span id="modal-person-id" class="text-xs font-mono text-slate-400">ID: --</span>
          <div id="modal-known-movies" class="mt-1 text-xs text-amber-300 font-medium">🎬 Known Movies: --</div>
        </div>
      </div>

      <div class="space-y-4 text-sm">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Gender</label>
            <select id="input-gender" class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-sky-500">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Date of Birth</label>
            <input type="text" id="input-dob" placeholder="e.g. 1985-04-12" class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-sky-500">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Profile Photo URL</label>
          <div class="flex gap-2">
            <input type="text" id="input-photo" placeholder="https://..." class="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-sky-500">
            <button onclick="clearField('input-photo')" class="bg-rose-900/50 hover:bg-rose-800 text-rose-300 text-xs px-3 rounded border border-rose-700">Clear Photo</button>
          </div>
        </div>

        <!-- Social Media Fields with Copy & Visit Links -->
        <div class="space-y-3 pt-2 border-t border-slate-800">
          <span class="text-xs font-bold uppercase tracking-wider text-sky-400">Social Media Links</span>
          
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Instagram URL</label>
            <div class="flex gap-2">
              <input type="text" id="input-ig" placeholder="https://instagram.com/handle" class="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:border-sky-500 text-xs">
              <button onclick="copyToClipboard('input-ig')" class="bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs px-3 rounded border border-slate-700">📋 Copy</button>
              <button onclick="visitLink('input-ig')" class="bg-sky-900/40 hover:bg-sky-800 text-sky-300 text-xs px-3 rounded border border-sky-700">🔗 Visit</button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Twitter / X URL</label>
            <div class="flex gap-2">
              <input type="text" id="input-tw" placeholder="https://twitter.com/handle" class="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:border-sky-500 text-xs">
              <button onclick="copyToClipboard('input-tw')" class="bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs px-3 rounded border border-slate-700">📋 Copy</button>
              <button onclick="visitLink('input-tw')" class="bg-sky-900/40 hover:bg-sky-800 text-sky-300 text-xs px-3 rounded border border-sky-700">🔗 Visit</button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Facebook URL</label>
            <div class="flex gap-2">
              <input type="text" id="input-fb" placeholder="https://facebook.com/handle" class="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:border-sky-500 text-xs">
              <button onclick="copyToClipboard('input-fb')" class="bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs px-3 rounded border border-slate-700">📋 Copy</button>
              <button onclick="visitLink('input-fb')" class="bg-sky-900/40 hover:bg-sky-800 text-sky-300 text-xs px-3 rounded border border-sky-700">🔗 Visit</button>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Biography</label>
          <textarea id="input-bio" rows="3" class="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-sky-500 leading-relaxed"></textarea>
        </div>
      </div>

      <div class="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
        <button onclick="clearAllModalFields()" class="text-rose-400 hover:text-rose-300 text-xs font-semibold">🗑️ Clear Discovered Info</button>
        <div class="flex gap-3">
          <button onclick="saveModalChanges()" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow">💾 Save Edits</button>
          <button onclick="approveModalCard()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow">✓ Approve Profile</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const rawCandidates = __JSON_DATA__;
    const appliedPersonIds = new Set(JSON.parse(localStorage.getItem('applied_people_ids') || '[]'));
    let candidates = rawCandidates.filter(c => c.person_id && !appliedPersonIds.has(c.person_id));
    const SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co";
    const SUPABASE_ANON_KEY = "__SERVICE_KEY__";

    async function applyApprovedToSupabase() {
      const approvedList = candidates.filter((_, idx) => approvedSet.has(idx));
      if (approvedList.length === 0) {
        alert('Please approve at least one profile first!');
        return;
      }

      if (!confirm(`Apply ${approvedList.length} approved people profiles directly to Supabase?`)) return;

      let successCount = 0;
      for (const item of approvedList) {
        if (!item.person_id) continue;
        try {
          const payload = {};
          if (item.proposed_bio || item.bio) payload.bio = item.proposed_bio || item.bio;
          if (item.proposed_photo || item.photo_url) payload.photo_url = item.proposed_photo || item.photo_url;
          if (item.proposed_dob || item.date_of_birth) payload.date_of_birth = item.proposed_dob || item.date_of_birth;
          if (item.proposed_gender || item.gender) payload.gender = item.proposed_gender || item.gender;
          if (item.proposed_ig || item.instagram_url) payload.instagram_url = item.proposed_ig || item.instagram_url;
          if (item.proposed_tw || item.twitter_url) payload.twitter_url = item.proposed_tw || item.twitter_url;
          if (item.proposed_fb || item.facebook_url) payload.facebook_url = item.proposed_fb || item.facebook_url;

          const res = await fetch(`${SUPABASE_URL}/rest/v1/people?id=eq.${item.person_id}`, {
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
            appliedPersonIds.add(item.person_id);
          }
        } catch (e) {
          console.error('Error applying person:', item.name, e);
        }
      }

      localStorage.setItem('applied_people_ids', JSON.stringify(Array.from(appliedPersonIds)));
      candidates = candidates.filter(c => !appliedPersonIds.has(c.person_id));
      approvedSet.clear();
      filterCards();

      alert(`🎉 Successfully updated ${successCount} / ${approvedList.length} people in Supabase! Approved profiles have been saved and removed from this view.`);
    }

    // Handle Escape Key to Close Modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    function handleBackdropClick(e) {
      if (e.target.id === 'edit-modal') {
        closeModal();
      }
    }

    function filterCards() {
      const query = document.getElementById('search-input').value.toLowerCase().trim();
      const statusFilter = document.getElementById('filter-status').value;

      filteredList = candidates.filter((item, idx) => {
        const moviesStr = (item.known_movies || []).join(' ').toLowerCase();
        const matchesQuery = !query || 
          (item.name && item.name.toLowerCase().includes(query)) ||
          (item.person_id && item.person_id.toLowerCase().includes(query)) ||
          (item.proposed_ig && item.proposed_ig.toLowerCase().includes(query)) ||
          moviesStr.includes(query);

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
        const moviesText = item.known_movies ? item.known_movies.join(' • ') : 'No linked credit records';

        return `
          <div class="card p-6 flex flex-col justify-between ${isApproved ? 'border-emerald-600 bg-emerald-950/20' : ''}" onclick="openEditModal(${origIdx})">
            <div>
              <div class="flex justify-between items-start mb-2">
                <div>
                  <h2 class="text-xl font-bold text-white">${item.name}</h2>
                  <span class="text-xs text-slate-400">ID: ${item.person_id}</span>
                </div>
                <span class="px-3 py-1 bg-sky-950 text-sky-300 border border-sky-700 text-xs font-bold rounded-full">${item.confidence}</span>
              </div>

              <!-- Known Movies Tag -->
              <div class="mb-4 text-xs text-amber-300/90 font-medium truncate" title="${moviesText}">
                🎬 <strong>Acted/Credited in:</strong> ${moviesText}
              </div>

              <div class="flex gap-4 mb-4">
                ${item.proposed_photo ? `<img src="${item.proposed_photo}" class="w-24 h-32 object-cover rounded-lg border border-slate-600" alt="${item.name}">` : `<div class="w-24 h-32 bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-500 border border-slate-700 text-center p-2">No Photo</div>`}
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

              <!-- Quick Social Badges (Click & Copyable) -->
              <div class="flex flex-wrap gap-2 mb-3" onclick="event.stopPropagation()">
                ${item.proposed_ig ? `<a href="${item.proposed_ig}" target="_blank" class="bg-pink-950/60 hover:bg-pink-900 border border-pink-700 text-pink-300 text-xs px-2.5 py-1 rounded flex items-center gap-1">📷 IG Link</a>` : ''}
                ${item.proposed_tw ? `<a href="${item.proposed_tw}" target="_blank" class="bg-sky-950/60 hover:bg-sky-900 border border-sky-700 text-sky-300 text-xs px-2.5 py-1 rounded flex items-center gap-1">🐦 X/Twitter Link</a>` : ''}
                ${item.proposed_fb ? `<a href="${item.proposed_fb}" target="_blank" class="bg-blue-950/60 hover:bg-blue-900 border border-blue-700 text-blue-300 text-xs px-2.5 py-1 rounded flex items-center gap-1">📘 FB Link</a>` : ''}
              </div>

              <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed mb-4 line-clamp-2">
                <strong class="text-slate-400">Bio:</strong> ${item.proposed_bio}
              </div>
            </div>

            <div class="flex justify-between items-center pt-3 border-t border-slate-700" onclick="event.stopPropagation()">
              <span class="text-xs ${isApproved ? 'text-emerald-400 font-bold' : 'text-slate-400'}" id="status-${origIdx}">
                ${isApproved ? '✓ Approved' : '● Click card to Edit & Approve'}
              </span>
              <div class="space-x-2">
                <button onclick="approve(${origIdx})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-semibold">✓ Approve</button>
                <button onclick="openEditModal(${origIdx})" class="bg-sky-700 hover:bg-sky-600 text-white px-3 py-1 rounded text-xs font-semibold">✏️ Edit</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function openEditModal(idx) {
      activeEditIndex = idx;
      const item = candidates[idx];
      document.getElementById('modal-person-name').innerText = item.name;
      document.getElementById('modal-person-id').innerText = `ID: ${item.person_id}`;
      
      const moviesText = item.known_movies ? item.known_movies.join(' • ') : 'No linked credit records';
      document.getElementById('modal-known-movies').innerText = `🎬 Known Movies/Roles: ${moviesText}`;

      document.getElementById('input-gender').value = item.proposed_gender || 'Unknown';
      document.getElementById('input-dob').value = item.proposed_dob || '';
      document.getElementById('input-photo').value = item.proposed_photo || '';
      document.getElementById('input-ig').value = item.proposed_ig || '';
      document.getElementById('input-tw').value = item.proposed_tw || '';
      document.getElementById('input-fb').value = item.proposed_fb || '';
      document.getElementById('input-bio').value = item.proposed_bio || '';

      const photoPreview = document.getElementById('modal-photo-preview');
      if (item.proposed_photo) {
        photoPreview.innerHTML = `<img src="${item.proposed_photo}" class="w-full h-full object-cover">`;
      } else {
        photoPreview.innerHTML = `<span class="text-xs text-slate-500 text-center">No Photo</span>`;
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
      item.proposed_gender = document.getElementById('input-gender').value;
      item.proposed_dob = document.getElementById('input-dob').value;
      item.proposed_photo = document.getElementById('input-photo').value;
      item.proposed_ig = document.getElementById('input-ig').value;
      item.proposed_tw = document.getElementById('input-tw').value;
      item.proposed_fb = document.getElementById('input-fb').value;
      item.proposed_bio = document.getElementById('input-bio').value;

      renderCards();
      alert('✓ Profile edits saved in memory!');
    }

    function approveModalCard() {
      if (activeEditIndex === null) return;
      saveModalChanges();
      approve(activeEditIndex);
      closeModal();
    }

    function clearField(inputId) {
      document.getElementById(inputId).value = '';
    }

    function clearAllModalFields() {
      document.getElementById('input-gender').value = 'Unknown';
      document.getElementById('input-dob').value = '';
      document.getElementById('input-photo').value = '';
      document.getElementById('input-ig').value = '';
      document.getElementById('input-tw').value = '';
      document.getElementById('input-fb').value = '';
      document.getElementById('input-bio').value = '';
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
        alert('Please approve at least one profile first!');
        return;
      }
      const blob = new Blob([JSON.stringify(approvedList, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'approved_people_enrichments.json';
      a.click();
    }

    filterCards();
  </script>
</body>
</html>"""

html_output = html_template.replace("__TOTAL_COUNT__", str(total_count)).replace("__JSON_DATA__", json_str).replace("__SERVICE_KEY__", SERVICE_KEY)

with open("people_approval_dashboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)

print(f"✅ SUCCESS: Updated people_approval_dashboard.html with movie credits & closable modal!")
