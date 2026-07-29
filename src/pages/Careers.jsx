import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';

const EMPLOYMENT_LABELS = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export default function Careers() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Careers | MuviDB';
    window.scrollTo(0, 0);
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, slug, title, department, location, employment_type, experience_level, salary_text, published_at')
        .eq('is_published', true)
        .order('sort_order', { ascending: false })
        .order('published_at', { ascending: false });
      if (!cancelled) {
        if (error) console.error(error);
        setJobs(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-4xl mx-auto px-4 py-32">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand mb-4">Careers</p>
        <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter mb-6">
          Join <span className="text-brand">MuviDB</span>
        </h1>
        <p className="text-lg text-text-muted leading-relaxed max-w-2xl mb-14">
          Help build the discovery platform for African film — from catalogue and product to content
          that gets audiences watching.
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-28 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-10 text-center">
            <Icon icon="solar:case-round-linear" className="text-4xl text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-heading font-bold mb-2">No open roles right now</h2>
            <p className="text-text-muted text-base mb-6">
              We are not hiring at the moment. Check back soon, or follow us for updates.
            </p>
            <a
              href="https://twitter.com/muvidb_"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand font-bold text-sm hover:underline"
            >
              Follow @muvidb_ on X
            </a>
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/careers/${job.slug}`}
                  className="block bg-surface border border-border hover:border-brand/50 rounded-xl p-6 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h2 className="text-xl md:text-2xl font-heading font-bold text-text-primary group-hover:text-brand transition-colors">
                        {job.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                        {job.department && (
                          <span className="px-2.5 py-1 rounded-md bg-surface-2 border border-border">{job.department}</span>
                        )}
                        {job.location && (
                          <span className="px-2.5 py-1 rounded-md bg-surface-2 border border-border">{job.location}</span>
                        )}
                        {job.employment_type && (
                          <span className="px-2.5 py-1 rounded-md bg-surface-2 border border-border">
                            {EMPLOYMENT_LABELS[job.employment_type] || job.employment_type}
                          </span>
                        )}
                        {job.experience_level && (
                          <span className="px-2.5 py-1 rounded-md bg-surface-2 border border-border">{job.experience_level}</span>
                        )}
                      </div>
                      {job.salary_text && (
                        <p className="mt-3 text-sm text-text-muted">{job.salary_text}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-brand text-sm font-bold shrink-0">
                      View role
                      <Icon icon="solar:arrow-right-linear" className="text-lg group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { EMPLOYMENT_LABELS };
