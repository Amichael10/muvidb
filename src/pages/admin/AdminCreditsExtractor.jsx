import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';
import { toast } from 'react-hot-toast';
import {
  pickAutoMatch,
  foldPersonText,
} from '../../lib/personNameMatch';
import { canonicalizeRole } from '../../lib/creditRoles';
import { matchPeopleByNameKey, searchPeopleByName } from '../../lib/peopleSearch';
import { extractCreditsWithLocalOCR } from '../../utils/localCreditOcr';

const PEOPLE_SELECT = 'id, name, photo_url, film_count';
const FILM_SELECT = 'id, title, poster_url, release_type, series_id, season_number, episode_number, year';

function isActorCredit(role) {
  return canonicalizeRole(role) === 'actor';
}

function installmentBaseTitle(title) {
  return String(title || '')
    .replace(/\s*[-–—:]?\s*(?:part|pt\.?|episode|ep\.?)\s*\d+\s*$/i, '')
    .replace(/\s+\d+\s*$/i, '')
    .trim();
}

function hasInstallmentMarker(title) {
  return /(?:\b(?:part|pt\.?|episode|ep\.?)\s*\d+|\s\d+)\s*$/i.test(String(title || '').trim());
}

async function resolveNamesWithConcurrency(names, { concurrency = 3, onProgress } = {}) {
  const queue = [...names];
  const resolved = new Map();
  let completed = 0;

  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      let match = null;
      try {
        match = await resolvePersonMatch(name);
      } catch (err) {
        console.warn(`Could not match ${name}:`, err);
      }
      if (match) resolved.set(name, match);
      completed += 1;
      onProgress?.(completed, names.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, names.length) }, () => worker())
  );
  return resolved;
}

/**
 * Resolve an OCR/typed credit name to an existing person.
 * Prefer Postgres name_key (order-insensitive) — Cohere is only a soft fallback.
 */
async function resolvePersonMatch(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return null;

  // 1) Authoritative: exact fold + name_key swap in SQL
  const keyed = await matchPeopleByNameKey(name, { limit: 5 });
  const keyedHit = pickAutoMatch(name, keyed);
  if (keyedHit) return keyedHit;

  // 2) Broader lexical + optional Cohere ranking
  const hits = await searchPeopleByName(name, {
    limit: 16,
    select: PEOPLE_SELECT,
    useCohere: true,
  });
  const auto = pickAutoMatch(name, hits);
  if (auto) return auto;

  const folded = foldPersonText(name);
  return hits.find((p) => foldPersonText(p.name) === folded) || null;
}

/** Typeahead: partial name search, ranked. */
async function searchPeopleSuggestions(rawQuery, limit = 8) {
  return searchPeopleByName(rawQuery, { limit, select: PEOPLE_SELECT });
}

