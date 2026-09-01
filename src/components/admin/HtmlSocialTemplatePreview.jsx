const DEFAULT_HANDLE = '@muvidb_';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function templateData(candidate, templateSlug) {
  const source = candidate?.data || {};
  const poster = candidate?.imageUrl || source.poster_url || source.backdrop_url || '';
  const title = candidate?.name || source.title || 'MuviDB Pick';
  const synopsis = source.synopsis || candidate?.subtext || '';
  const genres = Array.isArray(source.genres) ? source.genres : [];
  const date = formatDate(source.release_date);

  if (templateSlug === 'on-stage-theatre-v1') {
    const venue = [source.venue, source.city].filter(Boolean).join(', ') || 'Theatre venue TBA';
    const start = formatDate(source.run_start_date);
    const end = formatDate(source.run_end_date);
    return { title, description: synopsis || `${title} is on stage soon. Save the date and follow MuviDB for the theatre run details.`, venue, date: start && end && start !== end ? `${start} - ${end}` : start || end || (source.year ? String(source.year) : 'Date TBA'), time: source.performance_time || 'Time TBA', poster, posterAlt: title, handle: DEFAULT_HANDLE };
  }
  if (templateSlug === 'critics-say-v1') return { poster, review: source.tagline || synopsis || `The conversation around ${title} is heating up.`, criticImage: '', criticName: 'MuviDB Critics', criticRole: 'African cinema review desk', rating: 4, ratingMax: 5, handle: DEFAULT_HANDLE };
  if (templateSlug === 'watchlist-this-week-v1') return { picks: [{ title, subtitle: source.year ? String(source.year) : '', poster, reason: source.watchAvailability || 'MuviDB pick', description: source.tagline || synopsis || 'Add this to your weekend watchlist.', platform: '', channelName: '' }], backPosters: [poster, source.backdrop_url].filter(Boolean), handle: DEFAULT_HANDLE };
  if (templateSlug === 'nollywood-debate-v1') return { poster, handle: DEFAULT_HANDLE };
  return { poster, badge: source.platformDisplayName || source.watchAvailability || (source.coming_soon ? 'Coming Soon' : 'Now Showing'), description: source.tagline || synopsis || title, feature1Title: title, feature1Subtitle: source.year ? String(source.year) : 'MuviDB pick', feature2Title: date || 'Release date TBA', feature2Subtitle: genres.slice(0, 2).join(' / ') || 'African cinema', feature3Title: source.topCast?.[0]?.name || 'On MuviDB', feature3Subtitle: source.watchAvailability || 'Track, rate, and save', handle: DEFAULT_HANDLE };
}

function encodeData(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export default function HtmlSocialTemplatePreview({ candidate, templateSlug }) {
  const data = encodeData(templateData(candidate, templateSlug));
  const params = new URLSearchParams({ render: '1', data });
  if (templateSlug === 'critics-say-v1') params.set('ratio', '1:1');
  return <iframe key={`${templateSlug}:${candidate?.id || candidate?.name || ''}`} title={`${candidate?.name || 'MuviDB'} social graphic preview`} src={`/social-templates/${templateSlug}.html?${params.toString()}`} sandbox="allow-scripts" className="h-full w-full border-0 bg-transparent" />;
}
