import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
  DEFAULT_APPLICATION_FORM,
  FIELD_TYPES,
  blankField,
  normalizeApplicationForm,
} from '../../lib/jobApplicationForm';

const EMPTY = {
  id: null,
  slug: '',
  title: '',
  department: '',
  location: 'Remote',
  employment_type: 'full_time',
  experience_level: '',
  salary_text: '',
  description_md: '',
  apply_email: 'careers@muvidb.com',
  apply_url: '',
  is_published: false,
  sort_order: 0,
  application_form: DEFAULT_APPLICATION_FORM,
};

const EMPLOYMENT_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function isFileAnswer(value) {
  return value && typeof value === 'object' && typeof value.path === 'string';
}

function ApplicationAnswersView({ app, onDownloadFile }) {
  const schema = normalizeApplicationForm(app.job_postings?.application_form);
  const answers = app.answers && typeof app.answers === 'object' ? app.answers : null;
  const skipIds = new Set(['full_name', 'email', 'phone']);

  if (answers && Object.keys(answers).length > 0) {
    const shown = new Set();
    const rows = [];

    for (const field of schema.fields) {
      if (skipIds.has(field.id)) continue;
      const value = answers[field.id];
      if (value == null || value === '') continue;
      shown.add(field.id);
      rows.push({ id: field.id, label: field.label, value, isFile: field.type === 'file' || isFileAnswer(value) });
    }

    for (const [id, value] of Object.entries(answers)) {
      if (shown.has(id) || skipIds.has(id) || value == null || value === '') continue;
      rows.push({
        id,
        label: id.replace(/_/g, ' '),
        value,
        isFile: isFileAnswer(value),
      });
    }

    if (!rows.length && !app.resume_path) {
      return <p className="text-text-muted">No additional answers.</p>;
    }

    return (
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{row.label}</div>
            {row.isFile || isFileAnswer(row.value) ? (
              <button
                type="button"
                onClick={() => onDownloadFile(app, row.id)}
                className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold uppercase"
              >
                <Icon icon="solar:download-minimalistic-linear" className="text-lg" />
                {row.value?.filename || 'Download file'}
              </button>
            ) : (
              <p className="whitespace-pre-wrap">{String(row.value)}</p>
            )}
          </div>
        ))}
        {app.resume_path && !rows.some((r) => isFileAnswer(r.value) && r.value.path === app.resume_path) && (
          <button
            type="button"
            onClick={() => onDownloadFile(app)}
            className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold uppercase"
          >
            <Icon icon="solar:download-minimalistic-linear" className="text-lg" />
            Download resume
          </button>
        )}
      </div>
    );
  }

  // Legacy applications before dynamic forms
  return (
    <div className="space-y-4">
      {app.location && <p><span className="text-text-muted">Location:</span> {app.location}</p>}
      {app.availability && <p><span className="text-text-muted">Availability:</span> {app.availability}</p>}
      {app.introduction && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Introduction</div>
          <p className="whitespace-pre-wrap">{app.introduction}</p>
        </div>
      )}
      {app.social_links && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Social links</div>
          <p className="whitespace-pre-wrap">{app.social_links}</p>
        </div>
      )}
      {app.portfolio_links && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Portfolio</div>
          <p className="whitespace-pre-wrap">{app.portfolio_links}</p>
        </div>
      )}
      {app.content_idea && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Content idea</div>
          <p className="whitespace-pre-wrap">{app.content_idea}</p>
        </div>
      )}
      {app.resume_path && (
        <button
          type="button"
          onClick={() => onDownloadFile(app)}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold uppercase"
        >
          <Icon icon="solar:download-minimalistic-linear" className="text-lg" />
          Download resume
        </button>
      )}
    </div>
  );
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tab, setTab] = useState('jobs'); // jobs | applications
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (tab === 'applications') fetchApplications();
  }, [tab]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .order('sort_order', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) toast.error(error.message);
    setJobs(data || []);
    setLoading(false);
  };

  const fetchApplications = async () => {
    setAppsLoading(true);
    const { data, error } = await supabase
      .from('job_applications')
      .select('*, job_postings(title, slug, application_form)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setApplications(data || []);
    setAppsLoading(false);
  };

  const setAppStatus = async (app, status) => {
    const { error } = await supabase
      .from('job_applications')
      .update({ status })
      .eq('id', app.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked ${status}`);
      fetchApplications();
      if (selectedApp?.id === app.id) setSelectedApp({ ...selectedApp, status });
    }
  };

  const downloadResume = async (app, fieldId = null) => {
    let path = app.resume_path;
    if (fieldId && app.answers?.[fieldId]?.path) path = app.answers[fieldId].path;
    if (!path && app.answers && typeof app.answers === 'object') {
      for (const v of Object.values(app.answers)) {
        if (v && typeof v === 'object' && v.path) {
          path = v.path;
          break;
        }
      }
    }
    if (!path) {
      toast.error('No file on record');
      return;
    }
    const { data, error } = await supabase.storage
      .from('job-resumes')
      .createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Could not get file link');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const updateFormField = (index, patch) => {
    setForm((prev) => {
      const fields = [...(prev.application_form?.fields || [])];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, application_form: { fields } };
    });
  };

  const removeFormField = (index) => {
    setForm((prev) => {
      const fields = [...(prev.application_form?.fields || [])];
      fields.splice(index, 1);
      return { ...prev, application_form: { fields } };
    });
  };

  const addFormField = (type = 'text') => {
    setForm((prev) => ({
      ...prev,
      application_form: {
        fields: [...(prev.application_form?.fields || []), blankField(type)],
      },
    }));
  };

  const moveFormField = (index, dir) => {
    setForm((prev) => {
      const fields = [...(prev.application_form?.fields || [])];
      const next = index + dir;
      if (next < 0 || next >= fields.length) return prev;
      [fields[index], fields[next]] = [fields[next], fields[index]];
      return { ...prev, application_form: { fields } };
    });
  };

  const openCreate = () => {
    setForm({
      ...EMPTY,
      application_form: normalizeApplicationForm(DEFAULT_APPLICATION_FORM),
    });
    setSlugTouched(false);
    setModalOpen(true);
  };

  const openEdit = (job) => {
    setForm({
      id: job.id,
      slug: job.slug || '',
      title: job.title || '',
      department: job.department || '',
      location: job.location || '',
      employment_type: job.employment_type || 'full_time',
      experience_level: job.experience_level || '',
      salary_text: job.salary_text || '',
      description_md: job.description_md || '',
      apply_email: job.apply_email || '',
      apply_url: job.apply_url || '',
      is_published: !!job.is_published,
      sort_order: job.sort_order ?? 0,
      application_form: normalizeApplicationForm(job.application_form),
    });
    setSlugTouched(true);
    setModalOpen(true);
  };

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'title' && !slugTouched && !prev.id) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('Slug is required');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      department: form.department.trim() || null,
      location: form.location.trim() || null,
      employment_type: form.employment_type,
      experience_level: form.experience_level.trim() || null,
      salary_text: form.salary_text.trim() || null,
      description_md: form.description_md,
      apply_email: form.apply_email.trim() || null,
      apply_url: form.apply_url.trim() || null,
      is_published: form.is_published,
      sort_order: Number(form.sort_order) || 0,
      application_form: normalizeApplicationForm(form.application_form),
      updated_at: new Date().toISOString(),
      published_at: form.is_published
        ? (jobs.find((j) => j.id === form.id)?.published_at || new Date().toISOString())
        : null,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase.from('job_postings').update(payload).eq('id', form.id));
    } else {
      ({ error } = await supabase.from('job_postings').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? 'Job updated' : 'Job created');
    setModalOpen(false);
    fetchJobs();
  };

  const togglePublish = async (job) => {
    const next = !job.is_published;
    const { error } = await supabase
      .from('job_postings')
      .update({
        is_published: next,
        published_at: next ? (job.published_at || new Date().toISOString()) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next ? 'Published' : 'Unpublished');
      fetchJobs();
    }
  };

  const remove = async (job) => {
    if (!window.confirm(`Delete “${job.title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from('job_postings').delete().eq('id', job.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      fetchJobs();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black text-text-primary">Careers</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage public job postings at{' '}
            <a href="/careers" target="_blank" rel="noreferrer" className="text-brand hover:underline">
              /careers
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTab('jobs')}
              className={`px-3 py-2 ${tab === 'jobs' ? 'bg-brand text-white' : 'bg-surface text-text-muted'}`}
            >
              Postings
            </button>
            <button
              type="button"
              onClick={() => setTab('applications')}
              className={`px-3 py-2 ${tab === 'applications' ? 'bg-brand text-white' : 'bg-surface text-text-muted'}`}
            >
              Applications
            </button>
          </div>
          {tab === 'jobs' && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:brightness-110"
            >
              <Icon icon="solar:add-circle-linear" className="text-lg" />
              New job
            </button>
          )}
        </div>
      </div>

      {tab === 'applications' ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {appsLoading ? (
            <div className="p-10 text-center text-text-muted text-sm">Loading…</div>
          ) : applications.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-sm">No applications yet.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Applicant</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">Role</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-text-primary">{app.full_name}</div>
                      <div className="text-[11px] text-text-muted">{app.email}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {new Date(app.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden md:table-cell">
                      {app.job_postings?.title || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={app.status}
                        onChange={(e) => setAppStatus(app, e.target.value)}
                        className="bg-surface-2 border border-border rounded-md px-2 py-1 text-[11px] font-bold uppercase"
                      >
                        {['new', 'reviewing', 'shortlisted', 'rejected', 'hired'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="p-2 rounded-lg text-text-muted hover:text-brand hover:bg-surface-2"
                          title="View"
                        >
                          <Icon icon="solar:eye-linear" className="text-lg" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadResume(app)}
                          className="p-2 rounded-lg text-text-muted hover:text-brand hover:bg-surface-2"
                          title="Download resume"
                        >
                          <Icon icon="solar:download-minimalistic-linear" className="text-lg" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-text-muted text-sm">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center text-text-muted text-sm">No job postings yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold hidden md:table-cell">Location</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-text-primary">{job.title}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">/{job.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-text-muted hidden md:table-cell">{job.location || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => togglePublish(job)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
                        job.is_published
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-surface-2 text-text-muted border-border'
                      }`}
                    >
                      {job.is_published ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/careers/${job.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg text-text-muted hover:text-brand hover:bg-surface-2"
                        title="View public page"
                      >
                        <Icon icon="solar:eye-linear" className="text-lg" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openEdit(job)}
                        className="p-2 rounded-lg text-text-muted hover:text-brand hover:bg-surface-2"
                        title="Edit"
                      >
                        <Icon icon="solar:pen-linear" className="text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(job)}
                        className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-surface-2"
                        title="Delete"
                      >
                        <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/50">
          <div className="w-full max-w-2xl my-8 bg-surface border border-border rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-heading font-bold">{selectedApp.full_name}</h2>
              <button type="button" onClick={() => setSelectedApp(null)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-linear" className="text-2xl" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              <p><span className="text-text-muted">Role:</span> {selectedApp.job_postings?.title}</p>
              <p><span className="text-text-muted">Email:</span> <a className="text-brand" href={`mailto:${selectedApp.email}`}>{selectedApp.email}</a></p>
              {selectedApp.phone && <p><span className="text-text-muted">Phone:</span> {selectedApp.phone}</p>}
              <ApplicationAnswersView app={selectedApp} onDownloadFile={downloadResume} />
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/50">
          <form
            onSubmit={save}
            className="w-full max-w-3xl my-8 bg-surface border border-border rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-heading font-bold">
                {form.id ? 'Edit job' : 'New job'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-linear" className="text-2xl" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setField('slug', e.target.value);
                  }}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-brand"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Department</label>
                  <input
                    value={form.department}
                    onChange={(e) => setField('department', e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="Content, Engineering…"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Employment type</label>
                  <select
                    value={form.employment_type}
                    onChange={(e) => setField('employment_type', e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  >
                    {EMPLOYMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Experience level</label>
                  <input
                    value={form.experience_level}
                    onChange={(e) => setField('experience_level', e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="Entry level"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Salary</label>
                <input
                  value={form.salary_text}
                  onChange={(e) => setField('salary_text', e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="₦120,000 per month…"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Apply email</label>
                  <input
                    type="email"
                    value={form.apply_email}
                    onChange={(e) => setField('apply_email', e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Apply URL (optional)</label>
                  <input
                    value={form.apply_url}
                    onChange={(e) => setField('apply_url', e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="https://…"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  Description (Markdown)
                </label>
                <textarea
                  value={form.description_md}
                  onChange={(e) => setField('description_md', e.target.value)}
                  rows={16}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-brand leading-relaxed"
                  placeholder="## About…&#10;&#10;* Bullet points…"
                />
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Supports ## headings, ### subheadings, * lists, and **bold**.
                </p>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-heading font-bold">Application form</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Customize questions for this role. Choose short text, long text, email, URL, or file attachment.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addFormField('text')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-surface-2 border border-border hover:border-brand"
                    >
                      <Icon icon="solar:add-circle-linear" className="text-base" />
                      Text
                    </button>
                    <button
                      type="button"
                      onClick={() => addFormField('file')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-surface-2 border border-border hover:border-brand"
                    >
                      <Icon icon="solar:upload-linear" className="text-base" />
                      File
                    </button>
                  </div>
                </div>

                {(form.application_form?.fields || []).length === 0 ? (
                  <p className="text-sm text-text-muted py-4 text-center border border-dashed border-border rounded-xl">
                    No fields yet. Add text or file questions above.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(form.application_form?.fields || []).map((field, index) => (
                      <div key={field.id} className="bg-surface-2 border border-border rounded-xl p-3 space-y-3">
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Label</label>
                            <input
                              value={field.label}
                              onChange={(e) => updateFormField(index, { label: e.target.value })}
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                            />
                          </div>
                          <div className="w-[140px]">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Type</label>
                            <select
                              value={field.type}
                              onChange={(e) => {
                                const type = e.target.value;
                                updateFormField(index, {
                                  type,
                                  accept: type === 'file' ? (field.accept || '.pdf,.doc,.docx') : '',
                                  help: type === 'file' ? (field.help || 'Max 3 MB') : field.help,
                                });
                              }}
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <label className="inline-flex items-center gap-1.5 text-xs font-medium mt-5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) => updateFormField(index, { required: e.target.checked })}
                              className="rounded border-border"
                            />
                            Required
                          </label>
                          <div className="flex items-center gap-1 mt-4">
                            <button type="button" onClick={() => moveFormField(index, -1)} className="p-1.5 rounded-md text-text-muted hover:bg-surface" title="Move up">
                              <Icon icon="solar:alt-arrow-up-linear" />
                            </button>
                            <button type="button" onClick={() => moveFormField(index, 1)} className="p-1.5 rounded-md text-text-muted hover:bg-surface" title="Move down">
                              <Icon icon="solar:alt-arrow-down-linear" />
                            </button>
                            <button type="button" onClick={() => removeFormField(index)} className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-surface" title="Remove">
                              <Icon icon="solar:trash-bin-trash-linear" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Field id</label>
                            <input
                              value={field.id}
                              onChange={(e) => updateFormField(index, { id: e.target.value.replace(/[^a-z0-9_]/gi, '_').slice(0, 64) })}
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-brand"
                            />
                          </div>
                          {field.type === 'file' ? (
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Accept</label>
                              <input
                                value={field.accept || ''}
                                onChange={(e) => updateFormField(index, { accept: e.target.value })}
                                className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-brand"
                                placeholder=".pdf,.doc,.docx or image/*"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Placeholder</label>
                              <input
                                value={field.placeholder || ''}
                                onChange={(e) => updateFormField(index, { placeholder: e.target.value })}
                                className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Help text</label>
                          <input
                            value={field.help || ''}
                            onChange={(e) => updateFormField(index, { help: e.target.value })}
                            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                            placeholder="Shown under the field"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-text-muted">
                  Tip: keep one Email field and a name field (id <code className="font-mono">full_name</code>) so applications can be identified.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setField('is_published', e.target.checked)}
                    className="rounded border-border"
                  />
                  Published on /careers
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Sort</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setField('sort_order', e.target.value)}
                    className="w-20 bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-text-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-brand text-white hover:brightness-110 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save job'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