/** Typeahead name cell for credit roster rows. */
function PersonNameCell({ row, disabled, onTextChange, onAutoLink, onPickPerson, onResolve }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const blurTimer = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (disabled) return undefined;
    const q = row.name.trim();
    clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const hits = await searchPeopleSuggestions(q);
        setSuggestions(hits);
        // Auto-link exact / name-order swap without rewriting the typed string
        const auto = pickAutoMatch(q, hits);
        if (auto) onAutoLink(auto);
      } catch (err) {
        console.error('People suggestion search failed:', err);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-search when the typed name changes
  }, [row.name, disabled]);

  const handleBlur = () => {
    clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      if (row.name.trim() && !row.matchId) onResolve(row.name);
    }, 150);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={row.name}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onChange={(e) => {
          onTextChange(e.target.value);
          setOpen(true);
        }}
        className="w-full bg-transparent border-b border-transparent focus:border-brand/40 text-text-primary text-sm font-bold focus:outline-none focus:ring-0 py-0.5 placeholder:text-text-muted/30"
        placeholder="Type a name to search…"
      />
      {open && !disabled && row.name.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-1 w-[min(100%,22rem)] min-w-[16rem] bg-surface border border-border rounded-lg shadow-2xl z-40 overflow-hidden ring-1 ring-black/5">
          {searching ? (
            <div className="px-3 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Searching…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-text-muted">
              No matches — will create a new profile
            </div>
          ) : (
            suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPickPerson(p);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors border-b border-border/50 last:border-0 ${
                  row.matchId === p.id ? 'bg-blue-500/5' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-surface-2 border border-border overflow-hidden shrink-0">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-primary truncate">{p.name}</p>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                    {p.film_count ? `${p.film_count} credits` : 'Existing profile'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminCreditsExtractor() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core State
  const [films, setFilms] = useState([]);
  const [selectedFilmId, setSelectedFilmId] = useState('');
  const [selectedFilm, setSelectedFilm] = useState(null); // Explicit selected film object
  const [activeTab, setActiveTab] = useState('cast'); // 'cast' or 'crew'
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrLogs, setOcrLogs] = useState([]);
  const [ocrEngine, setOcrEngine] = useState('ai'); // 'ai' (AI Vision LLM) or 'local' (Free Tesseract)

  // Upload/Image State
  // Multiple screenshots: a credit roll rarely fits in one frame. Each entry is
  // { id, name, base64 }; extraction runs them in order and pools the rows.
  const [screenshots, setScreenshots] = useState([]);

  // Roster Rows (editable)
  const [castRows, setCastRows] = useState([]);
  const [crewRows, setCrewRows] = useState([]);

  // Double-click write lock states
  const [savingRows, setSavingRows] = useState(new Set());
  const [savedRows, setSavedRows] = useState(new Set());

  // Dropdown Film search
  const [filmSearch, setFilmSearch] = useState('');
  const [isFilmDropdownOpen, setIsFilmDropdownOpen] = useState(false);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);
  const [isRematching, setIsRematching] = useState(false);
  const [rematchProgress, setRematchProgress] = useState({ done: 0, total: 0 });
  const [relatedFilms, setRelatedFilms] = useState([]);
  const [relatedFilmId, setRelatedFilmId] = useState('');
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [isImportingCredits, setIsImportingCredits] = useState(false);

  // Load 50 recent films on mount (so newly created/updated films appear first)
  async function loadRecentFilms() {
    try {
      const { data, error } = await supabase
        .from('films')
        .select(FILM_SELECT)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setFilms(data || []);
    } catch (err) {
      console.error('Failed to load recent films:', err);
    }
  }

  useEffect(() => {
    loadRecentFilms();
  }, []);

  const filmDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filmDropdownRef.current && !filmDropdownRef.current.contains(e.target)) {
        setIsFilmDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced dynamic server-side live film search
  useEffect(() => {
    let active = true;
    const cleanSearch = filmSearch.trim();

    if (!cleanSearch) {
      loadRecentFilms();
      setIsSearchingFilms(false);
      return;
    }

    setIsSearchingFilms(true);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('films')
          .select(FILM_SELECT)
          .ilike('title', `%${cleanSearch}%`)
          .limit(50);
        if (error) throw error;
        
        if (active) {
          setFilms(data || []);
        }
      } catch (err) {
        console.error('Dynamic film search failed:', err);
        if (active) {
          toast.error(`Search failed: ${getFriendlyErrorMessage(err)}`);
        }
      } finally {
        if (active) {
          setIsSearchingFilms(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [filmSearch]);

  // Reuse exact person IDs from connected episodes/installments. Linked series
  // are authoritative; title-based Part 1/2/3 matches are only offered for
  // review and never write credits automatically.
  useEffect(() => {
    let active = true;

    async function loadRelatedFilms() {
      if (!selectedFilm?.id) {
        setRelatedFilms([]);
        setRelatedFilmId('');
        return;
      }

      setIsLoadingRelated(true);
      try {
        const found = new Map();
        const familyRootId = selectedFilm.series_id || selectedFilm.id;
        const linkedQuery = selectedFilm.series_id
          ? supabase.from('films').select(FILM_SELECT).or(`id.eq.${familyRootId},series_id.eq.${familyRootId}`).limit(50)
          : supabase.from('films').select(FILM_SELECT).eq('series_id', selectedFilm.id).limit(50);
        const { data: linked, error: linkedError } = await linkedQuery;
        if (linkedError) throw linkedError;
        (linked || []).forEach((film) => {
          if (film.id !== selectedFilm.id) found.set(film.id, { ...film, relation: 'linked' });
        });

        const baseTitle = installmentBaseTitle(selectedFilm.title);
        if (baseTitle && baseTitle.length >= 3) {
          const { data: titleMatches, error: titleError } = await supabase
            .from('films')
            .select(FILM_SELECT)
            .ilike('title', `${baseTitle}%`)
            .limit(30);
          if (titleError) throw titleError;
          (titleMatches || []).forEach((film) => {
            const sameBase = installmentBaseTitle(film.title).toLowerCase() === baseTitle.toLowerCase();
            const installmentLike = hasInstallmentMarker(selectedFilm.title) || hasInstallmentMarker(film.title);
            if (film.id !== selectedFilm.id && sameBase && installmentLike) {
              if (!found.has(film.id)) found.set(film.id, { ...film, relation: 'title_match' });
            }
          });
        }

        if (!active) return;
        const rows = [...found.values()].sort((a, b) => {
          const episodeOrder = Number(a.episode_number || a.season_number || 0) - Number(b.episode_number || b.season_number || 0);
          if (episodeOrder) return episodeOrder;
          return Number(b.year || 0) - Number(a.year || 0) || a.title.localeCompare(b.title);
        });
        setRelatedFilms(rows);
        setRelatedFilmId((current) => rows.some((film) => film.id === current) ? current : (rows[0]?.id || ''));
      } catch (err) {
        console.error('Could not load related film credits:', err);
        if (active) {
          setRelatedFilms([]);
          setRelatedFilmId('');
        }
      } finally {
        if (active) setIsLoadingRelated(false);
      }
    }

    loadRelatedFilms();
    return () => { active = false; };
  }, [selectedFilm]);


  // Fetch live matches whenever the name list changes.
  // Uses name_key (order-insensitive) — not case-sensitive exact .in('name').
  const runLiveProfileVerification = async (rows, setter) => {
    if (!rows.length) return;

    const nameStrings = [...new Set(rows.map((r) => r.name.trim()).filter(Boolean))];
    if (!nameStrings.length) return;

    try {
      const resolved = await resolveNamesWithConcurrency(nameStrings, { concurrency: 3 });

      setter((prevRows) =>
        prevRows.map((row) => {
          const match = resolved.get(row.name.trim());
          if (match) {
            return {
              ...row,
              matchId: match.id,
              matchName: match.name,
              photoUrl: match.photo_url,
              status: row.forceCreate ? 'new' : 'matched',
            };
          }
          // Preserve an existing/manual link when a transient lookup fails.
          if (row.matchId) return row;
          return { ...row, status: 'new' };
        })
      );
    } catch (err) {
      console.error('Error running live profile verification:', err);
    }
  };

  // Compress one file to a lightweight Base64 JPEG.
  const compressToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error(`${file.name} is not a readable image`));
        img.onload = () => {
        // Target maximum dimension to keep OCR highly legible but extremely lightweight
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to high-quality JPEG (0.8 quality yields extremely small files ~100KB-200KB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        const sizeKB = Math.round((compressedBase64.length * 3) / 4 / 1024);
        console.log(`[OCR Harvester] ${file.name}: ${Math.round(file.size / 1024)}KB -> ${sizeKB}KB (${width}x${height})`);
          resolve(compressedBase64);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

  // Accept several screenshots at once — a credit roll rarely fits in one frame.
  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files || []);
    // Let the same file be chosen again after removal.
    e.target.value = '';
    if (!picked.length) return;

    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length < picked.length) {
      toast.error(`Skipped ${picked.length - images.length} non-image file(s).`);
    }
    if (!images.length) return;

    const results = await Promise.allSettled(images.map(compressToBase64));
    const added = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        added.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          name: images[i].name,
          base64: r.value,
        });
      } else {
        // One unreadable file must not discard the rest of the batch.
        toast.error(r.reason?.message || `Could not process ${images[i].name}`);
      }
    });

    if (added.length) {
      setScreenshots((prev) => [...prev, ...added]);
      toast.success(`Added ${added.length} image${added.length > 1 ? 's' : ''}.`);
    }
  };

  const removeScreenshot = (id) =>
    setScreenshots((prev) => prev.filter((s) => s.id !== id));

  // Run Vision AI OCR to extract cast or crew
  const handleExtractCredits = async () => {
    if (!screenshots.length) {
      toast.error('Please upload at least one screenshot first.');
      return;
    }

    setIsProcessingOCR(true);
    setOcrLogs([`Queued ${screenshots.length} image${screenshots.length > 1 ? 's' : ''} for extraction...`]);

    // Rows already on screen — used to drop repeats, since consecutive frames of
    // a credit roll usually overlap.
    const existing = activeTab === 'cast' ? castRows : crewRows;
    const dedupeKey = (n, r) =>
      `${String(n || '').trim().toLowerCase()}|${String(r || '').trim().toLowerCase()}`;
    const seenKeys = new Set(existing.map((r) => dedupeKey(r.name, r.roleOrCharacter)));

    const newRows = [];
    let failedImages = 0;
    let duplicatesSkipped = 0;

    try {
      // Sequential, not parallel: the Vision endpoint rotates API keys and
      // parallel calls burn quota far faster than they save wall-clock time.
      for (let i = 0; i < screenshots.length; i++) {
        const shot = screenshots[i];
        const label = `Image ${i + 1}/${screenshots.length}`;
        
        try {
          let extracted = [];

          if (ocrEngine === 'local') {
            setOcrLogs((prev) => [...prev, `⚙️ ${label} (${shot.name}): running Free Local Tesseract OCR...`]);
            extracted = await extractCreditsWithLocalOCR(shot.base64, activeTab);
          } else {
            setOcrLogs((prev) => [...prev, `🔍 ${label} (${shot.name}): running AI Vision OCR...`]);
            const response = await fetch('/api/ai', {
              method: 'POST',
              headers: await authHeaders(),
              body: JSON.stringify({
                task: 'extract_credits_from_image',
                data: { image: shot.base64, creditType: activeTab },
              }),
            });

            if (!response.ok) {
              const errJson = await response.json().catch(() => ({}));
              throw new Error(errJson.error || 'Server returned an error');
            }

            const resData = await response.json();
            extracted = resData.results || [];
          }

          if (!extracted.length) {
            setOcrLogs((prev) => [...prev, `⚠️ ${label}: no credits found.`]);
            continue;
          }

          let addedHere = 0;
          extracted.forEach((item, idx) => {
            const k = dedupeKey(item.name, item.role_or_character);
            if (seenKeys.has(k)) { duplicatesSkipped++; return; }
            seenKeys.add(k);
            addedHere++;
            newRows.push({
              key: `${activeTab}-${i}-${idx}-${Date.now()}`,
              name: item.name || '',
              roleOrCharacter: item.role_or_character || '',
              selected: true,
              status: 'checking', // 'checking', 'matched', 'new'
              matchId: null,
              matchName: null,
              photoUrl: null,
              forceCreate: false,
            });
          });

          setOcrLogs((prev) => [
            ...prev,
            `✅ ${label}: ${addedHere} new row${addedHere === 1 ? '' : 's'}` +
              (extracted.length - addedHere > 0 ? ` (${extracted.length - addedHere} duplicate)` : ''),
          ]);
        } catch (err) {
          // One bad image must never discard rows already harvested from others.
          failedImages++;
          console.error(`OCR Error on ${shot.name}:`, err);
          setOcrLogs((prev) => [...prev, `❌ ${label} failed: ${err.message}`]);
        }
      }

      if (!newRows.length) {
        toast.error(
          failedImages === screenshots.length
            ? 'Every image failed to process.'
            : 'No new credits found — try a clearer crop.'
        );
        return;
      }

      // Verify against the full list so matching sees rows from every image.
      const merged = [...existing, ...newRows];
      if (activeTab === 'cast') {
        setCastRows(merged);
        await runLiveProfileVerification(merged, setCastRows);
      } else {
        setCrewRows(merged);
        await runLiveProfileVerification(merged, setCrewRows);
      }

      const parts = [`Extracted ${newRows.length} credit entries`];
      if (duplicatesSkipped) parts.push(`${duplicatesSkipped} duplicate skipped`);
      if (failedImages) parts.push(`${failedImages} image failed`);
      toast.success(`${parts.join(' · ')}!`);
      setOcrLogs((prev) => [...prev, `✅ Done: ${newRows.length} rows from ${screenshots.length} image(s).`]);
    } catch (err) {
      console.error('OCR Error:', err);
      toast.error(`OCR Extraction failed: ${getFriendlyErrorMessage(err)}`);
      setOcrLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // Update name text + clear stale link until autocomplete / resolve finishes
  const handleNameTextChange = (key, newName, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              name: newName,
              matchId: null,
              matchName: null,
              photoUrl: null,
              forceCreate: false,
              status: newName.trim() ? 'checking' : 'new',
            }
          : row
      )
    );
  };

  const applyPersonMatch = (key, person, type, typedName) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    if (!person) {
      setter((prev) =>
        prev.map((row) =>
          row.key === key
            ? {
                ...row,
                matchId: null,
                matchName: null,
                photoUrl: null,
                status: 'new',
              }
            : row
        )
      );
      return;
    }
    setter((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const pickedFromDropdown = typedName != null && foldPersonText(typedName) === foldPersonText(person.name);
        // Auto-link while "create new" is chosen: keep candidate, stay on create
        if (row.forceCreate && !pickedFromDropdown) {
          return {
            ...row,
            matchId: person.id,
            matchName: person.name,
            photoUrl: person.photo_url,
            status: 'new',
          };
        }
        return {
          ...row,
          name: typedName != null ? typedName : row.name,
          matchId: person.id,
          matchName: person.name,
          photoUrl: person.photo_url,
          forceCreate: false,
          status: 'matched',
        };
      })
    );
  };

  const setRowLinkMode = (key, mode, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        if (mode === 'create') {
          return { ...row, forceCreate: true, status: 'new' };
        }
        // Link to existing — only if we have a candidate
        if (!row.matchId) return row;
        return { ...row, forceCreate: false, status: 'matched' };
      })
    );
  };

  const resolveRowName = async (key, name, type) => {
    try {
      const matched = await resolvePersonMatch(name);
      applyPersonMatch(key, matched, type, name);
    } catch (err) {
      console.error(err);
      applyPersonMatch(key, null, type, name);
    }
  };

  const handleRematchRoster = async () => {
    const rows = activeTab === 'cast' ? castRows : crewRows;
    const setter = activeTab === 'cast' ? setCastRows : setCrewRows;
    const retryRows = rows.filter((row) =>
      row.name.trim() && !row.matchId && !row.forceCreate && !savedRows.has(row.key) && !savingRows.has(row.key)
    );
    if (!retryRows.length) {
      toast.success('Every available row is already matched.');
      return;
    }

    const targetKeys = new Set(retryRows.map((row) => row.key));
    const names = [...new Set(retryRows.map((row) => row.name.trim()))];
    setIsRematching(true);
    setRematchProgress({ done: 0, total: names.length });
    setter((current) => current.map((row) => targetKeys.has(row.key) ? { ...row, status: 'checking' } : row));

    try {
      const resolved = await resolveNamesWithConcurrency(names, {
        concurrency: 3,
        onProgress: (done, total) => setRematchProgress({ done, total }),
      });
      const matchedCount = retryRows.filter((row) => resolved.has(row.name.trim())).length;
      setter((current) => current.map((row) => {
        if (!targetKeys.has(row.key)) return row;
        const match = resolved.get(row.name.trim());
        if (!match) return { ...row, status: 'new' };
        return {
          ...row,
          matchId: match.id,
          matchName: match.name,
          photoUrl: match.photo_url,
          forceCreate: false,
          status: 'matched',
        };
      }));
      toast.success(
        matchedCount
          ? `Matched ${matchedCount} of ${retryRows.length} previously unmatched rows.`
          : 'No additional safe matches were found. You can still choose a profile manually.'
      );
    } catch (err) {
      console.error('Roster rematch failed:', err);
      toast.error(`Could not retry matching: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsRematching(false);
    }
  };

  const handleImportRelatedCredits = async () => {
    const sourceFilm = relatedFilms.find((film) => film.id === relatedFilmId);
    if (!sourceFilm) {
      toast.error('Choose a related film or episode first.');
      return;
    }

    setIsImportingCredits(true);
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('id, role, character_name, billing_order, people:person_id(id,name,photo_url)')
        .eq('film_id', sourceFilm.id)
        .order('billing_order', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const relevant = (data || []).filter((credit) =>
        activeTab === 'cast' ? isActorCredit(credit.role) : !isActorCredit(credit.role)
      );
      const incoming = relevant
        .filter((credit) => credit.people?.id && credit.people?.name)
        .map((credit, index) => ({
          key: `reused-${activeTab}-${sourceFilm.id}-${credit.id}-${Date.now()}-${index}`,
          name: credit.people.name,
          roleOrCharacter: activeTab === 'cast' ? (credit.character_name || '') : (credit.role || ''),
          selected: true,
          status: 'matched',
          matchId: credit.people.id,
          matchName: credit.people.name,
          photoUrl: credit.people.photo_url,
          forceCreate: false,
          reusedFrom: sourceFilm.title,
        }));

      const setter = activeTab === 'cast' ? setCastRows : setCrewRows;
      let addedCount = 0;
      setter((current) => {
        const seen = new Set(current.map((row) => activeTab === 'cast'
          ? `person:${row.matchId || foldPersonText(row.name)}`
          : `person:${row.matchId || foldPersonText(row.name)}|role:${foldPersonText(row.roleOrCharacter)}`
        ));
        const additions = incoming.filter((row) => {
          const key = activeTab === 'cast'
            ? `person:${row.matchId}`
            : `person:${row.matchId}|role:${foldPersonText(row.roleOrCharacter)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        addedCount = additions.length;
        return [...current, ...additions];
      });

      if (!incoming.length) {
        toast.error(`No ${activeTab} credits are attached to ${sourceFilm.title}.`);
      } else if (!addedCount) {
        toast.success(`All reusable ${activeTab} credits are already in this roster.`);
      } else {
        toast.success(`Added ${addedCount} reusable ${activeTab} suggestion${addedCount === 1 ? '' : 's'} from ${sourceFilm.title}.`);
      }
    } catch (err) {
      console.error('Could not import related credits:', err);
      toast.error(`Could not reuse credits: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsImportingCredits(false);
    }
  };

  // Update specific property on cell edit
  const handleCellChange = (key, field, val, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter(prev =>
      prev.map(row => (row.key === key ? { ...row, [field]: val } : row))
    );
  };

  // Delete a specific extracted row
  const handleDeleteRow = (key, type) => {
    const setter = type === 'cast' ? setCastRows : setCrewRows;
    setter(prev => prev.filter(row => row.key !== key));
  };

  // Batch Save Selected Roster to Supabase (with double-click protection locks)
  const handleBatchSave = async () => {
    if (!selectedFilmId) {
      toast.error('Please select a Film asset first.');
      return;
    }

    const currentRows = activeTab === 'cast' ? castRows : crewRows;
    const selectedRows = currentRows.filter(r => r.selected && !savedRows.has(r.key) && !savingRows.has(r.key));

    if (!selectedRows.length) {
      toast.error('No pending/selected credits to save.');
      return;
    }

    // Set double-click lock on all saving keys
    const newSaving = new Set(savingRows);
    selectedRows.forEach(r => newSaving.add(r.key));
    setSavingRows(newSaving);

    toast.loading(`Saving ${selectedRows.length} credits...`, { id: 'savingCredits' });

    let countSaved = 0;
    const filmName = films.find(f => f.id === selectedFilmId)?.title || 'Selected Film';

    for (const row of selectedRows) {
      try {
        // forceCreate = admin rejected a near-match and wants a brand-new person
        let personId = row.forceCreate ? null : row.matchId;

        // Step A: If new profile, insert to people first
        if (!personId) {
          const { data: newPerson, error: pErr } = await supabase
            .from('people')
            .insert({
              name: row.name.trim(),
              nationality: 'Nigerian',
              photo_url: null,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (pErr) throw pErr;
          personId = newPerson.id;
        }

        // Step B: Connect Credit link
        const creditRole =
          activeTab === 'cast'
            ? 'actor'
            : canonicalizeRole(row.roleOrCharacter) || row.roleOrCharacter.toLowerCase().trim();
        const characterName = activeTab === 'cast' ? row.roleOrCharacter.trim() : null;

        // Check if exact credit link exists to prevent database exceptions
        const { data: existingLink } = await supabase
          .from('credits')
          .select('id')
          .eq('film_id', selectedFilmId)
          .eq('person_id', personId)
          .eq('role', creditRole)
          .maybeSingle();

        if (!existingLink) {
          const { error: cErr } = await supabase
            .from('credits')
            .insert({
              film_id: selectedFilmId,
              person_id: personId,
              role: creditRole,
              character_name: characterName,
              billing_order: 99
            });

          if (cErr) throw cErr;
        }

        // Update successful states
        setSavedRows(prev => {
          const next = new Set(prev);
          next.add(row.key);
          return next;
        });

        // Log admin activity
        await logAdminAction(user, 'create', 'credit', selectedFilmId, `${row.name} as ${creditRole} in ${filmName}`);
        countSaved++;
      } catch (err) {
        console.error(`Failed to save row: ${row.name}`, err);
        toast.error(`Error saving ${row.name}: ${getFriendlyErrorMessage(err)}`);
      } finally {
        // Unlock saving lock
        setSavingRows(prev => {
          const next = new Set(prev);
          next.delete(row.key);
          return next;
        });
      }
    }

    toast.dismiss('savingCredits');
    if (countSaved > 0) {
      toast.success(`Successfully saved ${countSaved} Nollywood credits!`);
    }
  };

  // Server-side filtered films list
  const filteredFilms = films;

  const activeRoster = activeTab === 'cast' ? castRows : crewRows;
  const unmatchedCount = activeRoster.filter((row) =>
    row.name.trim() && !row.matchId && !row.forceCreate && !savedRows.has(row.key) && !savingRows.has(row.key)
  ).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Premium Sub-Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-border">
        <div>
          <button
            onClick={() => navigate('/admin/credits')}
            className="text-text-muted hover:text-brand font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-3 group transition-colors"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Attributions
          </button>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">OCR Credits Harvester</p>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Nollywood Credits Extractor</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium leading-relaxed opacity-80">
            Paste screenshots of opening or closing video credits. AI Vision parses details, verifies against existing database talent profiles, and links them seamlessly.
          </p>
        </div>
      </header>

      {/* Main Extractor Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Film Selection & Upload */}
        <div className="space-y-6 lg:col-span-1">
          {/* Film Selection Card */}
          <div className={`card-cal !overflow-visible p-6 space-y-4 relative ${isFilmDropdownOpen ? 'z-30' : 'z-10'}`}>
            <h3 className="text-xs font-black uppercase tracking-widest text-brand mb-2">1. Select Target Film</h3>
            
            <div className="relative" ref={filmDropdownRef}>
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.1em] mb-2">Film Asset *</label>
              
              <div 
                className="w-full bg-surface-2 border border-border text-text-primary rounded-lg px-4 py-3 text-sm focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10 cursor-pointer flex items-center justify-between transition-all"
                onClick={() => setIsFilmDropdownOpen(!isFilmDropdownOpen)}
              >
                {selectedFilm ? (
                  <div className="flex items-center gap-3">
                    {selectedFilm.poster_url ? (
                      <img src={selectedFilm.poster_url} alt="" className="w-8 h-8 object-cover bg-surface-2 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 bg-surface-2 flex items-center justify-center text-[10px] font-black rounded-lg">
                        {selectedFilm.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold truncate">{selectedFilm.title}</span>
                  </div>
                ) : (
                  <span className="text-text-muted font-medium">Choose Film Asset...</span>
                )}
                <svg className={`w-4 h-4 text-text-muted transition-transform ${isFilmDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isFilmDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-lg shadow-xl max-h-72 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 border-b border-border bg-surface-2/30">
                    <input
                      type="text"
                      className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-brand focus:outline-none transition-all"
                      placeholder="Search films..."
                      value={filmSearch}
                      onChange={(e) => setFilmSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
                    {isSearchingFilms ? (
                      <div className="p-8 text-center text-sm text-text-muted font-medium flex items-center justify-center gap-2">
                        <div className="w-4.5 h-4.5 border-2 border-brand/30 border-t-brand rounded-full animate-spin"></div>
                        <span>Searching database...</span>
                      </div>
                    ) : filteredFilms.length === 0 ? (
                      <div className="p-8 text-center text-sm text-text-muted font-medium">No results found</div>
                    ) : (
                      filteredFilms.map(f => (
                        <div
                          key={f.id}
                          className={`p-2.5 rounded-md cursor-pointer flex items-center gap-3 hover:bg-surface-2 transition-all ${selectedFilmId === f.id ? 'bg-brand/5' : ''}`}
                          onClick={() => {
                            setSelectedFilmId(f.id);
                            setSelectedFilm(f);
                            setIsFilmDropdownOpen(false);
                            setFilmSearch('');
                          }}
                        >
                          {f.poster_url ? (
                            <img src={f.poster_url} alt="" className="w-8 h-8 object-cover bg-surface-2 rounded-lg" />
                          ) : (
                            <div className="w-8 h-8 bg-surface-2 flex items-center justify-center text-xs font-black rounded-lg">
                              {f.title.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-bold truncate">{f.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedFilm && (isLoadingRelated || relatedFilms.length > 0) && (
            <div className="card-cal p-6 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand">Reuse connected credits</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Bring in recurring talent from another installment as editable suggestions. Nothing is saved until you review the roster.
                </p>
              </div>
              {isLoadingRelated ? (
                <div className="flex items-center gap-2 py-3 text-xs font-bold text-text-muted">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                  Finding connected films…
                </div>
              ) : (
                <>
                  <select
                    value={relatedFilmId}
                    onChange={(event) => setRelatedFilmId(event.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary focus:border-brand focus:outline-none"
                  >
                    {relatedFilms.map((film) => (
                      <option key={film.id} value={film.id}>
                        {film.title}{film.relation === 'title_match' ? ' · possible installment' : ' · linked'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleImportRelatedCredits}
                    disabled={isImportingCredits || !relatedFilmId}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand transition-all hover:bg-brand/15 disabled:opacity-40"
                  >
                    {isImportingCredits ? (
                      <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" /> Loading credits…</>
                    ) : (
                      `Reuse ${activeTab === 'cast' ? 'cast' : 'crew'} suggestions`
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* OCR Engine Selection Card */}
          <div className="card-cal p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-brand">2. Select Extraction Engine</h3>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                ocrEngine === 'local' 
                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                  : 'bg-brand/10 text-brand border-brand/20'
              }`}>
                {ocrEngine === 'local' ? 'Free Local OCR' : 'AI Vision LLM'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOcrEngine('ai')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  ocrEngine === 'ai'
                    ? 'border-brand bg-brand/10 ring-2 ring-brand/20'
                    : 'border-border bg-surface-2/40 hover:border-brand/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">⚡</span>
                  <span className="text-xs font-black text-text-primary">AI Vision Engine</span>
                </div>
                <p className="text-[11px] text-text-muted font-medium leading-snug">
                  High-precision LLM Vision. Parses complex & stylized text.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOcrEngine('local')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  ocrEngine === 'local'
                    ? 'border-green-500/50 bg-green-500/10 ring-2 ring-green-500/20'
                    : 'border-border bg-surface-2/40 hover:border-green-500/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🆓</span>
                  <span className="text-xs font-black text-text-primary">Local Free OCR</span>
                </div>
                <p className="text-[11px] text-text-muted font-medium leading-snug">
                  Free Tesseract engine (Credit Harvest method). Zero API cost.
                </p>
              </button>
            </div>
          </div>

          {/* Screenshot Upload Card */}
          <div className="card-cal p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-brand mb-2">3. Upload Credit Screens</h3>
            
            {/* Upload Area */}
            <div className="border-2 border-dashed border-border/80 hover:border-brand/40 rounded-xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer relative bg-surface-2/20 group">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept="image/*"
                multiple
              />
              <div className="space-y-3">
                <div className="w-12 h-12 bg-surface-2 border border-border rounded-full flex items-center justify-center mx-auto text-text-muted group-hover:scale-110 transition-transform shadow-sm">
                  📷
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">
                    {screenshots.length ? 'Add more images' : 'Drag or drop images'}
                  </p>
                  <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest mt-1">
                    PNG, JPG — select several at once
                  </p>
                </div>
              </div>
            </div>

            {/* Queued screenshots */}
            {screenshots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                    {screenshots.length} image{screenshots.length > 1 ? 's' : ''} queued
                  </p>
                  <button
                    onClick={() => setScreenshots([])}
                    disabled={isProcessingOCR}
                    className="text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    Clear all
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {screenshots.map((shot, i) => (
                    <div key={shot.id} className="relative group/thumb">
                      <img
                        src={shot.base64}
                        alt={shot.name}
                        className="h-20 w-full object-cover rounded-lg border border-border shadow-sm"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {i + 1}
                      </span>
                      <button
                        onClick={() => removeScreenshot(shot.id)}
                        disabled={isProcessingOCR}
                        title={`Remove ${shot.name}`}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-lg disabled:hidden"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Run Extraction Button */}
            <button
              onClick={handleExtractCredits}
              disabled={isProcessingOCR || !screenshots.length}
              className="w-full bg-brand text-white font-black py-3.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isProcessingOCR ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Harvesting Credits...
                </>
              ) : (
                `🚀 Run AI Vision Extraction${screenshots.length > 1 ? ` (${screenshots.length} images)` : ''}`
              )}
            </button>

            {/* AI Log Outputs */}
            {ocrLogs.length > 0 && (
              <div className="bg-surface-2/80 border border-border/80 rounded-lg p-4 font-mono text-[10px] text-text-muted space-y-1.5 max-h-40 overflow-y-auto">
                <p className="font-bold text-brand uppercase tracking-widest border-b border-border/40 pb-1 mb-1">OCR System Telemetry:</p>
                {ocrLogs.map((log, idx) => (
                  <p key={idx} className="leading-relaxed">{log}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Extracted Editable Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-cal p-6 space-y-6">
            {/* Header with Switcher Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('cast')}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                    activeTab === 'cast'
                      ? 'bg-brand/10 text-brand border-brand/20 shadow-sm'
                      : 'bg-transparent text-text-muted border-transparent hover:text-text-primary'
                  }`}
                >
                  🎭 Cast / Osere
                </button>
                <button
                  onClick={() => setActiveTab('crew')}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                    activeTab === 'crew'
                      ? 'bg-brand/10 text-brand border-brand/20 shadow-sm'
                      : 'bg-transparent text-text-muted border-transparent hover:text-text-primary'
                  }`}
                >
                  🎬 Crew / Technical
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {activeRoster.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRematchRoster}
                    disabled={isRematching || unmatchedCount === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-400 transition-all hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Retry database matching for every currently unmatched row"
                  >
                    {isRematching ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                        Matching {rematchProgress.done}/{rematchProgress.total}
                      </>
                    ) : (
                      <>↻ Auto-match again{unmatchedCount ? ` (${unmatchedCount})` : ''}</>
                    )}
                  </button>
                )}
                {activeRoster.length > 0 && (
                  <button
                    onClick={() => {
                      if (activeTab === 'cast') setCastRows([]);
                      else setCrewRows([]);
                      setSavedRows(new Set());
                    }}
                    className="text-text-muted hover:text-red-500 text-[10px] font-black uppercase tracking-widest border border-border hover:border-red-500/20 px-4 py-2.5 rounded-lg hover:bg-red-500/5 transition-all"
                  >
                    🗑️ Clear List
                  </button>
                )}
                
                <button
                  onClick={handleBatchSave}
                  disabled={!activeRoster.filter(r => r.selected && !savedRows.has(r.key)).length}
                  className="bg-brand text-white font-black px-6 py-2.5 rounded-lg text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-lg shadow-brand/10"
                >
                  💾 Save Roster
                </button>
              </div>
            </div>

            {/* Editable Table */}
            <div className="overflow-visible">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-2/10 text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={activeRoster.length > 0 && activeRoster.every(r => r.selected)}
                        onChange={(e) => {
                          const setter = activeTab === 'cast' ? setCastRows : setCrewRows;
                          setter(prev => prev.map(r => ({ ...r, selected: e.target.checked })));
                        }}
                        disabled={activeRoster.length === 0}
                        className="w-4 h-4 rounded border-border bg-surface-2 accent-brand cursor-pointer focus:ring-brand/20"
                      />
                    </th>
                    <th className="px-4 py-3.5">Talent Name</th>
                    <th className="px-4 py-3.5">
                      {activeTab === 'cast' ? 'Character Role' : 'Specific Function'}
                    </th>
                    <th className="px-4 py-3.5">Database Status</th>
                    <th className="px-4 py-3.5 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {activeRoster.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-3xl opacity-20">📷</span>
                          <p className="text-text-muted font-bold text-base">Roster empty.</p>
                          <p className="text-[10px] text-text-muted/60 font-semibold uppercase tracking-widest max-w-xs">Upload a screenshot of closing credits on the left and run OCR to generate a list.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeRoster.map((row) => (
                      <tr
                        key={row.key}
                        className={`group transition-all duration-200 ${
                          savedRows.has(row.key)
                            ? 'bg-green-500/5 hover:bg-green-500/5'
                            : 'hover:bg-surface-2/30'
                        }`}
                      >
                        {/* Checkbox select */}
                        <td className="px-4 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onChange={(e) => {
                              const setter = activeTab === 'cast' ? setCastRows : setCrewRows;
                              setter(prev => prev.map(r => r.key === row.key ? { ...r, selected: e.target.checked } : r));
                            }}
                            className="w-4 h-4 rounded border-border bg-surface-2 accent-brand cursor-pointer focus:ring-brand/20 disabled:opacity-40"
                          />
                        </td>

                        {/* Editable Name + typeahead */}
                        <td className="px-4 py-4 relative overflow-visible">
                          <PersonNameCell
                            row={row}
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onTextChange={(val) => handleNameTextChange(row.key, val, activeTab)}
                            onAutoLink={(person) => applyPersonMatch(row.key, person, activeTab)}
                            onPickPerson={(person) =>
                              applyPersonMatch(row.key, person, activeTab, person.name)
                            }
                            onResolve={(name) => resolveRowName(row.key, name, activeTab)}
                          />
                        </td>

                        {/* Editable Character / Function */}
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            value={row.roleOrCharacter}
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onChange={(e) => handleCellChange(row.key, 'roleOrCharacter', e.target.value, activeTab)}
                            className="w-full bg-transparent border-b border-transparent focus:border-brand/40 text-text-primary text-sm font-bold focus:outline-none focus:ring-0 py-0.5 placeholder:text-text-muted/30"
                            placeholder={activeTab === 'cast' ? 'e.g. Arojojoye' : 'e.g. Makeup Artist'}
                          />
                        </td>

                        {/* Live Database Matching Alerts */}
                        <td className="px-4 py-4">
                          {savedRows.has(row.key) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">
                              🎉 Synced Successfully
                            </span>
                          ) : savingRows.has(row.key) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-brand/10 text-brand border border-brand/20">
                              <div className="w-2.5 h-2.5 border border-brand/30 border-t-brand rounded-full animate-spin"></div>
                              Saving...
                            </span>
                          ) : row.matchId ? (
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setRowLinkMode(row.key, 'link', activeTab)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${
                                    !row.forceCreate
                                      ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                      : 'bg-surface-2 text-text-muted border-border hover:border-blue-500/30 hover:text-blue-400'
                                  }`}
                                  title={row.matchName ? `Link to ${row.matchName}` : 'Link to existing'}
                                >
                                  {row.photoUrl && (
                                    <img src={row.photoUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                                  )}
                                  Link existing
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRowLinkMode(row.key, 'create', activeTab)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${
                                    row.forceCreate
                                      ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                                      : 'bg-surface-2 text-text-muted border-border hover:border-purple-500/30 hover:text-purple-400'
                                  }`}
                                  title="Create a new person instead of linking this match"
                                >
                                  ✨ Create new
                                </button>
                              </div>
                              {row.matchName && (
                                <p className="text-[10px] text-text-muted truncate" title={row.matchName}>
                                  {row.forceCreate ? 'Ignoring match: ' : '→ '}
                                  {row.matchName}
                                </p>
                              )}
                              {row.reusedFrom && (
                                <p className="truncate text-[9px] font-bold text-amber-500/80" title={`Suggested from ${row.reusedFrom}`}>
                                  Suggested from {row.reusedFrom}
                                </p>
                              )}
                            </div>
                          ) : row.status === 'new' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/20">
                              ✨ Creates new profile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-surface-2 text-text-muted border border-border">
                              Verification pending
                            </span>
                          )}
                        </td>

                        {/* Delete Action */}
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            disabled={savedRows.has(row.key) || savingRows.has(row.key)}
                            onClick={() => handleDeleteRow(row.key, activeTab)}
                            className="p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:hover:scale-100 cursor-pointer"
                            title="Remove row"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
