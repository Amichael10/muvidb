/**
 * Per-job application form schema.
 * Stored on job_postings.application_form as { fields: Field[] }.
 */

export const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'url', label: 'URL / link' },
  { value: 'file', label: 'File attachment' },
];

/** Default form used for new jobs (and the seeded Social Media role). */
export const DEFAULT_APPLICATION_FORM = {
  fields: [
    { id: 'full_name', label: 'Full name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'phone', label: 'Phone', type: 'phone', required: false, placeholder: 'Optional' },
    { id: 'location', label: 'Current location', type: 'text', required: true, placeholder: 'City, country' },
    { id: 'availability', label: 'Availability', type: 'text', required: true, placeholder: 'e.g. Available immediately' },
    {
      id: 'introduction',
      label: 'Short introduction',
      type: 'textarea',
      required: true,
      placeholder: 'Why you’re interested in this role and MuviDB',
    },
    {
      id: 'social_links',
      label: 'Social accounts you manage',
      type: 'textarea',
      required: true,
      placeholder: 'Links to TikTok, Instagram, X accounts…',
    },
    {
      id: 'portfolio_links',
      label: 'Portfolio examples',
      type: 'textarea',
      required: true,
      placeholder: '2–3 links to graphics or short videos',
    },
    {
      id: 'content_idea',
      label: 'Sample MuviDB content idea',
      type: 'textarea',
      required: true,
      placeholder: 'A sample Instagram post or TikTok idea',
    },
    {
      id: 'resume',
      label: 'Resume',
      type: 'file',
      required: true,
      accept: '.pdf,.doc,.docx',
      help: 'PDF or Word, max 3 MB',
    },
  ],
};

export function normalizeApplicationForm(raw) {
  const fields = Array.isArray(raw?.fields) ? raw.fields : DEFAULT_APPLICATION_FORM.fields;
  return {
    fields: fields
      .filter((f) => f && f.id && f.label && f.type)
      .map((f) => ({
        id: String(f.id).slice(0, 64),
        label: String(f.label).slice(0, 200),
        type: FIELD_TYPES.some((t) => t.value === f.type) ? f.type : 'text',
        required: !!f.required,
        placeholder: f.placeholder ? String(f.placeholder).slice(0, 300) : '',
        help: f.help ? String(f.help).slice(0, 300) : '',
        accept: f.accept ? String(f.accept).slice(0, 200) : f.type === 'file' ? '.pdf,.doc,.docx' : '',
      })),
  };
}

export function newFieldId(label = 'field') {
  const base = String(label || 'field')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'field';
  return `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

export function blankField(type = 'text') {
  return {
    id: newFieldId(type),
    label: type === 'file' ? 'Attachment' : 'New question',
    type,
    required: false,
    placeholder: '',
    help: type === 'file' ? 'Max 3 MB' : '',
    accept: type === 'file' ? '.pdf,.doc,.docx' : '',
  };
}
