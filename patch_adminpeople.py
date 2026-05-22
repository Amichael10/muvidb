import re

with open('src/pages/admin/AdminPeople.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'useLocalStorageDraft' not in content:
    content = content.replace("import { toTitleCase } from '../../utils/format';", "import { toTitleCase } from '../../utils/format';\nimport { useLocalStorageDraft } from '../../hooks/useLocalStorageDraft';\nimport { useMemo } from 'react';")

# 2. Add hook state
state_code = """  const [formData, setFormData] = useState({
    name: '',
    biography: '',
    photo_url: '',
    date_of_birth: '',
    gender: 'Prefer not to say',
    nationality: 'Nigerian',
    is_verified: false,
    is_spotlight: false,
    popularity_score: 0,
    known_for_department: 'Actor', // Actor, Skit Maker, Producer, etc.
    youtube_channel_id: '',
    youtube_handle: '',
    youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null }
  });

  const draftKey = isDrawerOpen ? (editingPerson ? `lumi_draft_person_${editingPerson.id}` : 'lumi_draft_person_new') : null;
  const draftData = useMemo(() => formData, [formData]);
  const { clearDraft } = useLocalStorageDraft(draftKey, draftData, isDrawerOpen);
  const [draftRestoredMessage, setDraftRestoredMessage] = useState('');
"""
if 'const draftKey =' not in content:
    content = content.replace("""  const [formData, setFormData] = useState({
    name: '',
    biography: '',
    photo_url: '',
    date_of_birth: '',
    gender: 'Prefer not to say',
    nationality: 'Nigerian',
    is_verified: false,
    is_spotlight: false,
    popularity_score: 0,
    known_for_department: 'Actor', // Actor, Skit Maker, Producer, etc.
    youtube_channel_id: '',
    youtube_handle: '',
    youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null }
  });""", state_code)

# 3. Update openAddDrawer and openEditDrawer to use ignoreDraft
old_add_drawer = """  const openAddDrawer = () => {
    setEditingPerson(null);
    setYoutubeChannelInput('');
    setFormData({
      name: '',
      biography: '',
      photo_url: '',
      date_of_birth: '',
      gender: 'Prefer not to say',
      nationality: 'Nigerian',
      is_verified: false,
      is_spotlight: false,
      popularity_score: 0,
      tmdb_id: '',
      youtube_channel_id: '',
      youtube_handle: '',
      youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null }
    });
    setIsDrawerOpen(true);
  };"""

new_add_drawer = """  const openAddDrawer = (ignoreDraft = false) => {
    let draft = null;
    if (!ignoreDraft) {
      try {
        const stored = localStorage.getItem('lumi_draft_person_new');
        if (stored) draft = JSON.parse(stored);
      } catch (e) {}
    }
    setDraftRestoredMessage(draft ? 'Unsaved changes restored from draft.' : '');

    setEditingPerson(null);
    setYoutubeChannelInput('');
    setFormData(draft || {
      name: '',
      biography: '',
      photo_url: '',
      date_of_birth: '',
      gender: 'Prefer not to say',
      nationality: 'Nigerian',
      is_verified: false,
      is_spotlight: false,
      popularity_score: 0,
      tmdb_id: '',
      youtube_channel_id: '',
      youtube_handle: '',
      youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null }
    });
    setIsDrawerOpen(true);
  };"""

if 'Unsaved changes restored from draft' not in content:
    content = content.replace(old_add_drawer, new_add_drawer)

old_edit_drawer = """  const openEditDrawer = async (person) => {
    setEditingPerson(person);
    setFormData({
      name: person.name || '',
      biography: person.biography || person.bio || '',
      photo_url: person.photo_url || '',
      date_of_birth: person.date_of_birth || '',
      gender: person.gender || 'Prefer not to say',
      nationality: person.nationality || 'Nigerian',
      is_verified: person.is_verified || false,
      is_spotlight: person.is_spotlight || false,
      popularity_score: person.popularity_score || 0,
      tmdb_id: person.tmdb_id || '',
      youtube_channel_id: person.youtube_channel_id || '',
      youtube_handle: person.youtube_handle || '',
      youtube_stats: person.youtube_stats || { subscribers: '0', videos: '0', thumbnail: null, banner: null }
    });
    setYoutubeChannelInput(getPersonYoutubeChannelUrl(person) || '');

    // Fetch credits for this person
    const { data: credits } = await supabase
      .from('credits')
      .select(` 
        id, role, character_name, billing_order,
        films(id, title, year, poster_url)
      `)
      .eq('person_id', person.id)
      .order('billing_order');
      
    setPersonCredits(credits || []);

    // Fetch qualifying YT videos
    if (person.youtube_channel_id) {
       const minDuration = person.known_for_department === 'Actor' ? 2100 : 900; // 35m or 15m
       const { data: ytVideos } = await supabase
         .from('channel_videos')
         .select('*')
         .eq('channel_id', person.youtube_channel_id)
         .gte('duration_seconds', minDuration)
         .order('published_at', { ascending: false });
       setYoutubeFilmography(ytVideos || []);
    } else {
       setYoutubeFilmography([]);
    }

    setIsDrawerOpen(true);
  };"""

new_edit_drawer = """  const openEditDrawer = async (person, ignoreDraft = false) => {
    let draft = null;
    if (!ignoreDraft) {
      try {
        const stored = localStorage.getItem(`lumi_draft_person_${person.id}`);
        if (stored) draft = JSON.parse(stored);
      } catch (e) {}
    }
    setDraftRestoredMessage(draft ? 'Unsaved changes restored from draft.' : '');

    setEditingPerson(person);
    setFormData(draft || {
      name: person.name || '',
      biography: person.biography || person.bio || '',
      photo_url: person.photo_url || '',
      date_of_birth: person.date_of_birth || '',
      gender: person.gender || 'Prefer not to say',
      nationality: person.nationality || 'Nigerian',
      is_verified: person.is_verified || false,
      is_spotlight: person.is_spotlight || false,
      popularity_score: person.popularity_score || 0,
      tmdb_id: person.tmdb_id || '',
      youtube_channel_id: person.youtube_channel_id || '',
      youtube_handle: person.youtube_handle || '',
      youtube_stats: person.youtube_stats || { subscribers: '0', videos: '0', thumbnail: null, banner: null }
    });
    setYoutubeChannelInput(draft?.youtube_channel_id || draft?.youtube_handle || person.youtube_channel_id || person.youtube_handle || '');

    // Fetch credits for this person
    const { data: credits } = await supabase
      .from('credits')
      .select(` 
        id, role, character_name, billing_order,
        films(id, title, year, poster_url)
      `)
      .eq('person_id', person.id)
      .order('billing_order');
      
    setPersonCredits(credits || []);

    // Fetch qualifying YT videos
    if (person.youtube_channel_id) {
       const minDuration = person.known_for_department === 'Actor' ? 2100 : 900; // 35m or 15m
       const { data: ytVideos } = await supabase
         .from('channel_videos')
         .select('*')
         .eq('channel_id', person.youtube_channel_id)
         .gte('duration_seconds', minDuration)
         .order('published_at', { ascending: false });
       setYoutubeFilmography(ytVideos || []);
    } else {
       setYoutubeFilmography([]);
    }

    setIsDrawerOpen(true);
  };"""

if 'openEditDrawer = async (person, ignoreDraft = false)' not in content:
    # use regex because sometimes the spacing inside the function might be slightly different
    # actually string replace is safer if we get the exact string. Let's just do regex for the first part of openEditDrawer
    content = re.sub(
        r'const openEditDrawer = async \(person\) => {.*?setIsDrawerOpen\(true\);\s*};',
        new_edit_drawer.strip(),
        content,
        flags=re.DOTALL
    )

# 4. Add clearDraft to handleSave success
if 'clearDraft();' not in content:
    content = content.replace("        toast.success(editingPerson ? 'Person updated successfully' : 'Person added successfully');\n        setIsDrawerOpen(false);\n        fetchPeople();", "        toast.success(editingPerson ? 'Person updated successfully' : 'Person added successfully');\n        clearDraft();\n        setIsDrawerOpen(false);\n        fetchPeople();")

# 5. Add UI logic for draftRestoredMessage and "Clear Draft" button
ui_code = """      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingPerson ? 'Edit Record' : 'Add New Record'}>
        <div className="h-full flex flex-col">
          {draftRestoredMessage && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <Icon icon="lucide:history" className="w-4 h-4" />
                <span className="text-sm font-medium">{draftRestoredMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setDraftRestoredMessage('');
                  setIsDrawerOpen(false);
                  setTimeout(() => {
                    if (editingPerson) openEditDrawer(editingPerson, true);
                    else openAddDrawer(true);
                  }, 100);
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
              >
                Discard Draft
              </button>
            </div>
          )}
        <form onSubmit={handleSave} className="p-8 space-y-10">"""

if 'Discard Draft' not in content:
    content = content.replace("<Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingPerson ? 'Edit Record' : \n'Add New Record'}>\n        <form onSubmit={handleSave} className=\"p-8 space-y-10\">", ui_code)
    # also try single line version
    content = content.replace("<Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingPerson ? 'Edit Record' : 'Add New Record'}>\n        <form onSubmit={handleSave} className=\"p-8 space-y-10\">", ui_code)
    # also try just a regex
    content = re.sub(
        r'<Drawer isOpen={isDrawerOpen} onClose={\(\) => setIsDrawerOpen\(false\)} title={editingPerson \? \'Edit Record\' : \s*\'Add New Record\'}>\s*<form onSubmit={handleSave} className="p-8 space-y-10">',
        ui_code.strip(),
        content
    )


with open('src/pages/admin/AdminPeople.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

