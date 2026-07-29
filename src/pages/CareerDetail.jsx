import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import MarkdownBody from '../components/MarkdownBody';
import JobApplicationForm from '../components/JobApplicationForm';
import { EMPLOYMENT_LABELS } from './Careers';

export default function CareerDetail() {
  const { slug } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data, error } = await supabase
        .from('job_postings')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setJob(null);
        document.title = 'Role not found | MuviDB';
      } else {
        setJob(data);
        document.title = `${data.title} | Careers | MuviDB`;
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text-primary">
        <div className="max-w-3xl mx-auto px-4 py-32 space-y-4">
          <div className="h-8 w-40 bg-surface rounded animate-pulse" />
          <div className="h-14 w-3/4 bg-surface rounded animate-pulse" />
          <div className="h-64 bg-surface rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-bg text-text-primary">
        <div className="max-w-3xl mx-auto px-4 py-32 text-center">
          <h1 className="text-3xl font-heading font-black mb-4">Role not found</h1>
          <p className="text-text-muted mb-8">This job posting is closed or does not exist.</p>
          <Link to="/careers" className="text-brand font-bold hover:underline">
            ← Back to careers
          </Link>
        </div>
      </div>
    );
  }

  const scrollToApply = () => {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-3xl mx-auto px-4 py-32">
        <Link
          to="/careers"
          className="inline-flex items-center gap-1 text-sm font-bold text-text-muted hover:text-brand mb-8 transition-colors"
        >
          <Icon icon="solar:arrow-left-linear" className="text-lg" />
          All roles
        </Link>

        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand mb-3">
          {job.department || 'MuviDB'}
        </p>
        <h1 className="text-3xl md:text-5xl font-heading font-black tracking-tighter mb-6">
          {job.title}
        </h1>

        <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted mb-4">
          {job.location && (
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border">{job.location}</span>
          )}
          {job.employment_type && (
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border">
              {EMPLOYMENT_LABELS[job.employment_type] || job.employment_type}
            </span>
          )}
          {job.experience_level && (
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border">{job.experience_level}</span>
          )}
        </div>

        {job.salary_text && (
          <p className="text-base text-text-primary font-medium mb-8">{job.salary_text}</p>
        )}

        <div className="mb-12">
          <button
            type="button"
            onClick={scrollToApply}
            className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all"
          >
            <Icon icon="solar:letter-linear" className="text-lg" />
            Apply for this role
          </button>
        </div>

        <MarkdownBody source={job.description_md} />

        <div id="apply-form" className="mt-14 pt-10 border-t border-border scroll-mt-24">
          <JobApplicationForm
            jobId={job.id}
            jobTitle={job.title}
            applicationForm={job.application_form}
          />
        </div>
      </div>
    </div>
  );
}
