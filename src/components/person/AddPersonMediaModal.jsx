import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

const VIDEO_CATEGORIES = [
  { value: 'showreel', label: 'Showreel / Demo Reel' },
  { value: 'monologue', label: 'Monologue / Audition Tape' },
  { value: 'scene_clip', label: 'Scene Clip' },
  { value: 'interview', label: 'Interview / Press' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'red_carpet', label: 'Red Carpet / Premiere' },
];

const PHOTO_CATEGORIES = [
  { value: 'headshot', label: 'Headshot / Portrait' },
  { value: 'production_still', label: 'Production Still' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'red_carpet', label: 'Red Carpet / Event' },
];

export default function AddPersonMediaModal({
  person,
  initialType = 'video',
  onClose,
  onMediaAdded,
}) {
  const { user } = useAuth();
  const [mediaType, setMediaType] = useState(initialType);
  const [category, setCategory] = useState(
    initialType === 'video' ? 'showreel' : 'headshot'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [filmId, setFilmId] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [photographerCredit, setPhotographerCredit] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse YouTube or Vimeo URL for helper auto-fill
  const handleUrlChange = (val) => {
    setUrl(val);
    if (!thumbnailUrl && (val.includes('youtube.com') || val.includes('youtu.be'))) {
      const match = val.match(/(?:v=|youtu\.be\/)([^&?]+)/);
      if (match && match[1]) {
        setThumbnailUrl(`https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`);
      }
    }
  };

  const handleTypeSwitch = (type) => {
    setMediaType(type);
    setCategory(type === 'video' ? 'showreel' : 'headshot');
  };

  const parseDurationToSeconds = (str) => {
    if (!str) return null;
    if (str.includes(':')) {
      const parts = str.split(':').map((p) => parseInt(p, 10));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title for the media');
      return;
    }
    if (!url.trim()) {
      toast.error('Please enter a media URL');
      return;
    }

    try {
      setIsSubmitting(true);

      let embedProvider = null;
      let embedId = null;

      if (mediaType === 'video') {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          embedProvider = 'youtube';
          const match = url.match(/(?:v=|youtu\.be\/)([^&?]+)/);
          if (match) embedId = match[1];
        } else if (url.includes('vimeo.com')) {
          embedProvider = 'vimeo';
          const match = url.match(/vimeo\.com\/(\d+)/);
          if (match) embedId = match[1];
        } else {
          embedProvider = 'external';
        }
      }

      const durationSeconds = parseDurationToSeconds(durationStr);

      const payload = {
        person_id: person.id,
        media_type: mediaType,
        category,
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim(),
        thumbnail_url: thumbnailUrl.trim() || null,
        embed_provider: embedProvider,
        embed_id: embedId,
        duration_seconds: durationSeconds,
        film_id: filmId || null,
        character_name: characterName.trim() || null,
        photographer_credit: photographerCredit.trim() || null,
        year: year ? parseInt(year, 10) : null,
        status: 'approved',
        uploaded_by: user?.id || null,
      };

      const { data, error } = await supabase
        .from('person_media')
        .insert(payload)
        .select(`
          *,
          films ( id, title, year, poster_url, slug )
        `)
        .single();

      if (error) throw error;

      toast.success('Media added successfully!');
      onMediaAdded?.(data);
      onClose();
    } catch (err) {
      console.error('Error adding media:', err);
      toast.error(err.message || 'Failed to add media');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get list of actor's credited films for tagging
  const creditedFilms = (person.credits || [])
    .map((c) => c.films)
    .filter(Boolean)
    .filter((f, idx, arr) => arr.findIndex((x) => x.id === f.id) === idx);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/60">
          <div className="flex items-center gap-2">
            <Icon icon="solar:clapperboard-play-linear" className="text-brand text-xl" />
            <h3 className="font-heading font-bold text-lg text-text-primary">
              Add Media to Profile
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Media Type Switch */}
          <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleTypeSwitch('video')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                mediaType === 'video'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="solar:videocamera-record-bold" width="16" />
              <span>Video / Showreel</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('photo')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                mediaType === 'photo'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="solar:gallery-bold" width="16" />
              <span>Photo / Still</span>
            </button>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-colors"
            >
              {(mediaType === 'video' ? VIDEO_CATEGORIES : PHOTO_CATEGORIES).map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mediaType === 'video' ? 'e.g. 2026 Dramatic Showreel' : 'e.g. Premiere Red Carpet Portrait'}
              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
            />
          </div>

          {/* Media URL */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              {mediaType === 'video' ? 'Video URL (YouTube, Vimeo, or MP4)' : 'Photo Image URL'} *
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={mediaType === 'video' ? 'https://www.youtube.com/watch?v=...' : 'https://.../photo.jpg'}
              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
            />
          </div>

          {/* Video Specific: Thumbnail & Duration */}
          {mediaType === 'video' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Thumbnail URL (Optional)
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="Auto-detected for YouTube"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Duration (e.g. 2:15 or 135s)
                </label>
                <input
                  type="text"
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  placeholder="2:15"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Photo Specific: Photographer Credit */}
          {mediaType === 'photo' && (
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Photographer Credit (Optional)
              </label>
              <input
                type="text"
                value={photographerCredit}
                onChange={(e) => setPhotographerCredit(e.target.value)}
                placeholder="e.g. Kelechi Amadi-Obi"
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
              />
            </div>
          )}

          {/* Tagged Film & Character Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Tag to Movie (Optional)
              </label>
              <select
                value={filmId}
                onChange={(e) => setFilmId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-colors"
              >
                <option value="">None / Independent</option>
                {creditedFilms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} {f.year ? `(${f.year})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Character Name (Optional)
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g. Agent Bola"
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
              />
            </div>
          </div>

          {/* Year & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Description / Notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief contextual note"
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border hover:bg-surface-2 text-text-secondary text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-brand text-white hover:shadow-brand/20 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin text-base" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save to Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
