import { useMemo, useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { suggestPersonEdit } from '../../lib/contributions';
import { uploadContributionImage } from '../../lib/imageUpload';
import { notifyProAdminOnTelegram } from '../../lib/proModeration';
import { getChangedProfileFields } from '../../lib/professionalProfile';
import { extractChannelIdentifier, fetchChannelData } from '../../lib/youtube';
import { formatViewCount } from '../../utils/youtube';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  fetchCastingProfile,
  saveCastingProfile,
  BODY_TYPE_OPTIONS,
  SKIN_TONE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  EYE_COLOR_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  AVAILABILITY_OPTIONS,
} from '../../lib/castingProfile';

const PRO_DEPARTMENTS = [
  { value: 'Acting', label: 'Acting / Screen Talent', icon: 'solar:clapperboard-play-bold' },
  { value: 'Editing', label: 'Editing & Post-Production', icon: 'solar:scissors-bold' },
  { value: 'Costume', label: 'Costume & Wardrobe Design', icon: 'solar:hanger-bold' },
  { value: 'Camera', label: 'Cinematography & Camera', icon: 'solar:videocamera-record-bold' },
  { value: 'Sound', label: 'Sound & Audio Engineering', icon: 'solar:headphones-round-sound-bold' },
  { value: 'Directing', label: 'Directing & Producing', icon: 'solar:play-circle-bold' },
  { value: 'Art', label: 'Art & Production Design', icon: 'solar:palette-bold' },
];

const fieldClass = 'mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10';

const fields = [
  ['name', 'Professional name', 'text', 'The name audiences and employers know you by'],
  ['known_for_department', 'Primary profession', 'text', 'Actor, Director, Producer…'],
  ['nationality', 'Nationality', 'text', 'e.g. Nigerian'],
  ['birthplace', 'Birthplace', 'text', 'City, country'],
  ['date_of_birth', 'Date of birth', 'date', ''],
  ['instagram_url', 'Instagram', 'url', 'https://instagram.com/yourname'],
  ['twitter_url', 'X / Twitter', 'url', 'https://x.com/yourname'],
  ['tiktok_url', 'TikTok', 'url', 'https://tiktok.com/@yourname'],
  ['facebook_url', 'Facebook', 'url', 'https://facebook.com/yourname'],
];

