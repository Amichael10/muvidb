import re

with open('src/pages/admin/AdminFilms.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'useLocalStorageDraft' not in content:
    content = content.replace("import { toTitleCase } from '../../utils/format';", "import { toTitleCase } from '../../utils/format';\nimport { useLocalStorageDraft } from '../../hooks/useLocalStorageDraft';")

# 2. Add hook state
state_code = """  const [formData, setFormData] = useState(initialFormState);

  const draftKey = isDrawerOpen ? (editingFilm ? `lumi_draft_film_${editingFilm.id}` : 'lumi_draft_film_new') : null;
  const draftData = useMemo(() => ({ formData, credits, showtimes, selectedCompany }), [formData, credits, showtimes, selectedCompany]);
  const { clearDraft } = useLocalStorageDraft(draftKey, draftData, isDrawerOpen);
  const [draftRestoredMessage, setDraftRestoredMessage] = useState('');
"""
if 'const draftKey =' not in content:
    content = content.replace("  const [formData, setFormData] = useState(initialFormState);", state_code)

# 3. Update handleOpenDrawer
old_handle_open = """  const handleOpenDrawer = async (film = null) => {
    if (film) {
      setEditingFilm(film);
      setFormData({
        ...initialFormState,
        ...film,
        runtime_minutes: film.runtime_minutes || '',
        is_featured: film.is_featured || false,
        release_type: film.release_type || 'cinema',
        youtube_watch_url: film.youtube_watch_url || '',
        streaming_links: film.streaming_links || {},
      });
      await fetchFilmDetails(film.id);
    } else {
      setEditingFilm(null);
      setFormData(initialFormState);
      setCredits([]);
      setShowtimes([]);
    }
    setIsDrawerOpen(true);
  };"""

new_handle_open = """  const handleOpenDrawer = async (film = null, ignoreDraft = false) => {
    let draft = null;
    const key = film ? `lumi_draft_film_${film.id}` : 'lumi_draft_film_new';
    if (!ignoreDraft) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) draft = JSON.parse(stored);
      } catch (e) {}
    }
    setDraftRestoredMessage(draft ? 'Unsaved changes restored from draft.' : '');

    if (film) {
      setEditingFilm(film);
      setFormData(draft?.formData || {
        ...initialFormState,
        ...film,
        runtime_minutes: film.runtime_minutes || '',
        is_featured: film.is_featured || false,
        release_type: film.release_type || 'cinema',
        youtube_watch_url: film.youtube_watch_url || '',
        streaming_links: film.streaming_links || {},
      });
      
      if (draft) {
        setCredits(draft.credits || []);
        setShowtimes(draft.showtimes || []);
        setSelectedCompany(draft.selectedCompany || null);
        setCompanySearch(draft.selectedCompany?.name || '');
      } else {
        await fetchFilmDetails(film.id);
      }
    } else {
      setEditingFilm(null);
      setFormData(draft?.formData || initialFormState);
      setCredits(draft?.credits || []);
      setShowtimes(draft?.showtimes || []);
      setSelectedCompany(draft?.selectedCompany || null);
      setCompanySearch(draft?.selectedCompany?.name || '');
    }
    setIsDrawerOpen(true);
  };"""

if 'Unsaved changes restored from draft' not in content:
    content = content.replace(old_handle_open, new_handle_open)

# 4. Add clearDraft to handleSubmit
if 'clearDraft();' not in content:
    content = content.replace("      toast.success('Film saved successfully');\n      handleCloseDrawer();", "      toast.success('Film saved successfully');\n      clearDraft();\n      handleCloseDrawer();")


# 5. Add UI logic for draftRestoredMessage and "Clear Draft" button
ui_code = """      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingFilm ? 'Edit Film' : 'Add Film'}
        size="xl"
      >
        <div className="h-full flex flex-col bg-slate-900">
          {draftRestoredMessage && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <Icon icon="lucide:history" className="w-4 h-4" />
                <span className="text-sm font-medium">{draftRestoredMessage}</span>
              </div>
              <button
                onClick={() => {
                  clearDraft();
                  setDraftRestoredMessage('');
                  // Re-open without draft
                  setIsDrawerOpen(false);
                  setTimeout(() => handleOpenDrawer(editingFilm, true), 100);
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
              >
                Discard Draft
              </button>
            </div>
          )}
"""
if 'Discard Draft' not in content:
    content = re.sub(
        r'<Drawer\s+isOpen={isDrawerOpen}\s+onClose={handleCloseDrawer}\s+title={editingFilm \? \'Edit Film\' : \'Add Film\'}\s+size="xl"\s+>\s+<div className="h-full flex flex-col bg-slate-900">',
        ui_code.strip(),
        content
    )


with open('src/pages/admin/AdminFilms.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
