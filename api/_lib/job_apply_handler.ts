import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabase.js';
import { checkRateLimit } from './rateLimit.js';
import { getCorsHeaders } from './cors.js';

const MAX_FILE_BYTES = 3 * 1024 * 1024;

const DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ZIP_TYPES = new Set(['application/zip', 'application/x-zip-compressed']);

type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  accept?: string;
};

function cors(req: VercelRequest, res: VercelResponse) {
  const headers = getCorsHeaders(req);
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function trim(v: unknown, max = 5000): string {
  return String(v ?? '').trim().slice(0, max);
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function inferContentType(filename: string, declared: string): string {
  if (declared && declared !== 'application/octet-stream') return declared;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.zip')) return 'application/zip';
  return declared || 'application/octet-stream';
}

function acceptAllows(accept: string | undefined, contentType: string, filename: string): boolean {
  if (!accept || accept.trim() === '' || accept.includes('*/*')) {
    return DOC_TYPES.has(contentType) || IMAGE_TYPES.has(contentType) || ZIP_TYPES.has(contentType);
  }
  const parts = accept.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const name = filename.toLowerCase();
  for (const p of parts) {
    if (p.startsWith('.') && name.endsWith(p)) return true;
    if (p.endsWith('/*')) {
      const prefix = p.slice(0, -1); // e.g. image/
      if (contentType.startsWith(prefix)) return true;
    }
    if (p === contentType) return true;
  }
  // Extension fallback from accept list
  return false;
}

export async function handleJobApply(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return handleSignedFile(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (checkRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const jobId = trim(body.job_id, 80);
  if (!jobId) return res.status(400).json({ error: 'Missing job_id' });

  const { data: job, error: jobErr } = await supabase
    .from('job_postings')
    .select('id, title, is_published, application_form')
    .eq('id', jobId)
    .eq('is_published', true)
    .maybeSingle();

  if (jobErr || !job) {
    return res.status(404).json({ error: 'This role is not open for applications.' });
  }

  const fields: FormField[] = Array.isArray(job.application_form?.fields)
    ? job.application_form.fields
    : [];
  if (!fields.length) {
    return res.status(500).json({ error: 'This role has no application form configured.' });
  }

  const answersIn = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const filesIn = Array.isArray(body.files) ? body.files : [];
  const filesByField = new Map<string, any>();
  for (const f of filesIn) {
    if (f?.field_id) filesByField.set(String(f.field_id), f);
  }

  const applicationId = randomUUID();
  const answers: Record<string, unknown> = {};
  let fullName = '';
  let email = '';
  let phone: string | null = null;
  let primaryResumePath: string | null = null;
  let primaryResumeFilename: string | null = null;
  let primaryResumeContentType: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    for (const field of fields) {
      const id = String(field.id);
      const label = field.label || id;

      if (field.type === 'file') {
        const file = filesByField.get(id);
        if (!file || !file.base64) {
          if (field.required) {
            return res.status(400).json({ error: `Please attach: ${label}` });
          }
          continue;
        }
        const filename = trim(file.filename || 'upload.bin', 200) || 'upload.bin';
        let contentType = inferContentType(filename, trim(file.content_type || '', 120));
        if (!acceptAllows(field.accept, contentType, filename)) {
          return res.status(400).json({ error: `Unsupported file type for ${label}` });
        }
        const raw = String(file.base64).includes(',')
          ? String(file.base64).split(',')[1]
          : String(file.base64);
        const buf = Buffer.from(raw, 'base64');
        if (!buf.length || buf.byteLength > MAX_FILE_BYTES) {
          return res.status(400).json({ error: `${label} must be under 3 MB` });
        }
        const ext = filename.includes('.')
          ? filename.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
          : 'bin';
        const path = `${jobId}/${applicationId}/${id}.${ext || 'bin'}`;
        const { error: upErr } = await supabase.storage.from('job-resumes').upload(path, buf, {
          contentType,
          upsert: false,
        });
        if (upErr) {
          console.error('file upload', upErr);
          throw new Error(`Could not upload ${label}`);
        }
        uploadedPaths.push(path);
        answers[id] = { path, filename, content_type: contentType };
        if (!primaryResumePath) {
          primaryResumePath = path;
          primaryResumeFilename = filename;
          primaryResumeContentType = contentType;
        }
        continue;
      }

      const value = trim(answersIn[id], field.type === 'textarea' ? 8000 : 2000);
      if (!value) {
        if (field.required) {
          return res.status(400).json({ error: `Missing required field: ${label}` });
        }
        continue;
      }
      if (field.type === 'email') {
        if (!isEmail(value)) {
          return res.status(400).json({ error: `Please enter a valid email for ${label}` });
        }
        if (!email) email = value.toLowerCase();
      }
      if (id === 'full_name' || id === 'name') fullName = value;
      if (id === 'email' && isEmail(value)) email = value.toLowerCase();
      if (id === 'phone' || field.type === 'phone') phone = value;
      answers[id] = value;
    }

    // Fallback identity from common ids
    if (!fullName) fullName = trim(answers.full_name || answers.name, 200);
    if (!email) {
      const maybe = trim(answers.email, 320);
      if (isEmail(maybe)) email = maybe.toLowerCase();
    }
    if (!fullName || !email) {
      return res.status(400).json({
        error: 'Application form must include a name and email field (or values for full_name / email).',
      });
    }

    const { error: insErr } = await supabase.from('job_applications').insert({
      id: applicationId,
      job_id: jobId,
      full_name: fullName.slice(0, 200),
      email: email.slice(0, 320),
      phone,
      answers,
      resume_path: primaryResumePath,
      resume_filename: primaryResumeFilename,
      resume_content_type: primaryResumeContentType,
      // legacy columns left null
      introduction: null,
      social_links: null,
      portfolio_links: null,
      content_idea: null,
      location: typeof answers.location === 'string' ? answers.location : null,
      availability: typeof answers.availability === 'string' ? answers.availability : null,
      status: 'new',
    });

    if (insErr) {
      console.error('application insert', insErr);
      throw new Error('Could not submit application. Please try again.');
    }

    return res.status(201).json({ ok: true, id: applicationId });
  } catch (err: any) {
    if (uploadedPaths.length) {
      await supabase.storage.from('job-resumes').remove(uploadedPaths).catch(() => {});
    }
    return res.status(500).json({ error: err?.message || 'Submission failed' });
  }
}

async function handleSignedFile(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const applicationId = String(req.query.application_id || '').trim();
  const fieldId = String(req.query.field_id || '').trim();
  if (!applicationId) return res.status(400).json({ error: 'application_id required' });

  const userClient = (await import('@supabase/supabase-js')).createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { data: app } = await supabase
    .from('job_applications')
    .select('resume_path, resume_filename, answers')
    .eq('id', applicationId)
    .maybeSingle();
  if (!app) return res.status(404).json({ error: 'Not found' });

  let path = app.resume_path;
  let filename = app.resume_filename;
  if (fieldId && app.answers?.[fieldId]?.path) {
    path = app.answers[fieldId].path;
    filename = app.answers[fieldId].filename || filename;
  }
  if (!path) return res.status(404).json({ error: 'File not found' });

  const { data: signed, error } = await supabase.storage.from('job-resumes').createSignedUrl(path, 600);
  if (error || !signed?.signedUrl) {
    return res.status(500).json({ error: 'Could not create download link' });
  }
  return res.status(200).json({ url: signed.signedUrl, filename });
}