export default function ProfileEditorModal({ person, onClose, onSaved }) {
  useBodyScrollLock(true);
  const initial = useMemo(() => Object.fromEntries(fields.map(([key]) => [key, person?.[key] || ''])), [person]);
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'casting'
  const [values, setValues] = useState(initial);
  const [bio, setBio] = useState(person?.bio || '');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState(person.youtube_channel_id ? `https://youtube.com/channel/${person.youtube_channel_id}` : (person.youtube_handle || ''));
  const [youtubePreview, setYoutubePreview] = useState(person.youtube_stats || null);
  const [checkingYoutube, setCheckingYoutube] = useState(false);

  // Casting & Physical Specs State
  const [casting, setCasting] = useState({
    department: 'Acting',
    height_feet_inches: '',
    height_cm: '',
    body_type: 'Athletic',
    skin_tone: 'Warm Brown',
    hair_color: 'Black',
    eye_color: 'Dark Brown',
    distinguishing_features: '',
    playing_age_min: 24,
    playing_age_max: 35,
    location: 'Lagos, Nigeria',
    willing_to_travel: true,
    languages_text: 'English, Yoruba, Nigerian Pidgin',
    skills_text: 'Stage Combat, Voiceover, Accents, Driving',
    software_tools_text: '',
    equipment_gear_text: '',
    craft_specializations_text: '',
    experience_level: 'Professional',
    availability_status: 'Available for Bookings',
    preferences: 'Feature Films, High-End TV Drama, Lead / Supporting',
    show_on_creator_link: true,
    show_on_person_page: true,
  });

  useEffect(() => {
    if (person?.id) {
      fetchCastingProfile(person.id).then((cp) => {
        if (cp) {
          setCasting((prev) => ({
            ...prev,
            ...cp,
            department: cp.department || prev.department,
            languages_text: Array.isArray(cp.languages) ? cp.languages.join(', ') : prev.languages_text,
            skills_text: Array.isArray(cp.skills) ? cp.skills.join(', ') : prev.skills_text,
            software_tools_text: Array.isArray(cp.software_tools) ? cp.software_tools.join(', ') : prev.software_tools_text,
            equipment_gear_text: Array.isArray(cp.equipment_gear) ? cp.equipment_gear.join(', ') : prev.equipment_gear_text,
            craft_specializations_text: Array.isArray(cp.craft_specializations) ? cp.craft_specializations.join(', ') : prev.craft_specializations_text,
          }));
        }
      });
    }
  }, [person?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const checkYoutube = async () => {
    const identifier = extractChannelIdentifier(youtubeInput.trim());
    if (!identifier) return toast.error('Enter a YouTube channel URL, handle or channel ID.');
    setCheckingYoutube(true);
    try {
      const channel = await fetchChannelData(identifier);
      setYoutubePreview(channel);
      setValues((current) => ({ ...current, youtube_channel_id: channel.channelId, youtube_handle: channel.handle || '' }));
      toast.success('YouTube channel found. It will be connected after editorial review.');
    } catch (error) {
      console.error('YouTube channel lookup failed', error);
      toast.error('We couldn’t find that channel. Check the link or handle and try again.');
    } finally {
      setCheckingYoutube(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      let savedSomething = false;

      // 1. Save casting attributes if in casting tab or if edited
      if (activeTab === 'casting') {
        const result = await saveCastingProfile(person.id, {
          ...casting,
          department: casting.department || 'Acting',
          languages: (casting.languages_text || '').split(',').map((s) => s.trim()).filter(Boolean),
          skills: (casting.skills_text || '').split(',').map((s) => s.trim()).filter(Boolean),
          software_tools: (casting.software_tools_text || '').split(',').map((s) => s.trim()).filter(Boolean),
          equipment_gear: (casting.equipment_gear_text || '').split(',').map((s) => s.trim()).filter(Boolean),
          craft_specializations: (casting.craft_specializations_text || '').split(',').map((s) => s.trim()).filter(Boolean),
        });
        if (result.ok) {
          savedSomething = true;
          toast.success('Industry specs & craft skills saved successfully!');
        }
      }

      // 2. Save general profile edits if changed
      const changedFields = getChangedProfileFields(person, { ...values, bio });
      if (Object.keys(changedFields).length || photo) {
        let imagePath = null;
        if (photo) {
          const upload = await uploadContributionImage(photo);
          if (upload.error) {
            toast.error(upload.error);
            setSaving(false);
            return;
          }
          imagePath = upload.path;
        }
        const result = await suggestPersonEdit({
          personId: person.id,
          fields: changedFields,
          image_path: imagePath,
          note: 'Submitted from the verified professional dashboard.',
        });
        if (!result.ok) throw result.error;
        savedSomething = true;
        toast.success('General profile update sent to the MuviDB editorial team.');
        notifyProAdminOnTelegram({
          personId: person.id,
          personName: person.name,
          personSlug: person.slug,
          updateType: 'profile',
          summary: `Profile bio/details update: ${Object.keys(changedFields).join(', ')}`,
          details: Object.entries(changedFields).map(([k, v]) => `${k}: ${v}`).join('\n'),
          link: '/admin/contributions',
        }).catch((err) => console.warn('Profile editor telegram notify error:', err));
      }

      if (!savedSomething) {
        toast.error('Make at least one change before submitting.');
        setSaving(false);
        return;
      }

      onSaved?.();
      onClose?.();
    } catch (error) {
      console.error('Professional profile update failed', error);
      toast.error('We couldn’t submit your profile update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-lenis-prevent="true"
      style={{ overscrollBehavior: 'contain' }}
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-md overscroll-contain sm:items-center sm:p-5"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form onSubmit={submit} className="relative my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl sm:max-h-[88vh] sm:rounded-3xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[#151515] px-5 py-4 sm:px-8 sm:py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-brand">Professional profile</p>
            <h2 className="mt-1 text-xl font-black text-text-primary sm:text-2xl">Complete your public profile</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-text-muted sm:text-sm sm:leading-6">Add the details casting teams and audiences need. MuviDB reviews changes before they appear publicly.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile editor" className="grid h-8 w-8 place-items-center rounded-full bg-white/[.05] text-text-muted transition hover:bg-white/10 hover:text-white"><Icon icon="solar:close-circle-linear" width="20" /></button>
        </header>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#121212] px-5 sm:px-8">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black transition ${
              activeTab === 'general'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <Icon icon="solar:user-circle-bold" width="16" />
            General Profile & Bio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('casting')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black transition ${
              activeTab === 'casting'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <Icon icon="solar:clapperboard-play-bold" width="16" />
            Industry Specs & Skills
            <span className="rounded-full bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand">NEW</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          {activeTab === 'general' ? (
            <div className="grid gap-8 md:grid-cols-[220px_1fr]">
              <aside>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-2">
                  <img src={photo ? URL.createObjectURL(photo) : (person.photo_url || '/images/person-placeholder.png')} alt="Profile preview" className="aspect-[4/5] w-full object-cover" />
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-black text-text-primary hover:border-brand hover:text-brand">
                  <Icon icon="solar:camera-add-linear" width="18" /> Choose headshot
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
                </label>
                <p className="mt-2 text-center text-[10px] leading-4 text-text-muted">PNG, JPEG or WebP · large photos are compressed automatically</p>
              </aside>

              <div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {fields.map(([key, label, type, placeholder]) => (
                    <label key={key} className={key.includes('url') || key === 'youtube_handle' ? 'sm:col-span-2' : ''}>
                      <span className="text-xs font-bold text-text-primary">{label}</span>
                      <input type={type} value={values[key]} placeholder={placeholder} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className={fieldClass} />
                    </label>
                  ))}
                  <label className="sm:col-span-2">
                    <span className="flex items-center justify-between text-xs font-bold text-text-primary"><span>Professional bio</span><span className="font-medium text-text-muted">{bio.length}/1200</span></span>
                    <textarea value={bio} maxLength={1200} rows={7} onChange={(event) => setBio(event.target.value)} placeholder="Introduce your work, experience and career highlights in a few clear paragraphs." className={fieldClass} />
                  </label>
                  <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400"><Icon icon="logos:youtube-icon" width="22" /></span><div><p className="text-sm font-black text-text-primary">Connect your YouTube channel</p><p className="mt-1 text-xs leading-5 text-text-muted">Enter a channel link, @handle or channel ID. MuviDB previews it now and starts syncing analytics after approval.</p></div></div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={youtubeInput} onChange={(event) => setYoutubeInput(event.target.value)} placeholder="https://youtube.com/@yourchannel" className={`${fieldClass} mt-0 flex-1`} /><button type="button" disabled={checkingYoutube} onClick={checkYoutube} className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-xs font-black text-red-400 disabled:opacity-50">{checkingYoutube ? 'Checking…' : 'Preview channel'}</button></div>
                    {youtubePreview && <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[.03] p-4"><img src={youtubePreview.thumbnail || '/images/person-placeholder.png'} alt="" className="h-12 w-12 rounded-full object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-text-primary">{youtubePreview.title || youtubePreview.handle || 'Connected channel'}</p><p className="mt-1 text-[10px] text-text-muted">{formatViewCount(youtubePreview.subscribers || 0)} subscribers · {formatViewCount(youtubePreview.views || 0)} channel views · {formatViewCount(youtubePreview.videos || 0)} videos</p></div><Icon icon="solar:verified-check-bold" width="22" className="text-emerald-400" /></div>}
                  </div>
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-[11px] leading-5 text-text-muted"><Icon icon="solar:shield-check-linear" className="mr-1 inline text-brand" /> Your public profile remains unchanged until an editor approves this request.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-3 text-xs font-black text-text-primary">Cancel</button>
                    <button disabled={saving} className="rounded-xl bg-brand px-5 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? 'Sending update…' : 'Send for review'}</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Industry Specs & Employability Dossier */
            <div className="space-y-8">
              <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 text-xs text-text-secondary">
                <p className="font-bold text-white flex items-center gap-2">
                  <Icon icon="solar:info-circle-bold" className="text-brand" width="18" />
                  Industry Standard Employability & Casting Dossier
                </p>
                <p className="mt-1 leading-relaxed">
                  These details power casting directors, showrunners, heads of department, and production companies searching for talent and crew across Nollywood and international productions.
                </p>
              </div>

              {/* Department / Discipline Switcher */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Primary Discipline / Department
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRO_DEPARTMENTS.map((dept) => {
                    const isSelected = (casting.department || 'Acting') === dept.value;
                    return (
                      <button
                        key={dept.value}
                        type="button"
                        onClick={() => setCasting((c) => ({ ...c, department: dept.value }))}
                        className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all text-left border ${
                          isSelected
                            ? 'border-brand bg-brand/10 text-brand shadow-sm shadow-brand/10'
                            : 'border-border bg-surface-2 text-text-muted hover:border-border-subtle hover:text-white'
                        }`}
                      >
                        <Icon icon={dept.icon} width="16" className="flex-shrink-0" />
                        <span className="truncate">{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Physical Dimensions (For Actors & Performers) */}
              {(casting.department || 'Acting') === 'Acting' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <Icon icon="solar:ruler-bold" className="text-brand" width="16" />
                    Physical Attributes & Build (Actor Casting)
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label>
                      <span className="text-xs font-bold text-text-primary">Height (Feet & Inches)</span>
                      <input
                        type="text"
                        value={casting.height_feet_inches || ''}
                        placeholder="e.g. 5' 9&quot;"
                        onChange={(e) => setCasting((c) => ({ ...c, height_feet_inches: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Height (cm)</span>
                      <input
                        type="number"
                        value={casting.height_cm || ''}
                        placeholder="e.g. 175"
                        onChange={(e) => setCasting((c) => ({ ...c, height_cm: e.target.value ? Number(e.target.value) : '' }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Body Type</span>
                      <select
                        value={casting.body_type || ''}
                        onChange={(e) => setCasting((c) => ({ ...c, body_type: e.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Select body type</option>
                        {BODY_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Skin Tone</span>
                      <select
                        value={casting.skin_tone || ''}
                        onChange={(e) => setCasting((c) => ({ ...c, skin_tone: e.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Select skin tone</option>
                        {SKIN_TONE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Hair Color</span>
                      <select
                        value={casting.hair_color || ''}
                        onChange={(e) => setCasting((c) => ({ ...c, hair_color: e.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Select hair color</option>
                        {HAIR_COLOR_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Eye Color</span>
                      <select
                        value={casting.eye_color || ''}
                        onChange={(e) => setCasting((c) => ({ ...c, eye_color: e.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Select eye color</option>
                        {EYE_COLOR_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label className="sm:col-span-2 lg:col-span-3">
                      <span className="text-xs font-bold text-text-primary">Distinguishing Features</span>
                      <input
                        type="text"
                        value={casting.distinguishing_features || ''}
                        placeholder="e.g. Left cheek dimple, athletic posture, scar on forearm"
                        onChange={(e) => setCasting((c) => ({ ...c, distinguishing_features: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Editing & Post-Production Specs */}
              {casting.department === 'Editing' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <Icon icon="solar:scissors-bold" className="text-brand" width="16" />
                    Editing Suites & Post-Production Skills
                  </h3>
                  <div className="grid gap-4">
                    <label>
                      <span className="text-xs font-bold text-text-primary">Software Suites & NLEs (Comma-separated)</span>
                      <input
                        type="text"
                        value={casting.software_tools_text || ''}
                        placeholder="e.g. DaVinci Resolve Studio, Adobe Premiere Pro, Avid Media Composer, After Effects"
                        onChange={(e) => setCasting((c) => ({ ...c, software_tools_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Post Specializations (Comma-separated)</span>
                      <input
                        type="text"
                        value={casting.craft_specializations_text || ''}
                        placeholder="e.g. Color Grading / DI, Offline Assembly, VFX Assembly, Sound Sync"
                        onChange={(e) => setCasting((c) => ({ ...c, craft_specializations_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Workstation Hardware Setup</span>
                      <input
                        type="text"
                        value={casting.equipment_gear_text || ''}
                        placeholder="e.g. Apple Silicon M3 Max, Blackmagic Mini Panel, calibrated 4K monitor"
                        onChange={(e) => setCasting((c) => ({ ...c, equipment_gear_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Costume & Wardrobe Specs */}
              {casting.department === 'Costume' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <Icon icon="solar:hanger-bold" className="text-brand" width="16" />
                    Costume Design, Styling & Wardrobe Kit
                  </h3>
                  <div className="grid gap-4">
                    <label>
                      <span className="text-xs font-bold text-text-primary">Costume & Period Specializations (Comma-separated)</span>
                      <input
                        type="text"
                        value={casting.craft_specializations_text || ''}
                        placeholder="e.g. Indigenous Yoruba / Igbo / Hausa Regalia, Historical Period Costuming, Contemporary Styling"
                        onChange={(e) => setCasting((c) => ({ ...c, craft_specializations_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Technical Wardrobe Skills (Comma-separated)</span>
                      <input
                        type="text"
                        value={casting.skills_text || ''}
                        placeholder="e.g. Textile Distressing, Pattern Drafting, Continuity Tracking, Aso-Oke Sourcing"
                        onChange={(e) => setCasting((c) => ({ ...c, skills_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Camera & Cinematography Specs */}
              {casting.department === 'Camera' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <Icon icon="solar:videocamera-record-bold" className="text-brand" width="16" />
                    Camera Systems, Lenses & Rigging
                  </h3>
                  <div className="grid gap-4">
                    <label>
                      <span className="text-xs font-bold text-text-primary">Owned / Preferred Camera Packages</span>
                      <input
                        type="text"
                        value={casting.equipment_gear_text || ''}
                        placeholder="e.g. ARRI Alexa Mini LF, RED V-Raptor, Sony FX6 / Venice, Cine Primes"
                        onChange={(e) => setCasting((c) => ({ ...c, equipment_gear_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Lensing & Motion Specializations</span>
                      <input
                        type="text"
                        value={casting.craft_specializations_text || ''}
                        placeholder="e.g. Anamorphic Glass, Steadicam, Ronin 2, Drone / Aerial Cinematography"
                        onChange={(e) => setCasting((c) => ({ ...c, craft_specializations_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Sound & Audio Specs */}
              {casting.department === 'Sound' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <Icon icon="solar:headphones-round-sound-bold" className="text-brand" width="16" />
                    Sound Recording, DAWs & Audio Engineering
                  </h3>
                  <div className="grid gap-4">
                    <label>
                      <span className="text-xs font-bold text-text-primary">DAWs & Audio Software (Comma-separated)</span>
                      <input
                        type="text"
                        value={casting.software_tools_text || ''}
                        placeholder="e.g. Pro Tools Ultimate, iZotope RX, Logic Pro, Dolby Atmos"
                        onChange={(e) => setCasting((c) => ({ ...c, software_tools_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-text-primary">Field Recording & Studio Kits</span>
                      <input
                        type="text"
                        value={casting.equipment_gear_text || ''}
                        placeholder="e.g. Sound Devices 833, Schoeps CMIT 5U, Wisycom wireless systems, Sennheiser 416"
                        onChange={(e) => setCasting((c) => ({ ...c, equipment_gear_text: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Casting Age & Representation */}
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Icon icon="solar:users-group-rounded-bold" className="text-brand" width="16" />
                  Playing Age Range & Base Location
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label>
                    <span className="text-xs font-bold text-text-primary">Playing Age (Min)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={casting.playing_age_min ?? ''}
                      placeholder="e.g. 24"
                      onChange={(e) => setCasting((c) => ({ ...c, playing_age_min: e.target.value ? Number(e.target.value) : '' }))}
                      className={fieldClass}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold text-text-primary">Playing Age (Max)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={casting.playing_age_max ?? ''}
                      placeholder="e.g. 35"
                      onChange={(e) => setCasting((c) => ({ ...c, playing_age_max: e.target.value ? Number(e.target.value) : '' }))}
                      className={fieldClass}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold text-text-primary">Primary Base / Location</span>
                    <input
                      type="text"
                      value={casting.location || ''}
                      placeholder="e.g. Lagos, Nigeria"
                      onChange={(e) => setCasting((c) => ({ ...c, location: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                  <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={casting.willing_to_travel ?? true}
                        onChange={(e) => setCasting((c) => ({ ...c, willing_to_travel: e.target.checked }))}
                        className="h-4 w-4 rounded border-border bg-surface-2 text-brand focus:ring-brand/20"
                      />
                      <span className="text-xs font-bold text-text-primary">Willing to travel for domestic & international shoots</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Skills, Disciplines & Experience */}
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Icon icon="solar:stars-bold" className="text-brand" width="16" />
                  Skills, Languages & Experience
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-bold text-text-primary">Experience Level</span>
                    <select
                      value={casting.experience_level || 'Professional'}
                      onChange={(e) => setCasting((c) => ({ ...c, experience_level: e.target.value }))}
                      className={fieldClass}
                    >
                      {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-bold text-text-primary">Current Availability</span>
                    <select
                      value={casting.availability_status || 'Available for Bookings'}
                      onChange={(e) => setCasting((c) => ({ ...c, availability_status: e.target.value }))}
                      className={fieldClass}
                    >
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold text-text-primary">Languages & Accents (Comma-separated)</span>
                    <input
                      type="text"
                      value={casting.languages_text || ''}
                      placeholder="e.g. English, Yoruba, Nigerian Pidgin, British RP, Igbo"
                      onChange={(e) => setCasting((c) => ({ ...c, languages_text: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold text-text-primary">Key Skills & Performance Talents (Comma-separated)</span>
                    <input
                      type="text"
                      value={casting.skills_text || ''}
                      placeholder="e.g. Stage Combat, Stunts, Voice Acting, Singing, Martial Arts, Stunt Driving"
                      onChange={(e) => setCasting((c) => ({ ...c, skills_text: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold text-text-primary">Roles & Production Preferences</span>
                    <textarea
                      rows={2}
                      value={casting.preferences || ''}
                      placeholder="e.g. Open to Feature Films, High-End TV Drama, Lead / Supporting Roles."
                      onChange={(e) => setCasting((c) => ({ ...c, preferences: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                </div>
              </div>

              {/* Public Display Controls */}
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Icon icon="solar:eye-bold" className="text-brand" width="16" />
                  Public Visibility
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4 cursor-pointer hover:bg-white/[.04]">
                    <input
                      type="checkbox"
                      checked={casting.show_on_creator_link ?? true}
                      onChange={(e) => setCasting((c) => ({ ...c, show_on_creator_link: e.target.checked }))}
                      className="h-4 w-4 rounded border-border bg-surface-2 text-brand focus:ring-brand/20"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Display on Creator Link Dossier</span>
                      <span className="text-[10px] text-text-muted">Shows on your verified /portfolio/:handle page under Casting Specs</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4 cursor-pointer hover:bg-white/[.04]">
                    <input
                      type="checkbox"
                      checked={casting.show_on_person_page ?? true}
                      onChange={(e) => setCasting((c) => ({ ...c, show_on_person_page: e.target.checked }))}
                      className="h-4 w-4 rounded border-border bg-surface-2 text-brand focus:ring-brand/20"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Display on MuviDB Profile</span>
                      <span className="text-[10px] text-text-muted">Shows on your official MuviDB person page</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer for Casting Tab */}
              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-[11px] leading-5 text-text-muted">
                  <Icon icon="solar:shield-check-linear" className="mr-1 inline text-brand" />
                  Casting specifications update immediately on your Creator Link and profile.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-3 text-xs font-black text-text-primary">Cancel</button>
                  <button disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-xs font-black text-white disabled:opacity-50 hover:bg-brand-light transition">
                    {saving ? 'Saving Specs…' : 'Save Casting Specs'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
