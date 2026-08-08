-- Careers / job postings — public careers page + admin CRUD.
-- Published rows are readable by everyone; writes require is_admin().

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  department text,
  location text,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'internship')),
  experience_level text,
  salary_text text,
  description_md text not null default '',
  apply_email text,
  apply_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_postings_published_idx
  on public.job_postings (is_published, sort_order, published_at desc);

alter table public.job_postings enable row level security;

drop policy if exists "job_postings_public_read" on public.job_postings;
create policy "job_postings_public_read"
  on public.job_postings
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "job_postings_admin_all" on public.job_postings;
create policy "job_postings_admin_all"
  on public.job_postings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.job_postings to anon, authenticated;
grant insert, update, delete on public.job_postings to authenticated;

-- Seed: Junior Social Media & Content Associate
insert into public.job_postings (
  slug,
  title,
  department,
  location,
  employment_type,
  experience_level,
  salary_text,
  description_md,
  apply_email,
  is_published,
  published_at,
  sort_order
)
values (
  'junior-social-media-content-associate',
  'Junior Social Media & Content Associate',
  'Content',
  'Remote',
  'full_time',
  'Entry level',
  '₦120,000 per month, subject to review after the probation period',
  $md$
## About MuviDB

MuviDB is a growing database and discovery platform for African film. We help audiences discover African movies, actors, filmmakers and where their favourite titles are available to watch.

We are looking for a creative and organised Junior Social Media & Content Associate to build MuviDB’s presence across TikTok, Instagram and X.

This is an entry-level role for someone who understands social media, enjoys African film and entertainment, and can turn information from MuviDB into interesting visual and video content.

## Responsibilities

### Social media management

* Create and manage MuviDB’s official TikTok, Instagram and X accounts.
* Develop and maintain a consistent posting schedule across all platforms.
* Write captions, create relevant hashtags and adapt posts for each social platform.
* Respond to comments and messages in a professional and friendly manner.
* Monitor film conversations, entertainment trends and relevant social media moments.
* Grow MuviDB’s audience through consistent, useful and engaging content.
* Track account performance and provide simple weekly reports covering reach, engagement, follower growth and top-performing posts.

### Branded graphics

* Create branded social media graphics using information available on MuviDB.
* Produce content such as actor spotlights, birthday posts, film facts, new release posts, career highlights, movie recommendations and industry updates.
* Follow MuviDB’s existing brand guidelines and visual style.
* Ensure every graphic is accurate, readable and properly formatted for each platform.
* Maintain reusable design templates to make content production faster and more consistent.

### Video editing and distribution

* Use MuviDB Studio to turn existing YouTube videos into short-form social content.
* Identify interesting moments from interviews, trailers, conversations and other approved videos.
* Add appropriate captions, titles, branding and context to each clip.
* Format and publish videos across TikTok, Instagram Reels, X and other relevant MuviDB channels.
* Write platform-specific captions instead of posting the same caption everywhere.
* Properly credit the original creators and sources of all repurposed content.

### Actor and filmmaker outreach

* Use the Actor Outreach section of MuviDB to generate outreach messages.
* Contact actors and filmmakers whose verified or official Instagram accounts are available on MuviDB.
* Focus primarily on emerging and upcoming African actors and filmmakers.
* Personalise each message before sending it.
* Introduce MuviDB, share the person’s profile with them and invite them to review, claim or share it.
* Keep a clear record of people contacted, responses received and any follow-up required.
* Avoid sending repetitive, generic or spam-like messages.

## Content examples

The person may create content around:

* Emerging actors to watch
* Actor and filmmaker spotlights
* African films released this week
* Where to watch selected African movies
* Memorable scenes or interview moments
* Film anniversaries and birthdays
* Cast introductions
* Career timelines
* Behind-the-scenes facts
* Trending conversations in African film
* MuviDB product features and platform updates

## Requirements

* Strong interest in African film, Nollywood and entertainment.
* Good understanding of TikTok, Instagram and X.
* Basic graphic design skills using Canva, Figma, Adobe Express or similar tools.
* Basic short-form video editing skills.
* Good written English and the ability to write engaging social media captions.
* Strong attention to spelling, names, film titles and factual accuracy.
* Ability to follow brand guidelines and work with existing templates.
* Good communication and organisational skills.
* Ability to work independently and meet a consistent content schedule.
* A smartphone and reliable internet connection.

A university degree is not compulsory. Practical skill, creativity, reliability and willingness to learn are more important.

## Nice to have

* Previous experience running a personal, school, entertainment or business social media account.
* Familiarity with CapCut, Premiere Pro, Canva or similar editing tools.
* Knowledge of African actors, filmmakers, movies and entertainment publications.
* Experience writing outreach messages or communicating with creators.
* A basic understanding of social media analytics.
* An existing portfolio or examples of graphics, videos or social posts.

## Initial performance expectations

During the first three months, the successful candidate will be expected to:

* Establish a consistent presence across TikTok, Instagram and X.
* Create and publish approximately four to five quality posts each week.
* Produce at least two short-form videos each week.
* Maintain a regular actor and filmmaker outreach schedule.
* Follow MuviDB’s visual and editorial guidelines.
* Submit a short weekly performance and activity report.
* Test different content formats and identify the ones that generate the strongest engagement.

Quality, consistency and audience relevance will be prioritised over posting a large volume of low-quality content.

## How to apply

Applicants should submit:

* A short introduction explaining their interest in the role.
* Links to any social media accounts they currently manage or have previously managed.
* Two or three examples of graphics or short-form videos they have created.
* A sample MuviDB Instagram post or TikTok content idea.
* Their current location and availability.

Applicants without professional experience may apply, provided they can demonstrate creativity, communication skills and an understanding of social media.
$md$,
  'careers@muvidb.com',
  true,
  now(),
  10
)
on conflict (slug) do nothing;
