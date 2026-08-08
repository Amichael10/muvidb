import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { normalizeApplicationForm } from '../lib/jobApplicationForm';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function JobApplicationForm({ jobId, jobTitle, applicationForm }) {
  const schema = useMemo(() => normalizeApplicationForm(applicationForm), [applicationForm]);
  const [values, setValues] = useState(() => {
    const init = {};
    for (const f of schema.fields) {
      if (f.type !== 'file') init[f.id] = '';
    }
    return init;
  });
  const [files, setFiles] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setValue = (id, value) => setValues((prev) => ({ ...prev, [id]: value }));

  const onFileChange = (field, e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[field.id];
        return next;
      });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error(`${field.label} must be under 3 MB`);
      e.target.value = '';
      return;
    }
    setFiles((prev) => ({ ...prev, [field.id]: file }));
  };

  const submit = async (e) => {
    e.preventDefault();
    for (const field of schema.fields) {
      if (!field.required) continue;
      if (field.type === 'file') {
        if (!files[field.id]) {
          toast.error(`Please attach: ${field.label}`);
          return;
        }
      } else if (!String(values[field.id] || '').trim()) {
        toast.error(`Please fill in: ${field.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const filePayload = [];
      for (const field of schema.fields) {
        if (field.type !== 'file' || !files[field.id]) continue;
        const file = files[field.id];
        filePayload.push({
          field_id: field.id,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          base64: await fileToBase64(file),
        });
      }

      const res = await fetch('/api/job-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          answers: values,
          files: filePayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
      toast.success('Application submitted');
    } catch (err) {
      toast.error(err.message || 'Could not submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <Icon icon="solar:check-circle-bold" className="text-4xl text-brand mx-auto mb-3" />
        <h3 className="text-xl font-heading font-bold mb-2">Application received</h3>
        <p className="text-text-muted text-sm">
          Thanks for applying to {jobTitle}. We will review your submission and be in touch if there
          is a fit.
        </p>
      </div>
    );
  }

  if (!schema.fields.length) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-muted text-sm">
        Applications are not open for this role yet.
      </div>
    );
  }

  const fieldClass =
    'w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5';

  return (
    <form onSubmit={submit} className="bg-surface border border-border rounded-xl p-6 md:p-8 space-y-5">
      <div>
        <h2 className="text-2xl font-heading font-bold text-text-primary">Apply for this role</h2>
        <p className="text-sm text-text-muted mt-1">
          Complete the fields below. Required items are marked with *.
        </p>
      </div>

      {schema.fields.map((field) => (
        <div key={field.id}>
          <label className={labelClass}>
            {field.label}
            {field.required ? ' *' : ''}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              required={field.required}
              rows={4}
              value={values[field.id] || ''}
              onChange={(e) => setValue(field.id, e.target.value)}
              className={fieldClass}
              placeholder={field.placeholder || ''}
            />
          ) : field.type === 'file' ? (
            <>
              <input
                type="file"
                required={field.required}
                accept={field.accept || undefined}
                onChange={(e) => onFileChange(field, e)}
                className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand/10 file:text-brand file:font-bold file:text-xs file:uppercase"
              />
              {files[field.id] && (
                <p className="mt-2 text-xs text-text-muted">
                  Selected: {files[field.id].name} ({Math.round(files[field.id].size / 1024)} KB)
                </p>
              )}
            </>
          ) : (
            <input
              required={field.required}
              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
              value={values[field.id] || ''}
              onChange={(e) => setValue(field.id, e.target.value)}
              className={fieldClass}
              placeholder={field.placeholder || ''}
            />
          )}
          {field.help && <p className="mt-1.5 text-[11px] text-text-muted">{field.help}</p>}
        </div>
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all"
      >
        {submitting ? (
          <>
            <Icon icon="solar:refresh-linear" className="text-lg animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Icon icon="solar:letter-linear" className="text-lg" />
            Submit application
          </>
        )}
      </button>
    </form>
  );
}
