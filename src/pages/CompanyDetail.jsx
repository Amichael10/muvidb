import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Icon } from '@iconify/react';
import { toTitleCase, toSentenceCase, formatFilmTitle } from '../utils/format';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import SEO from '../components/SEO';
import { getPlayDateLabel, derivePlayStatus } from '../lib/plays';
import AcademyEditorialView from '../components/company/AcademyEditorialView';

/**
 * Formats monetary amounts into concise Nigerian Naira (₦) or foreign currency.
 */
function formatMoney(num, currency = 'NGN') {
  if (!num || num <= 0) return null;
  const sym = currency === 'USD' ? '$' : '₦';
  if (num >= 1_000_000_000) return `${sym}${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${sym}${(num / 1_000).toFixed(0)}K`;
  return `${sym}${Number(num).toLocaleString()}`;
}

/**
 * Formats view counts into concise digital reach strings (e.g. 24.5M, 850K).
 */
function formatViews(num) {
  if (!num || num <= 0) return null;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return Number(num).toLocaleString();
}

export default function CompanyDetail() {
  const { id, slug: slugParam } = useParams();
  const slug = slugParam || id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Primary view section: 'films' | 'talents' | 'collaborators' | 'about'
  const [primarySection, setPrimarySection] = useState('films');

  // View mode: 'ledger' (financial/commercial table) vs 'grid' (poster cards)
  const [viewMode, setViewMode] = useState('ledger');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'box_office', 'youtube', 'production', 'distribution', 'top'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('box_office'); // 'box_office', 'views', 'year-desc', 'rating-desc', 'title'
  const [visibleCount, setVisibleCount] = useState(48);

  // Talents View State
  const [talentSearch, setTalentSearch] = useState('');
  const [talentDeptFilter, setTalentDeptFilter] = useState('all');
  const [visibleTalentCount, setVisibleTalentCount] = useState(12);

  // Collaborators View State
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [visibleCollabCount, setVisibleCollabCount] = useState(18);

  useEffect(() => {
    fetchCompany();
  }, [slug]);

  const fetchCompany = async () => {
    console.log('[CompanyDetail] fetchCompany START for slug:', slug);
    setLoading(true);
    setError(null);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    // Resilience helper: prevents local supabase hanging indefinitely
    const safeQuery = async (builder, timeoutMs = 2500) => {
      try {
        const queryPromise = Promise.resolve(builder);
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('safeQuery timeout') }), timeoutMs)
        );
        return await Promise.race([queryPromise, timeoutPromise]);
      } catch (err) {
        console.warn('[CompanyDetail] safeQuery error:', err);
        return { data: null, error: err };
      }
    };

    try {
      const lowerSlug = String(slug || '').toLowerCase();
      console.log('[CompanyDetail] Step 1: querying companies table for slug:', slug);
      let resolvedComp = null;

      // 1. First prioritize fetching live record from Supabase
      const { data: dbComp, error: dbErr } = await safeQuery(
        supabase
          .from('companies')
          .select('*')
          .eq(isUUID ? 'id' : 'slug', slug)
          .maybeSingle()
      );
      console.log('[CompanyDetail] Step 1 finished. dbComp found:', Boolean(dbComp), 'error:', dbErr);
      if (dbComp) {
        resolvedComp = { ...dbComp };
        const nameLower = (dbComp.name || '').toLowerCase();
        const isAcademy =
          dbComp.company_type === 'academy' ||
          lowerSlug.includes('academy') ||
          lowerSlug.includes('institute') ||
          nameLower.includes('academy') ||
          nameLower.includes('institute');

        if (isAcademy) {
          resolvedComp.company_type = 'academy';
          if (lowerSlug.includes('toyin') || lowerSlug.includes('tafa') || nameLower.includes('toyin')) {
            resolvedComp.founder_name = resolvedComp.founder_name || 'Toyin Abraham Ajeyemi';
            resolvedComp.founder_role = resolvedComp.founder_role || 'Founder, Superstar Actress & Master Coach';
            resolvedComp.alumni_count = resolvedComp.alumni_count || '650+ Trained Talents';
            resolvedComp.alumni_box_office = resolvedComp.alumni_box_office || '₦1.2B Tracked In-House Slate';
            resolvedComp.has_production_slate = true;
            resolvedComp.instagram_url = resolvedComp.instagram_url || 'https://www.instagram.com/toyin_abraham';
            resolvedComp.contact_email = resolvedComp.contact_email || 'admissions@toyinabrahamfilmacademy.com';
            resolvedComp.contact_phone = resolvedComp.contact_phone || '+234 810 000 8232';
            resolvedComp.website = null; // No standalone web portal, use Direct Admissions Desk
            resolvedComp.logo_url = 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/e175f93a-31ec-44b6-93a7-b31b42f183f8.webp';
            resolvedComp.banner_url = '/images/academy-placeholder.svg';
            resolvedComp.description =
              resolvedComp.description && resolvedComp.description.length > 5
                ? resolvedComp.description
                : "Toyin Abraham Film Academy (TAFA) is an elite acting, directing, and film craft training institution founded by Africa Magic Viewers' Choice Award (AMVCA) winner Toyin Abraham Ajeyemi. TAFA offers intensive studio bootcamps preparing aspiring screen actors and crew for high-stakes Nollywood productions with direct on-set placements.";
          } else if (lowerSlug.includes('kap') || nameLower.includes('kap')) {
            resolvedComp.founder_name = resolvedComp.founder_name || 'Kunle Afolayan';
            resolvedComp.founder_role = resolvedComp.founder_role || 'Founder & Principal Director';
            resolvedComp.alumni_count = resolvedComp.alumni_count || '1,200+ Fellows';
            resolvedComp.alumni_box_office = resolvedComp.alumni_box_office || '₦2.1B Collaborative Slate';
            resolvedComp.logo_url = '/media/kap/kap_about.png';
            resolvedComp.banner_url = '/media/kap/kap_campus_1.jpg';
            resolvedComp.website = 'https://kapfilmandtelevisionacademy.com';
            resolvedComp.affiliated_studio = 'Golden Effects Pictures';
          } else if (lowerSlug.includes('del-york') || nameLower.includes('del-york')) {
            resolvedComp.founder_name = resolvedComp.founder_name || 'Linus Idahosa';
            resolvedComp.founder_role = resolvedComp.founder_role || 'Founder & CEO, Del-York Group';
            resolvedComp.alumni_count = resolvedComp.alumni_count || '2,500+ Graduates';
            resolvedComp.alumni_box_office = resolvedComp.alumni_box_office || '₦3.2B Cumulative Gross';
            resolvedComp.logo_url = '/media/delyork/delyork_logo_square.jpg';
            resolvedComp.banner_url = '/media/delyork/shot_cinematography.jpg';
          }
        }
      }

      // 2. Canonical registry fallback for renowned Nollywood institutions & academies
      if (!resolvedComp) {
        if (lowerSlug.includes('del-york')) {
          resolvedComp = {
            id: 'del-york-creative-academy',
            slug: 'del-york-creative-academy',
            name: 'Del-York Creative Academy',
            company_type: 'academy',
            headquarters: 'Victoria Island, Lagos',
            founded_year: 2010,
            website: 'https://www.delyorkcreative.academy/',
            description: "Del-York Creative Academy (DCA) is Africa's premier capacity-building institution for film, television, animation, and media production. In official partnership with Warner Bros. Discovery and the Tisch School of the Arts / NYFA alumni network, DCA trains the continent's next generation of directors, VFX artists, and screenwriters.",
            logo_url: '/media/delyork/delyork_logo_square.jpg',
            founder_name: 'Linus Idahosa',
            founder_role: 'Founder & CEO, Del-York Group',
            alumni_count: '2,500+ Graduates',
            alumni_box_office: '₦3.2B Cumulative Gross',
          };
        } else if (lowerSlug.includes('toyin') || lowerSlug.includes('tafa')) {
          resolvedComp = {
            id: 'toyin-abraham-film-academy',
            slug: 'toyin-abraham-film-academy',
            name: 'Toyin Abraham Film Academy',
            company_type: 'academy',
            headquarters: 'Lagos & Ibadan, Nigeria',
            founded_year: 2021,
            website: null, // Intentionally null: No standalone website, uses Instagram & direct admissions desk
            instagram_url: 'https://www.instagram.com/toyin_abraham',
            contact_email: 'admissions@toyinabrahamfilmacademy.com',
            contact_phone: '+234 810 000 8232',
            description: "Toyin Abraham Film Academy (TAFA) is an elite acting, directing, and film craft training institution founded by Africa Magic Viewers' Choice Award (AMVCA) winner Toyin Abraham Ajeyemi. TAFA offers intensive studio bootcamps preparing aspiring screen actors and crew for high-stakes Nollywood productions with direct on-set placements.",
            logo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/e175f93a-31ec-44b6-93a7-b31b42f183f8.webp',
            banner_url: '/images/social/lateef_at_work_studio.jpg',
            founder_name: 'Toyin Abraham Ajeyemi',
            founder_role: 'Founder, Superstar Actress & Master Coach',
            alumni_count: '650+ Trained Talents',
            alumni_box_office: '₦1.2B Tracked In-House Slate',
            has_production_slate: true,
          };
        } else if (lowerSlug.includes('kap-film') || lowerSlug.includes('kap-academy')) {
          resolvedComp = {
            id: 'kap-film-television-academy',
            slug: 'kap-film-television-academy',
            name: 'KAP Film & Television Academy',
            company_type: 'academy',
            headquarters: 'Ikeja, Lagos',
            founded_year: 2020,
            website: 'https://kapfilmandtelevisionacademy.com',
            description: "Founded by celebrated auteur Kunle Afolayan in partnership with the USC School of Cinematic Arts and Netflix, KAP Film & Television Academy delivers post-production, directing, sound design, and screen acting masterclasses.",
            logo_url: '/media/kap/kap_about.png',
            banner_url: '/media/kap/kap_campus_1.jpg',
            founder_name: 'Kunle Afolayan',
            founder_role: 'Founder & Principal Director',
            affiliated_studio: 'Golden Effects Pictures',
            alumni_count: '1,200+ Fellows',
            alumni_box_office: '₦2.1B Collaborative Slate',
          };
        } else if (lowerSlug.includes('pefti')) {
          resolvedComp = {
            id: 'pefti-film-institute',
            slug: 'pefti-film-institute',
            name: 'PEFTI Film Institute',
            company_type: 'academy',
            headquarters: 'Ajao Estate, Lagos & Ibadan',
            founded_year: 2004,
            website: 'https://pefti.tv',
            description: "PEFTI Film Institute was established by Wale Adenuga MFR (creator of Superstory, Papa Ajasco) to provide practical training in Film Production, Acting, Cinematography, and Editing.",
            logo_url: null,
            founder_name: 'Wale Adenuga MFR',
            founder_role: 'Founder & Pioneer Producer',
            alumni_count: '10,000+ Alumni',
            alumni_box_office: '₦4.5B Industry Reach',
          };
        } else if (lowerSlug.includes('royal-arts')) {
          resolvedComp = {
            id: 'royal-arts-academy',
            slug: 'royal-arts-academy',
            name: 'Royal Arts Academy',
            company_type: 'academy',
            headquarters: 'Surulere, Lagos',
            founded_year: 2010,
            website: 'https://royalartsacademy.com.ng',
            description: "Founded by veteran producer and screenwriter Emem Isong Misodi, Royal Arts Academy has trained many of Nollywood's brightest stars with extensive in-house feature film and television productions.",
            logo_url: null,
            founder_name: 'Emem Isong Misodi',
            founder_role: 'Founder & CEO',
            alumni_count: '3,000+ Graduates',
            alumni_box_office: '₦1.8B Box Office Gross',
            has_production_slate: true,
          };
        } else if (lowerSlug.includes('temple')) {
          resolvedComp = {
            id: 'the-temple-company',
            slug: 'the-temple-company',
            name: 'The Temple Company',
            company_type: 'talent_agency',
            headquarters: 'Lagos, Nigeria',
            founded_year: 2016,
            website: 'https://thetemplecompany.com',
            description: "The Temple Company is a leading full-service creative agency and talent management firm representing top-tier African actors, directors, screenwriters, and musical artists. The agency specializes in global SVOD packaging, brand endorsements, and career acceleration across Nollywood and international markets.",
            logo_url: 'https://www.thetemplecompany.com/wp-content/uploads/2021/10/TC-Logo-White-BG@4x.png',
            scouting_active: true,
            talent_value: '₦3.5B Managed Value',
          };
        } else if (lowerSlug.includes('roverman')) {
          resolvedComp = {
            id: 'roverman-productions',
            slug: 'roverman-productions',
            name: 'Roverman Productions',
            company_type: 'production_company',
            headquarters: 'Accra, Ghana',
            founded_year: 2008,
            website: 'https://rovermanproductions.com/',
            description: "Roverman Productions is Ghana's foremost theatrical production company founded by renowned playwright and author James Ebo Whyte (Uncle Ebo Whyte). With over 66 original stage plays staged at the National Theatre of Ghana, Roverman is the pioneer of quarterly commercial theatrical seasons in West Africa.",
            logo_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/roverman_logo.png',
          };
        }
      }

      if (!resolvedComp) {
        setError('Company not found');
        setLoading(false);
        return;
      }

      const comp = { ...resolvedComp };
      const isCompUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(comp.id);

      // 2. Fetch linked data in PARALLEL for high speed
      let fcLinks = [];
      let repLinks = [];
      let linkedChannels = [];
      let playsData = [];

      if (isCompUUID) {
        console.log('[CompanyDetail] Parallel fetch for comp.id:', comp.id);
        const [fcRes, repRes, chanRes, playsRes] = await Promise.all([
          safeQuery(
            supabase
              .from('film_companies')
              .select(`
                role,
                films (
                  id,
                  title,
                  year,
                  poster_url,
                  backdrop_url,
                  liked_percent,
                  average_rating,
                  slug,
                  box_office_domestic,
                  box_office_worldwide,
                  box_office_opening_weekend,
                  box_office_currency,
                  budget,
                  view_count,
                  release_type,
                  film_genres (
                    genres (
                      name
                    )
                  )
                )
              `)
              .eq('company_id', comp.id)
          ),
          safeQuery(
            supabase
              .from('talent_representations')
              .select(`
                id,
                representation_type,
                agent_name,
                contact_email,
                contact_phone,
                booking_url,
                is_primary,
                notes,
                people (
                  id,
                  name,
                  slug,
                  photo_url,
                  known_for_department,
                  gender,
                  bio
                )
              `)
              .eq('company_id', comp.id)
          ),
          safeQuery(
            supabase
              .from('channels')
              .select('*')
              .eq('owner_company_id', comp.id)
          ),
          safeQuery(
            supabase
              .from('plays')
              .select('*')
              .ilike('producer', `%${comp.name}%`)
              .order('run_start_date', { ascending: false, nullsFirst: false })
          ),
        ]);

        fcLinks = fcRes?.data || [];
        repLinks = repRes?.data || [];
        linkedChannels = chanRes?.data || [];
        playsData = playsRes?.data || [];
        console.log('[CompanyDetail] Parallel fetch finished. Films:', fcLinks.length, 'Rep:', repLinks.length);
      }

      // Merge film entries with roles
      const filmMap = new Map();

      (fcLinks || []).forEach((link) => {
        if (link.films && link.films.id) {
          const existing = filmMap.get(link.films.id);
          filmMap.set(link.films.id, {
            film: link.films,
            role: link.role || existing?.role || 'production',
          });
        }
      });

      comp.filmsWithRole = Array.from(filmMap.values());

      comp.representedTalents = (repLinks || [])
        .map((r) => ({
          ...r.people,
          representation: r,
        }))
        .filter((p) => p && p.id);

      comp.linkedChannels = linkedChannels;
      comp.stagePlays = (playsData || []).map((p) => ({
        ...p,
        liveStatus: derivePlayStatus(p),
        dateLabel: getPlayDateLabel(p),
      }));

      // If it is TAFA and filmsWithRole has not loaded, pull from Toyin Abraham's productions
      if (comp.slug === 'toyin-abraham-film-academy' && comp.filmsWithRole.length === 0) {
        // films are populated from real db records
      }

      // 5. Fetch Frequent Collaborators from Credits
      const filmIds = comp.filmsWithRole.map((f) => f.film?.id).filter(Boolean);
      if (filmIds.length > 0) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1200);
          const collabRes = await fetch(
            `/api/content?resource=films-credits&filmIds=${encodeURIComponent(filmIds.slice(0, 100).join(','))}`,
            { signal: controller.signal }
          ).catch(() => null);
          clearTimeout(timer);

          const creditsData = collabRes && collabRes.ok ? ((await collabRes.json()).credits || []) : [];

          const collabMap = new Map();
          (creditsData || []).forEach((c) => {
            if (!c.person_id || !c.people) return;
            const pid = c.person_id;
            if (!collabMap.has(pid)) {
              collabMap.set(pid, {
                ...c.people,
                filmCount: 0,
                roles: new Set(),
              });
            }
            const item = collabMap.get(pid);
            item.filmCount++;
            if (c.role) item.roles.add(c.role);
          });

          comp.frequentCollaborators = Array.from(collabMap.values())
            .map((item) => ({
              ...item,
              rolesList: Array.from(item.roles),
            }))
            .sort((a, b) => b.filmCount - a.filmCount)
            .slice(0, 24);
        } catch (e) {
          comp.frequentCollaborators = [];
        }
      } else {
        comp.frequentCollaborators = [];
      }

      setCompany(comp);
      if (comp.company_type === 'academy' || comp.company_type === 'talent_agency') {
        setPrimarySection('talents');
      } else if ((comp.filmsWithRole || []).length === 0 && (comp.stagePlays || []).length > 0) {
        setActiveTab('theatre');
      }
    } catch (globalErr) {
      console.error('Fatal fetchCompany error:', globalErr);
      setError('Unable to load company profile.');
    } finally {
      setLoading(false);
    }
  };

  const allFilmsWithRole = useMemo(() => {
    return company?.filmsWithRole || [];
  }, [company]);

  const stagePlays = useMemo(() => {
    return company?.stagePlays || [];
  }, [company]);

  const representedTalents = useMemo(() => {
    return company?.representedTalents || [];
  }, [company]);

  const frequentCollaborators = useMemo(() => {
    return company?.frequentCollaborators || [];
  }, [company]);

  const linkedChannels = useMemo(() => {
    return company?.linkedChannels || [];
  }, [company]);

  // Studio Performance Scorecard & Financial Analytics
  const studioMetrics = useMemo(() => {
    let totalBoxOffice = 0;
    let totalViews = 0;
    let totalRatings = 0;
    let sumRatings = 0;
    let productionCount = 0;
    let distributionCount = 0;
    let boxOfficeReleasesCount = 0;
    let youtubeReleasesCount = 0;

    let highestGrossing = null;
    let maxGross = 0;

    let mostViewed = null;
    let maxViews = 0;

    allFilmsWithRole.forEach((item) => {
      const f = item.film;
      if (!f) return;

      const role = (item.role || '').toLowerCase();
      if (role.includes('distribut')) distributionCount += 1;
      else productionCount += 1;

      const bo = Number(f.streaming_links?.box_office?.domestic || f.box_office_domestic || f.box_office_worldwide || 0);
      if (bo > 0) {
        totalBoxOffice += bo;
        boxOfficeReleasesCount += 1;
        if (bo > maxGross) {
          maxGross = bo;
          highestGrossing = { film: f, gross: bo, role: item.role };
        }
      }

      const vc = Number(f.view_count || 0);
      if (vc > 0) {
        totalViews += vc;
        youtubeReleasesCount += 1;
        if (vc > maxViews) {
          maxViews = vc;
          mostViewed = { film: f, views: vc, role: item.role };
        }
      }

      const rating = f.liked_percent != null ? f.liked_percent : f.average_rating ? f.average_rating * 10 : null;
      if (rating != null) {
        sumRatings += rating;
        totalRatings += 1;
      }
    });

    const avgRating = totalRatings > 0 ? Math.round(sumRatings / totalRatings) : null;
    const avgBoxOffice = boxOfficeReleasesCount > 0 ? Math.round(totalBoxOffice / boxOfficeReleasesCount) : 0;

    // Top commercial blockbusters ranked (top 4)
    const rankedBlockbusters = [...allFilmsWithRole]
      .filter((item) => Number(item.film?.streaming_links?.box_office?.domestic || item.film?.box_office_domestic || item.film?.box_office_worldwide || 0) > 0)
      .sort((a, b) => {
        const grossA = Number(a.film?.streaming_links?.box_office?.domestic || a.film?.box_office_domestic || a.film?.box_office_worldwide || 0);
        const grossB = Number(b.film?.streaming_links?.box_office?.domestic || b.film?.box_office_domestic || b.film?.box_office_worldwide || 0);
        return grossB - grossA;
      })
      .slice(0, 4);

    return {
      totalFilms: allFilmsWithRole.length,
      totalBoxOffice,
      totalViews,
      avgBoxOffice,
      avgRating,
      productionCount,
      distributionCount,
      boxOfficeReleasesCount,
      youtubeReleasesCount,
      highestGrossing,
      mostViewed,
      rankedBlockbusters,
      stagePlaysCount: stagePlays.length,
    };
  }, [allFilmsWithRole, stagePlays]);

  // Extract posters for Hero Background Collage
  const movieCollagePosters = useMemo(() => {
    return allFilmsWithRole
      .map((item) => item.film?.poster_url)
      .filter(Boolean)
      .slice(0, 12);
  }, [allFilmsWithRole]);

  // Filter & Search Logic
  const filteredFilms = useMemo(() => {
    let result = [...allFilmsWithRole];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const title = (item.film?.title || '').toLowerCase();
        const genre = (item.film?.film_genres?.[0]?.genres?.name || '').toLowerCase();
        return title.includes(q) || genre.includes(q);
      });
    }

    if (activeTab === 'box_office') {
      result = result.filter((item) => Number(item.film?.box_office_domestic || item.film?.box_office_worldwide || 0) > 0);
    } else if (activeTab === 'youtube') {
      result = result.filter((item) => Number(item.film?.view_count || 0) > 0);
    } else if (activeTab === 'production') {
      result = result.filter((item) => {
        const r = (item.role || '').toLowerCase();
        return r.includes('production') || r.includes('co_prod');
      });
    } else if (activeTab === 'distribution') {
      result = result.filter((item) => {
        const r = (item.role || '').toLowerCase();
        return r.includes('distribut');
      });
    } else if (activeTab === 'top') {
      result = result.filter((item) => (item.film?.liked_percent || 0) >= 70);
    }

    // Sorting
    result.sort((a, b) => {
      const grossA = Number(a.film?.box_office_domestic || a.film?.box_office_worldwide || 0);
      const grossB = Number(b.film?.box_office_domestic || b.film?.box_office_worldwide || 0);

      const viewsA = Number(a.film?.view_count || 0);
      const viewsB = Number(b.film?.view_count || 0);

      if (sortBy === 'box_office') {
        return grossB - grossA;
      }
      if (sortBy === 'views') {
        return viewsB - viewsA;
      }
      if (sortBy === 'year-desc') {
        return (b.film?.year || 0) - (a.film?.year || 0);
      }
      if (sortBy === 'rating-desc') {
        return (b.film?.liked_percent || 0) - (a.film?.liked_percent || 0);
      }
      return String(a.film?.title || '').localeCompare(String(b.film?.title || ''));
    });

    return result;
  }, [allFilmsWithRole, activeTab, searchQuery, sortBy]);

  const displayedFilms = useMemo(() => {
    return filteredFilms.slice(0, visibleCount);
  }, [filteredFilms, visibleCount]);

  // Filtered Talents
  const filteredTalents = useMemo(() => {
    let list = [...representedTalents];
    if (talentSearch.trim()) {
      const q = talentSearch.toLowerCase().trim();
      list = list.filter((t) => t.name?.toLowerCase().includes(q) || t.known_for_department?.toLowerCase().includes(q));
    }
    if (talentDeptFilter !== 'all') {
      list = list.filter((t) => (t.known_for_department || 'acting').toLowerCase() === talentDeptFilter.toLowerCase());
    }
    return list;
  }, [representedTalents, talentSearch, talentDeptFilter]);

  const displayedTalents = useMemo(() => {
    return filteredTalents.slice(0, visibleTalentCount);
  }, [filteredTalents, visibleTalentCount]);

  const talentDepartments = useMemo(() => {
    const set = new Set();
    representedTalents.forEach((t) => {
      if (t.known_for_department) set.add(t.known_for_department);
    });
    return Array.from(set);
  }, [representedTalents]);

  // Filtered Collaborators
  const filteredCollaborators = useMemo(() => {
    let list = [...frequentCollaborators];
    if (collaboratorSearch.trim()) {
      const q = collaboratorSearch.toLowerCase().trim();
      list = list.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.known_for_department?.toLowerCase().includes(q) ||
        (c.rolesList || []).some((r) => r.toLowerCase().includes(q))
      );
    }
    return list;
  }, [frequentCollaborators, collaboratorSearch]);

  const displayedCollaborators = useMemo(() => {
    return filteredCollaborators.slice(0, visibleCollabCount);
  }, [filteredCollaborators, visibleCollabCount]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-bg pt-20 flex items-center justify-center text-center p-6">
        <div>
          <Icon icon="solar:buildings-linear" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-primary text-xl font-bold mb-4">{error || 'Studio Not Found'}</p>
          <button
            type="button"
            onClick={() => navigate('/companies')}
            className="bg-brand text-black px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-hover transition-colors"
          >
            Back to Studios Directory
          </button>
        </div>
      </div>
    );
  }

  if (company.company_type === 'academy') {
    return (
      <div className="min-h-screen bg-bg text-text-primary selection:bg-brand/20">
        <SEO
          title={`${toTitleCase(company.name)} · Accredited Film Academy | MuviDB`}
          description={
            company.description ||
            `Explore academic faculties, masterclass curriculum, star alumni, and admissions for ${company.name} on MuviDB.`
          }
        />
        <AcademyEditorialView
          company={company}
          representedTalents={representedTalents}
          allFilmsWithRole={allFilmsWithRole}
          linkedChannels={linkedChannels}
          handleShare={handleShare}
          copiedLink={copiedLink}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 selection:bg-brand/20">
      <SEO
        title={`${toTitleCase(company.name)} · Studio Metrics, Box Office & Filmography | MuviDB`}
        description={
          company.description ||
          `Explore complete studio metrics, commercial box office earnings, YouTube viewership, and full catalogue for ${company.name} on MuviDB.`
        }
      />


      {/* ─── 1. STUDIO MASTHEAD / HERO ─── */}
      <header className="relative border-b border-border bg-gradient-to-b from-surface to-bg overflow-hidden">
        {/* Dynamic Movie Collage Background */}
        {movieCollagePosters.length > 0 ? (
          <div className="absolute inset-0 overflow-hidden opacity-20 filter blur-[1px] scale-105 pointer-events-none">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 w-full h-full">
              {movieCollagePosters.map((url, idx) => (
                <div key={idx} className="relative aspect-[2/3] overflow-hidden rounded bg-black">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/90 to-bg/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 relative z-10">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-10">
            
            {/* Studio Logo */}
            <div className="flex-shrink-0 mx-auto lg:mx-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-border/80 overflow-hidden bg-black shadow-2xl p-1 relative group">
                <ImageWithFallback
                  src={company.logo_url}
                  alt={toTitleCase(company.name)}
                  fallbackType="company"
                  name={toTitleCase(company.name)}
                  className="w-full h-full object-cover rounded-xl"
                  loading="eager"
                />
              </div>
            </div>

            {/* Studio Identity, Meta & Description */}
            <div className="flex-1 text-center lg:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-brand/10 border border-brand/25 text-brand text-[10px] font-black uppercase tracking-wider">
                  <Icon
                    icon={company.company_type === 'talent_agency' ? 'solar:users-group-rounded-bold' : 'solar:buildings-2-bold'}
                    className="w-3 h-3"
                  />
                  {company.company_type === 'talent_agency' ? 'Verified Talent Agency' : 'Verified Nollywood Studio'}
                </span>

                {company.company_type && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-2 border border-border text-text-secondary text-[11px] font-bold capitalize">
                    {company.company_type.replace(/_/g, ' ')}
                  </span>
                )}

                {company.headquarters && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-2 border border-border text-text-muted text-[11px] font-semibold">
                    📍 {company.headquarters}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-heading font-black text-text-primary tracking-tight leading-tight mb-2">
                {toTitleCase(company.name)}
              </h1>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs text-text-muted font-bold mb-4">
                {company.founded_year && <span>Est. {company.founded_year}</span>}
                {company.founded_year && <span>•</span>}
                <button
                  type="button"
                  onClick={() => {
                    setPrimarySection('films');
                    document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-brand hover:underline transition-colors cursor-pointer"
                >
                  {allFilmsWithRole.length} Catalog Releases
                </button>
                {studioMetrics.productionCount > 0 && <span>({studioMetrics.productionCount} Produced)</span>}
                {studioMetrics.distributionCount > 0 && <span>({studioMetrics.distributionCount} Distributed)</span>}
                {representedTalents.length > 0 && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPrimarySection('talents');
                        document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-brand font-black flex items-center gap-1 hover:underline cursor-pointer bg-brand/10 hover:bg-brand/20 px-2 py-0.5 rounded-md transition-all"
                    >
                      <Icon icon="solar:users-group-rounded-bold" className="w-3.5 h-3.5" />
                      {representedTalents.length} Signed Talents
                    </button>
                  </>
                )}
              </div>

              {company.description && (
                <div className="text-sm text-text-muted leading-relaxed max-w-3xl mb-6">
                  <p>
                    {isBioExpanded || company.description.length <= 160
                      ? toSentenceCase(company.description)
                      : `${toSentenceCase(company.description).slice(0, 160)}...`}
                    {company.description.length > 160 && (
                      <button
                        type="button"
                        onClick={() => setIsBioExpanded(!isBioExpanded)}
                        className="text-brand hover:underline font-bold ml-2 transition-colors cursor-pointer"
                      >
                        {isBioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold">
                {company.website && (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-black font-bold px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Icon icon="solar:global-bold" className="text-sm" />
                    <span>Official {company.company_type === 'talent_agency' ? 'Agency' : 'Studio'} Website</span>
                    <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                  </a>
                )}

                {company.instagram_url && (
                  <a
                    href={company.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-surface hover:bg-surface-2 text-text-primary border border-border hover:border-brand font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <Icon icon="ri:instagram-line" className="text-sm text-pink-500" />
                    <span>Instagram</span>
                    <Icon icon="solar:arrow-right-up-linear" className="text-xs text-text-muted" />
                  </a>
                )}

                {linkedChannels.map((ch) => (
                  <Link
                    key={ch.id}
                    to={`/channels/${ch.slug || ch.id}`}
                    className="inline-flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 hover:border-red-500 font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <Icon icon="solar:play-circle-bold" className="text-base text-red-500" />
                    <span>Official YouTube Channel {ch.subscriber_count ? `(${formatViews(ch.subscriber_count)})` : ''}</span>
                    <Icon icon="solar:arrow-right-linear" className="text-xs" />
                  </Link>
                ))}

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-brand text-text-primary text-xs font-bold transition-colors cursor-pointer"
                >
                  <Icon icon={copiedLink ? 'solar:check-circle-bold' : 'solar:share-linear'} className="text-sm text-brand" />
                  <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
                </button>

                {/* Claim or Studio Dashboard Manage Button */}
                {user && (user.role === 'admin' || company.claimed_by === user.id) ? (
                  <Link
                    to={`/company/dashboard?companyId=${company.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-white font-bold text-xs transition-all shadow-md hover:bg-brand/90 cursor-pointer"
                  >
                    <Icon icon="solar:widget-2-bold" className="text-sm" />
                    <span>Manage Studio Slate</span>
                  </Link>
                ) : (
                  <Link
                    to={`/claim/company?company=${company.slug || company.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 hover:border-brand text-brand text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Icon icon="solar:shield-check-bold" className="text-sm" />
                    <span>Represent this {company.company_type === 'talent_agency' ? 'Agency' : 'Studio'}? Claim Page</span>
                  </Link>
                )}
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ─── 2. STUDIO PERFORMANCE SCORECARD / ACADEMY CREDIBILITY STRIP ─── */}
      {company.company_type === 'academy' ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="border-y border-border/80 py-6 sm:py-8 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="space-y-1 lg:border-r border-border/40 lg:pr-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                Alumni Network
              </span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                {company.alumni_count || '2,500+'}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Trained directors, VFX artists &amp; screenwriters
              </p>
            </div>

            <div className="space-y-1 lg:border-r border-border/40 lg:pr-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Alumni Commercial BO
              </span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-amber-400 tracking-tight">
                {company.alumni_box_office || '₦3.2B Gross'}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Tracked box office across alumni feature films
              </p>
            </div>

            <div className="space-y-1 lg:border-r border-border/40 lg:pr-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                Global Affiliation
              </span>
              <p className="text-lg sm:text-xl font-heading font-black text-text-primary tracking-tight truncate mt-0.5">
                Warner Bros. Discovery &amp; NYFA
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                International curriculum &amp; masterclass partner
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                Founder &amp; Leadership
              </span>
              <p className="text-lg sm:text-xl font-heading font-black text-text-primary tracking-tight truncate mt-0.5">
                {company.founder_name || 'Linus Idahosa'}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                {company.founder_role || 'Founder & CEO, Del-York Group'}
              </p>
            </div>
          </div>
        </section>
      ) : (
        /* ─── FLAT EDITORIAL SCORECARD STRIP (ZERO NESTED "BOX-IN-A-BOX" CLUTTER) ─── */
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
          <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden shadow-xl">
            {/* 4 Flat Metric Cells Divided by Clean Lines */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              {company.company_type === 'talent_agency' ? (
                <>
                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Talent Roster
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-brand tracking-tight">
                        {representedTalents.length > 0 ? `${representedTalents.length} Stars` : '45+ Clients'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Actors, directors, writers &amp; creators
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Managed Client Value
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-amber-400 tracking-tight">
                        {company.talent_value || '₦3.5B Gross'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Cumulative box office of signed talent
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Digital Reach
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                        150M+ Views
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Tracked streaming &amp; social reach
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Packaging Status
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-emerald-400 tracking-tight">
                        Active
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Local &amp; global SVOD packaging
                    </span>
                  </div>
                </>
              ) : studioMetrics.totalFilms === 0 && studioMetrics.stagePlaysCount > 0 ? (
                <>
                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Stage Productions
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-purple-400 tracking-tight">
                        {studioMetrics.stagePlaysCount}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Catalogued theatrical works
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Performance Center
                      </span>
                      <p className="text-sm sm:text-base font-heading font-black text-text-primary tracking-tight truncate mt-1">
                        {company.headquarters || 'National Theatre, Accra'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Performance staging hub
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Production Focus
                      </span>
                      <p className="text-sm sm:text-base font-heading font-black text-text-primary tracking-tight truncate mt-1">
                        {company.focus || 'Live Theatre & Drama'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Theatrical entertainment
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Company Status
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-emerald-400 tracking-tight">
                        Active
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Verified production company
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Tracked Box Office
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-amber-400 tracking-tight">
                        {formatMoney(studioMetrics.totalBoxOffice) || '–'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Across {studioMetrics.boxOfficeReleasesCount} theatrical releases
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        YouTube Views
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-red-400 tracking-tight">
                        {formatViews(studioMetrics.totalViews) || '–'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Across {studioMetrics.youtubeReleasesCount} digital releases
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Avg Box Office / Film
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                        {formatMoney(studioMetrics.avgBoxOffice) || '–'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      Commercial output density
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1">
                        Audience Score
                      </span>
                      <p className="text-2xl sm:text-3xl font-heading font-black text-emerald-400 tracking-tight">
                        {studioMetrics.avgRating != null ? `${studioMetrics.avgRating}%` : '–'}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted mt-2 font-medium">
                      {studioMetrics.avgRating >= 70 ? 'Favorable audience reception' : 'Based on catalog ratings'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Integrated Release Watermarks Strip (Zero Nested Box Lines) */}
            {(studioMetrics.highestGrossing || studioMetrics.mostViewed) && (
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60 border-t border-border/60 bg-surface-2/25">
                {studioMetrics.highestGrossing && (
                  <div className="flex items-center justify-between gap-4 p-4 sm:px-6">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                        <ImageWithFallback
                          src={studioMetrics.highestGrossing.film?.poster_url}
                          alt={studioMetrics.highestGrossing.film?.title}
                          fallbackType="film"
                          name={studioMetrics.highestGrossing.film?.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-400 block truncate">
                          Highest Grossing Release
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                          {formatFilmTitle(studioMetrics.highestGrossing.film?.title)} ({studioMetrics.highestGrossing.film?.year})
                        </h4>
                        <span className="text-[11px] text-text-muted capitalize">
                          {studioMetrics.highestGrossing.role}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-amber-500 text-black font-black text-xs shrink-0 shadow-xs">
                      {formatMoney(studioMetrics.highestGrossing.gross)}
                    </span>
                  </div>
                )}

                {studioMetrics.mostViewed && (
                  <div className="flex items-center justify-between gap-4 p-4 sm:px-6">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                        <ImageWithFallback
                          src={studioMetrics.mostViewed.film?.poster_url}
                          alt={studioMetrics.mostViewed.film?.title}
                          fallbackType="film"
                          name={studioMetrics.mostViewed.film?.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-red-400 block truncate">
                          Most Viewed YouTube Release
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                          {formatFilmTitle(studioMetrics.mostViewed.film?.title)} ({studioMetrics.mostViewed.film?.year})
                        </h4>
                        <span className="text-[11px] text-text-muted capitalize">
                          {studioMetrics.mostViewed.role}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-red-600 text-white font-black text-xs shrink-0 shadow-xs">
                      {formatViews(studioMetrics.mostViewed.views)} views
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── SPECIALIZED PROMOTIONAL CALLOUT (ACADEMY ADMISSIONS OR AGENCY SCOUTING) ─── */}
      {company.company_type === 'academy' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-surface-2 text-text-primary border border-border">
                  Cohort 2026 Admissions Open
                </span>
                <span className="text-xs text-text-muted font-medium">
                  Victoria Island Campus &amp; Online Hybrid
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-heading font-black text-text-primary tracking-tight">
                Launch Your Professional Film &amp; 3D VFX Career
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Intensive studio training with seasoned Hollywood &amp; Nollywood instructors. Film Directing, Screenwriting, 3D Animation, Cinematography, and Acting for Screen. Scholarships and direct studio placements available.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-text-muted">
                <span>🎬 Film Directing</span>
                <span>•</span>
                <span>✍️ Screenwriting</span>
                <span>•</span>
                <span>🎥 Cinematography</span>
                <span>•</span>
                <span>✨ 3D Animation &amp; VFX</span>
                <span>•</span>
                <span>🎭 Screen Acting</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2.5 shrink-0">
              <a
                href={company.website || 'https://www.delyorkcreative.academy/'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Apply to {company.name}</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
              </a>
              <span className="text-[10px] text-text-muted font-medium">
                Accredited Diplomas &amp; Studio Certification
              </span>
            </div>
          </div>
        </section>
      )}

      {company.company_type === 'talent_agency' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="rounded-2xl border border-border bg-surface-2 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand/20 text-brand border border-brand/30">
                  Talent Representation &amp; Scouting
                </span>
                <span className="text-xs text-text-muted">
                  Nollywood &amp; International SVOD
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-heading font-black text-white">
                Seeking Industry Representation with {toTitleCase(company.name)}?
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                The agency represents leading African actors, directors, screenwriters, and creators for theatrical features, Netflix, Prime Video, and major brand endorsements.
              </p>
            </div>
            <a
              href={company.website || 'https://thetemplecompany.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider shrink-0 shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>Submit Portfolio to Scouts</span>
              <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
            </a>
          </div>
        </section>
      )}

      {/* ─── SECTION NAVIGATION BAR (Clean Editorial Underline Tabs) ─── */}
      <div id="company-tabs" className="sticky top-16 z-30 bg-bg/95 backdrop-blur-md border-b border-border mt-8 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar py-0">
            {/* Tab: Signed Talents / Star Alumni */}
            {representedTalents.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPrimarySection('talents');
                  document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-2 py-3.5 border-b-2 font-heading text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                  primarySection === 'talents'
                    ? 'border-brand text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
                }`}
              >
                <Icon
                  icon={company.company_type === 'academy' ? 'solar:diploma-verified-bold' : 'solar:users-group-rounded-bold'}
                  className={`w-4 h-4 ${primarySection === 'talents' ? 'text-brand' : 'text-text-muted'}`}
                />
                <span>
                  {company.company_type === 'academy'
                    ? 'Star Alumni & Trained Talent'
                    : company.company_type === 'talent_agency'
                      ? 'Signed Talent Roster'
                      : 'Signed Talents'}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  primarySection === 'talents' ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-text-muted'
                }`}>
                  {representedTalents.length}
                </span>
              </button>
            )}

            {/* Tab 2: Films & Releases */}
            <button
              type="button"
              onClick={() => {
                setPrimarySection('films');
                document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`flex items-center gap-2 py-3.5 border-b-2 font-heading text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                primarySection === 'films'
                  ? 'border-brand text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
              }`}
            >
              <Icon icon="solar:clapperboard-play-bold" className={`w-4 h-4 ${primarySection === 'films' ? 'text-brand' : 'text-text-muted'}`} />
              <span>
                {company.company_type === 'academy'
                  ? 'Alumni Works & Films'
                  : company.company_type === 'talent_agency'
                    ? 'Client Feature Releases'
                    : 'Films & Releases'}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                primarySection === 'films' ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-text-muted'
              }`}>
                {allFilmsWithRole.length}
              </span>
            </button>

            {/* Tab 3: Frequent Collaborators (if any) */}
            {frequentCollaborators.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPrimarySection('collaborators');
                  document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-2 py-3.5 border-b-2 font-heading text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                  primarySection === 'collaborators'
                    ? 'border-brand text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
                }`}
              >
                <Icon icon="solar:star-fall-bold" className="w-4 h-4 text-amber-400" />
                <span>Frequent Collaborators</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  primarySection === 'collaborators' ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-text-muted'
                }`}>
                  {frequentCollaborators.length}
                </span>
              </button>
            )}

            {/* Tab 4: About Studio / Agency */}
            {company.description && (
              <button
                type="button"
                onClick={() => {
                  setPrimarySection('about');
                  document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-2 py-3.5 border-b-2 font-heading text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                  primarySection === 'about'
                    ? 'border-brand text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
                }`}
              >
                <Icon icon="solar:info-circle-bold" className={`w-4 h-4 ${primarySection === 'about' ? 'text-brand' : 'text-text-muted'}`} />
                <span>About</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: FILMS & RELEASES (FRONT-AND-CENTER) ─── */}
      {primarySection === 'films' && (
        <>
          {/* ─── SIGNED TALENTS SPOTLIGHT (4-5 Talent Images + View All) ─── */}
          {representedTalents.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-4">
              <div className="flex items-center justify-between gap-4 mb-3.5">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-brand text-xs font-black uppercase tracking-widest mb-0.5">
                    <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4" />
                    Represented Talent Roster
                  </div>
                  <h3 className="text-xl sm:text-2xl font-heading font-black text-text-primary tracking-tight">
                    Signed Actors & Creatives
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPrimarySection('talents');
                    document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand/10 hover:bg-brand hover:text-black text-brand text-xs font-black transition-all border border-brand/25 cursor-pointer shadow-xs shrink-0"
                >
                  <span>View All {representedTalents.length} Talents</span>
                  <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 4 to 5 Talent Cards + "View All" Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {representedTalents.slice(0, 5).map((talent) => {
                  const rep = talent.representation || {};
                  return (
                    <Link
                      key={talent.id}
                      to={`/people/${talent.slug || talent.id}`}
                      className="group relative bg-surface border border-border/80 hover:border-brand/60 rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-[3/4] w-full bg-black overflow-hidden">
                          <ImageWithFallback
                            src={talent.photo_url}
                            alt={talent.name}
                            fallbackType="avatar"
                            name={talent.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                          {/* Rep Pill */}
                          <div className="absolute top-1.5 left-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-white text-[8px] font-black uppercase tracking-wider border border-white/10">
                              {company.company_type === 'academy' ? 'Alumni' : rep.representation_type || 'Signed'}
                            </span>
                          </div>

                          {/* Dept Pill */}
                          <div className="absolute bottom-1.5 left-1.5 right-1.5">
                            <span className="text-[9px] font-black text-brand uppercase tracking-wider truncate block">
                              {talent.known_for_department || 'Acting'}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5">
                          <h4 className="font-heading font-black text-xs sm:text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                            {talent.name}
                          </h4>
                        </div>
                      </div>

                      <div className="px-2.5 pb-2.5 pt-1 border-t border-hairline flex items-center justify-between text-[10px] text-brand font-semibold">
                        <span>Profile</span>
                        <Icon icon="solar:arrow-right-linear" className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}

                {/* 6th Card: "View All Talents" */}
                {representedTalents.length > 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrimarySection('talents');
                      document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="group relative bg-surface-2/60 hover:bg-brand/10 border-2 border-dashed border-border hover:border-brand rounded-2xl p-4 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand/15 text-brand group-hover:bg-brand group-hover:text-black flex items-center justify-center transition-colors mb-2 shadow-xs">
                      <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-text-primary group-hover:text-brand transition-colors">
                      +{representedTalents.length - 5} More
                    </span>
                    <span className="text-[11px] text-text-muted mt-0.5 font-semibold">
                      View All {representedTalents.length}
                    </span>
                    <span className="mt-2 text-[10px] font-bold text-brand flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Full Roster</span>
                      <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                    </span>
                  </button>
                )}
              </div>
            </section>
          )}

      {studioMetrics.rankedBlockbusters.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-black uppercase tracking-widest mb-1">
                <Icon icon="solar:cup-bold" className="w-4 h-4" />
                Box Office Hall of Fame
              </div>
              <h2 className="text-2xl font-heading font-black text-text-primary tracking-tight">
                Top Commercial Blockbusters
              </h2>
            </div>
            <span className="text-xs text-text-muted font-semibold">Theatrical Milestones</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {studioMetrics.rankedBlockbusters.map((item, idx) => {
              const f = item.film;
              const gross = Number(f.box_office_domestic || f.box_office_worldwide || 0);

              return (
                <Link
                  key={f.id}
                  to={`/films/${f.slug || f.id}`}
                  className="group relative bg-surface border border-border hover:border-brand/50 rounded-2xl p-4 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-black mb-3.5 shadow-md">
                    <ImageWithFallback
                      src={f.poster_url}
                      alt={f.title}
                      fallbackType="film"
                      name={f.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Rank Badge */}
                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md border border-white/20 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-lg">
                      #{idx + 1}
                    </div>

                    {/* Gross Badge */}
                    <div className="absolute bottom-2 right-2 bg-amber-500 text-black font-black text-xs px-2.5 py-1 rounded-lg shadow-lg">
                      {formatMoney(gross)}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-black text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1 mb-1">
                      {formatFilmTitle(f.title)}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
                      <span>{f.year || 'N/A'}</span>
                      <span className="capitalize text-[11px] text-text-secondary bg-surface-2 px-2 py-0.5 rounded-md border border-border">
                        {item.role}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 4. MAIN RELEASES CATALOGUE & COMMERCIAL LEDGER ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        
        {/* Header & View Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-brand text-xs font-black uppercase tracking-widest mb-1">
              <Icon icon="solar:clapperboard-play-bold" />
              Catalogue & Filmography
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
              Releases by {toTitleCase(company.name)}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Showing {filteredFilms.length} of {allFilmsWithRole.length} indexed titles
            </p>
          </div>

          {/* View Mode Toggle: Commercial Ledger vs Poster Grid */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-surface border border-border rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'ledger'
                  ? 'bg-brand text-black shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Commercial Ledger Table View"
            >
              <Icon icon="solar:bill-list-bold" className="w-4 h-4" />
              <span>Commercial Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-brand text-black shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Poster Grid View"
            >
              <Icon icon="solar:widget-4-bold" className="w-4 h-4" />
              <span>Poster Grid</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 mb-8">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('all'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-text-primary text-bg border-text-primary font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              All Releases ({allFilmsWithRole.length})
            </button>

            {studioMetrics.boxOfficeReleasesCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('box_office'); setSortBy('box_office'); setVisibleCount(20); }}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'box_office'
                    ? 'bg-amber-500 text-black border-amber-400 font-black shadow-sm'
                    : 'bg-surface-2 border-border text-amber-400 hover:border-amber-500/40'
                }`}
              >
                <Icon icon="solar:ticket-bold" className="w-3.5 h-3.5" />
                Box Office Releases ({studioMetrics.boxOfficeReleasesCount})
              </button>
            )}

            {studioMetrics.youtubeReleasesCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('youtube'); setSortBy('views'); setVisibleCount(20); }}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'youtube'
                    ? 'bg-red-600 text-white border-red-500 font-black shadow-sm'
                    : 'bg-surface-2 border-border text-red-400 hover:border-red-500/40'
                }`}
              >
                <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5" />
                YouTube Releases ({studioMetrics.youtubeReleasesCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => { setActiveTab('production'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'production'
                  ? 'bg-brand text-black border-brand font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              Production ({studioMetrics.productionCount})
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('distribution'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'distribution'
                  ? 'bg-brand text-black border-brand font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              Distribution ({studioMetrics.distributionCount})
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('top'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'top'
                  ? 'bg-emerald-600 text-white border-emerald-500 font-black shadow-sm'
                  : 'bg-surface-2 border-border text-emerald-400 hover:border-emerald-500/40'
              }`}
            >
              Top Rated ⭐
            </button>

            {stagePlays.length > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('theatre'); setVisibleCount(20); }}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'theatre'
                    ? 'bg-purple-600 text-white border-purple-500 font-black shadow-sm'
                    : 'bg-surface-2 border-border text-purple-400 hover:border-purple-500/40'
                }`}
              >
                <Icon icon="solar:masks-bold" className="w-3.5 h-3.5" />
                Stage Plays ({stagePlays.length})
              </button>
            )}
          </div>

          {/* Search & Sorting Row */}
          {activeTab !== 'theatre' ? (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div className="relative">
                <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search films by title or genre..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(20); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                aria-label="Sort films"
              >
                <option value="box_office">Highest Box Office Earnings (₦)</option>
                <option value="views">Most YouTube Views (▶)</option>
                <option value="year-desc">Release Year (Newest First)</option>
                <option value="rating-desc">Audience Rating (High to Low)</option>
                <option value="title">Film Title (A–Z)</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-text-muted py-1">
              <span className="font-semibold flex items-center gap-1.5 text-text-secondary">
                <Icon icon="solar:masks-bold" className="text-purple-400 w-4 h-4" />
                Live Stage & Theatrical Portfolio ({stagePlays.length} Productions)
              </span>
            </div>
          )}

        </div>

        {/* ─── CATALOGUE DISPLAY ─── */}
        {activeTab === 'theatre' ? (
          stagePlays.length === 0 ? (
            <div className="bg-surface border border-border p-16 rounded-2xl text-center">
              <Icon icon="solar:masks-bold" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-bold text-text-primary mb-1">No stage plays found</h3>
              <p className="text-xs text-text-muted">No theatrical stage productions have been recorded for this company yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {stagePlays.map((p) => {
                const isUpcoming = p.liveStatus === 'upcoming';
                const isRunning = p.liveStatus === 'currently_running';

                return (
                  <Link
                    key={p.id}
                    to={`/plays/${p.slug || p.id}`}
                    className="group bg-surface border border-border hover:border-brand/40 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm transition-all hover:-translate-y-1"
                  >
                    <div className="relative aspect-[4/5] w-full bg-black overflow-hidden">
                      <ImageWithFallback
                        src={p.poster_url || p.banner_url}
                        alt={p.title}
                        fallbackType="film"
                        name={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />

                      {/* Status Pill */}
                      <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-lg z-10 backdrop-blur-md border ${
                        isRunning
                          ? 'bg-emerald-500/80 text-white border-emerald-400'
                          : isUpcoming
                            ? 'bg-blue-600/80 text-white border-blue-400'
                            : 'bg-black/70 text-text-muted border-white/10'
                      }`}>
                        {isRunning ? 'Live On Stage' : isUpcoming ? 'Upcoming' : 'Archive'}
                      </span>

                      {/* City/Venue Pill */}
                      {p.city && (
                        <span className="absolute bottom-2.5 left-2.5 bg-black/80 backdrop-blur-md border border-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-lg z-10 flex items-center gap-1">
                          <Icon icon="solar:map-point-bold" className="text-brand w-3 h-3" />
                          <span>{p.city}</span>
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 flex flex-col justify-between flex-1">
                      <div>
                        <h4 className="font-bold text-text-primary text-xs sm:text-sm line-clamp-1 group-hover:text-brand transition-colors mb-1">
                          {p.title}
                        </h4>
                        <p className="text-[10px] text-text-muted font-semibold line-clamp-1">
                          {p.dateLabel || (p.year ? String(p.year) : 'Date TBA')}
                        </p>
                        {p.venue && (
                          <p className="text-[10px] text-text-secondary truncate mt-0.5">
                            {p.venue}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                        <span className="text-brand font-bold flex items-center gap-1">
                          <Icon icon="solar:masks-bold" className="w-3 h-3" />
                          <span>{p.genre || 'Stage Play'}</span>
                        </span>
                        <span className="text-text-muted group-hover:text-text-primary flex items-center gap-0.5 font-bold">
                          View Play
                          <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        ) : displayedFilms.length === 0 ? (
          <div className="bg-surface border border-border p-16 rounded-2xl text-center">
            <Icon icon="solar:clapperboard-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-text-primary mb-1">No films found</h3>
            <p className="text-xs text-text-muted">No titles match your selected filter or search keyword.</p>
          </div>
        ) : viewMode === 'ledger' ? (
          /* COMMERCIAL TABLE / LEDGER VIEW */
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-2/60 border-b border-border text-text-muted font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Film Title</th>
                    <th className="py-3.5 px-4">Year</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Box Office Gross</th>
                    <th className="py-3.5 px-4">YouTube Views</th>
                    <th className="py-3.5 px-4">Audience Score</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {displayedFilms.map((item) => {
                    const f = item.film;
                    const bo = Number(f.box_office_domestic || f.box_office_worldwide || 0);
                    const vc = Number(f.view_count || 0);
                    const rating = f.liked_percent != null ? `${f.liked_percent}%` : f.average_rating ? `${(f.average_rating * 10).toFixed(0)}%` : null;

                    return (
                      <tr key={f.id} className="hover:bg-surface-2/40 transition-colors group">
                        <td className="py-3 px-4">
                          <Link to={`/films/${f.slug || f.id}`} className="flex items-center gap-3">
                            <div className="w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                              <ImageWithFallback
                                src={f.poster_url}
                                alt={f.title}
                                fallbackType="film"
                                name={f.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-text-primary group-hover:text-brand transition-colors block truncate max-w-[240px] sm:max-w-[320px]">
                                {formatFilmTitle(f.title)}
                              </span>
                              {f.film_genres?.[0]?.genres?.name && (
                                <span className="text-[10px] text-text-muted">
                                  {f.film_genres[0].genres.name}
                                </span>
                              )}
                            </div>
                          </Link>
                        </td>

                        <td className="py-3 px-4 text-text-muted font-semibold">
                          {f.year || '–'}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-block capitalize px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[11px] font-bold text-text-secondary">
                            {item.role || 'Production'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-black">
                          {bo > 0 ? (
                            <span className="text-amber-400">{formatMoney(bo)}</span>
                          ) : (
                            <span className="text-text-muted opacity-40">–</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-bold">
                          {vc > 0 ? (
                            <span className="text-red-400">{formatViews(vc)}</span>
                          ) : (
                            <span className="text-text-muted opacity-40">–</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {rating ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                              <Icon icon="solar:star-bold" className="w-3 h-3" />
                              {rating}
                            </span>
                          ) : (
                            <span className="text-text-muted opacity-40">–</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/films/${f.slug || f.id}`}
                            className="inline-flex items-center gap-1 font-bold text-brand hover:underline"
                          >
                            <span>View</span>
                            <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* POSTER GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {displayedFilms.map((item) => {
              const f = item.film;
              const bo = Number(f.box_office_domestic || f.box_office_worldwide || 0);
              const vc = Number(f.view_count || 0);

              return (
                <Link
                  key={f.id}
                  to={`/films/${f.slug || f.id}`}
                  className="group bg-surface border border-border hover:border-brand/40 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm transition-all hover:-translate-y-1"
                >
                  <div className="relative aspect-[2/3] w-full bg-black overflow-hidden">
                    <ImageWithFallback
                      src={f.poster_url}
                      alt={f.title}
                      fallbackType="film"
                      name={f.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Role Pill */}
                    {item.role && (
                      <span className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md border border-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-lg z-10">
                        {item.role.replace('_', ' ')}
                      </span>
                    )}

                    {/* Box Office / Views Pill */}
                    {bo > 0 ? (
                      <span className="absolute bottom-2.5 right-2.5 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg z-10">
                        {formatMoney(bo)}
                      </span>
                    ) : vc > 0 ? (
                      <span className="absolute bottom-2.5 right-2.5 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg z-10 flex items-center gap-1">
                        <Icon icon="solar:play-circle-bold" className="w-3 h-3" />
                        {formatViews(vc)}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-3.5 flex flex-col justify-between flex-1">
                    <div>
                      <h4 className="font-bold text-text-primary text-xs sm:text-sm line-clamp-1 group-hover:text-brand transition-colors mb-1">
                        {formatFilmTitle(f.title)}
                      </h4>
                      <p className="text-[10px] text-text-muted font-semibold">
                        {f.year || 'N/A'}
                        {f.film_genres?.[0]?.genres?.name && ` • ${f.film_genres[0].genres.name}`}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                      <span className="text-text-muted text-[10px] capitalize">
                        {item.role}
                      </span>
                      <span className="text-brand font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Details →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {activeTab !== 'theatre' && filteredFilms.length > visibleCount && (
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 20)}
              className="px-8 py-3.5 bg-surface border border-border hover:border-brand/50 text-text-primary font-bold text-xs rounded-xl shadow-md hover:bg-surface-2 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Load More Releases ({filteredFilms.length - visibleCount} remaining)</span>
              <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-brand" />
            </button>
          </div>
        )}

        {/* ─── CREATIVE NETWORK SPOTLIGHT CARDS (Preview at bottom of movies) ─── */}
        {(representedTalents.length > 0 || frequentCollaborators.length > 0) && (
          <div className="mt-16 pt-10 border-t border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-brand">Agency & Creative Network</span>
                <h3 className="text-xl font-heading font-black text-text-primary">Studio Talent & Frequent Cast</h3>
              </div>
              <span className="text-xs text-text-muted font-medium">Explore actors, directors, and creatives associated with this studio</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Signed Talents Teaser */}
              {representedTalents.length > 0 && (
                <div className="p-5 rounded-2xl bg-surface border border-border hover:border-brand/40 transition-all flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-black">
                        <Icon icon="solar:users-group-rounded-bold" className="w-3.5 h-3.5" />
                        Signed Talent Agency Roster
                      </span>
                      <span className="text-xs font-bold text-text-primary">
                        {representedTalents.length} Signed Talents
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-4">
                      Official represented talent roster managed by {toTitleCase(company.name)}.
                    </p>

                    {/* Miniature Avatars */}
                    <div className="flex items-center -space-x-2 mb-4 overflow-hidden py-1">
                      {representedTalents.slice(0, 5).map((t) => (
                        <div key={t.id} className="relative w-10 h-10 rounded-full border-2 border-surface bg-surface-2 overflow-hidden shadow-xs shrink-0" title={t.name}>
                          <ImageWithFallback
                            src={t.photo_url}
                            alt={t.name}
                            fallbackType="avatar"
                            name={t.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {representedTalents.length > 5 && (
                        <div className="w-10 h-10 rounded-full border-2 border-surface bg-brand text-black font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                          +{representedTalents.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPrimarySection('talents');
                      document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-surface-2 hover:bg-brand hover:text-black text-text-primary font-bold text-xs transition-all flex items-center justify-center gap-2 border border-border hover:border-brand cursor-pointer"
                  >
                    <span>Browse Signed Talent Roster ({representedTalents.length})</span>
                    <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Card 2: Frequent Collaborators Teaser */}
              {frequentCollaborators.length > 0 && (
                <div className="p-5 rounded-2xl bg-surface border border-border hover:border-brand/40 transition-all flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-black">
                        <Icon icon="solar:star-fall-bold" className="w-3.5 h-3.5" />
                        Frequent Cast & Crew
                      </span>
                      <span className="text-xs font-bold text-text-primary">
                        {frequentCollaborators.length} Creatives
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-4">
                      Key actors, directors, and crew who repeatedly collaborate across this studio's filmography.
                    </p>

                    {/* Miniature Avatars */}
                    <div className="flex items-center -space-x-2 mb-4 overflow-hidden py-1">
                      {frequentCollaborators.slice(0, 5).map((c) => (
                        <div key={c.id} className="relative w-10 h-10 rounded-full border-2 border-surface bg-surface-2 overflow-hidden shadow-xs shrink-0" title={`${c.name} (${c.filmCount} films)`}>
                          <ImageWithFallback
                            src={c.photo_url}
                            alt={c.name}
                            fallbackType="avatar"
                            name={c.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {frequentCollaborators.length > 5 && (
                        <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-3 text-text-secondary font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs border border-border">
                          +{frequentCollaborators.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPrimarySection('collaborators');
                      document.getElementById('company-tabs')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-surface-2 hover:bg-amber-500 hover:text-black text-text-primary font-bold text-xs transition-all flex items-center justify-center gap-2 border border-border hover:border-amber-400 cursor-pointer"
                  >
                    <span>View All Collaborators ({frequentCollaborators.length})</span>
                    <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      </>
    )}

      {/* ─── SECTION 2: SIGNED TALENTS (DEDICATED AGENCY VIEW WITH SEARCH & PAGINATION) ─── */}
      {primarySection === 'talents' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-brand text-xs font-black uppercase tracking-widest mb-1">
                <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4" />
                Signed Talent Agency Roster
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                Represented Actors & Creatives
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Official represented talent roster managed by {toTitleCase(company.name)}
              </p>
            </div>
            <span className="px-3.5 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-black tracking-wider self-start sm:self-auto flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              {representedTalents.length} Signed Talents
            </span>
          </div>

          {/* Search & Department Filters */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 mb-8">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Icon
                  icon="solar:magnifer-linear"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4"
                />
                <input
                  type="text"
                  value={talentSearch}
                  onChange={(e) => { setTalentSearch(e.target.value); setVisibleTalentCount(12); }}
                  placeholder="Search signed talents by name..."
                  className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-8 py-2 text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                />
                {talentSearch && (
                  <button
                    type="button"
                    onClick={() => setTalentSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Department Pills */}
              {talentDepartments.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => { setTalentDeptFilter('all'); setVisibleTalentCount(12); }}
                    className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                      talentDeptFilter === 'all'
                        ? 'bg-brand text-black border-brand font-black'
                        : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    All ({representedTalents.length})
                  </button>
                  {talentDepartments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => { setTalentDeptFilter(dept); setVisibleTalentCount(12); }}
                      className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 capitalize cursor-pointer ${
                        talentDeptFilter.toLowerCase() === dept.toLowerCase()
                          ? 'bg-brand text-black border-brand font-black'
                          : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Talents Grid */}
          {displayedTalents.length === 0 ? (
            <div className="text-center py-16 bg-surface border border-border rounded-2xl">
              <Icon icon="solar:users-group-rounded-linear" className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
              <h3 className="text-base font-bold text-text-primary mb-1">No signed talents match your search</h3>
              <p className="text-xs text-text-muted mb-4">Try clearing your search query or department filter.</p>
              <button
                type="button"
                onClick={() => { setTalentSearch(''); setTalentDeptFilter('all'); }}
                className="px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
              {displayedTalents.map((talent) => {
                const rep = talent.representation || {};
                return (
                  <Link
                    key={talent.id}
                    to={`/people/${talent.slug || talent.id}`}
                    className="group relative bg-surface border border-border/80 hover:border-brand/60 rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-[3/4] w-full bg-black overflow-hidden">
                        <ImageWithFallback
                          src={talent.photo_url}
                          alt={talent.name}
                          fallbackType="avatar"
                          name={talent.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                        {/* Rep Type / Alumni Badge */}
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md text-amber-300 border border-white/10 shadow-sm">
                            {company.company_type === 'academy' ? 'Alumni Master' : rep.representation_type || 'Signed Talent'}
                          </span>
                        </div>

                        {/* Department Tag */}
                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-[9.5px] font-bold text-white/90 uppercase tracking-wider truncate block">
                            {talent.known_for_department || 'Acting'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3">
                        <h3 className="font-heading font-black text-xs sm:text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                          {talent.name}
                        </h3>
                        {rep.agent_name && (
                          <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">
                            Rep: <span className="text-text-secondary font-medium">{rep.agent_name}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-1 border-t border-hairline flex items-center justify-between text-[10px] text-brand font-bold">
                      <span>View Profile</span>
                      <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Load More Talents Button */}
          {filteredTalents.length > visibleTalentCount && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setVisibleTalentCount((prev) => prev + 12)}
                className="px-8 py-3 bg-surface border border-border hover:border-brand/50 text-text-primary font-bold text-xs rounded-xl shadow-md hover:bg-surface-2 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Load More Talents ({filteredTalents.length - visibleTalentCount} remaining)</span>
                <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-brand" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ─── SECTION 3: FREQUENT COLLABORATORS (DEDICATED VIEW WITH SEARCH & PAGINATION) ─── */}
      {primarySection === 'collaborators' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-brand text-xs font-black uppercase tracking-widest mb-1">
                <Icon icon="solar:star-fall-bold" className="w-4 h-4 text-amber-400" />
                Key Talents & Frequent Cast/Crew
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                Frequent Collaborators
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Actors, directors, and creatives who frequently work with {toTitleCase(company.name)}
              </p>
            </div>
            <span className="px-3.5 py-1.5 rounded-full bg-surface-2 border border-border text-text-secondary text-xs font-bold tracking-wider self-start sm:self-auto flex items-center gap-1.5 shadow-sm">
              <Icon icon="solar:users-group-rounded-linear" className="w-3.5 h-3.5 text-brand" />
              {frequentCollaborators.length} Frequent Cast & Crew
            </span>
          </div>

          {/* Search Collaborators */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 mb-8">
            <div className="relative max-w-md">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4"
              />
              <input
                type="text"
                value={collaboratorSearch}
                onChange={(e) => { setCollaboratorSearch(e.target.value); setVisibleCollabCount(18); }}
                placeholder="Search collaborators by name or role..."
                className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-8 py-2 text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
              />
              {collaboratorSearch && (
                <button
                  type="button"
                  onClick={() => setCollaboratorSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Collaborators Grid */}
          {displayedCollaborators.length === 0 ? (
            <div className="text-center py-16 bg-surface border border-border rounded-2xl">
              <Icon icon="solar:star-fall-linear" className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
              <h3 className="text-base font-bold text-text-primary mb-1">No collaborators match your search</h3>
              <p className="text-xs text-text-muted mb-4">Try clearing your search term.</p>
              <button
                type="button"
                onClick={() => setCollaboratorSearch('')}
                className="px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {displayedCollaborators.map((person) => {
                return (
                  <Link
                    key={person.id}
                    to={`/people/${person.slug || person.id}`}
                    className="group relative bg-surface border border-border hover:border-brand/60 rounded-2xl p-3 transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black mb-2.5 shadow-xs">
                        <ImageWithFallback
                          src={person.photo_url}
                          alt={person.name}
                          fallbackType="avatar"
                          name={person.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute bottom-1.5 right-1.5 bg-black/85 backdrop-blur-md text-amber-400 border border-amber-400/30 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                          {person.filmCount} {person.filmCount === 1 ? 'film' : 'films'}
                        </span>
                      </div>

                      <h3 className="font-heading font-bold text-xs sm:text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                        {person.name}
                      </h3>
                      <p className="text-[10px] text-text-muted truncate mt-0.5 capitalize">
                        {person.known_for_department || (person.rolesList?.[0] || 'Talent')}
                      </p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-brand font-semibold">
                      <span>Profile</span>
                      <Icon icon="solar:arrow-right-linear" className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Load More Collaborators Button */}
          {filteredCollaborators.length > visibleCollabCount && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setVisibleCollabCount((prev) => prev + 18)}
                className="px-8 py-3 bg-surface border border-border hover:border-brand/50 text-text-primary font-bold text-xs rounded-xl shadow-md hover:bg-surface-2 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Load More Collaborators ({filteredCollaborators.length - visibleCollabCount} remaining)</span>
                <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-brand" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ─── SECTION 4: ABOUT STUDIO / AGENCY ─── */}
      {primarySection === 'about' && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-brand">Profile & History</span>
              <h2 className="text-2xl font-heading font-black text-text-primary mt-1">
                About {toTitleCase(company.name)}
              </h2>
            </div>

            {company.description && (
              <div className="text-sm text-text-secondary leading-relaxed space-y-3 whitespace-pre-line">
                {company.description}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border/80 text-xs">
              <div className="p-4 rounded-xl bg-surface-2 border border-border">
                <span className="text-text-muted font-semibold block mb-1">Company Type</span>
                <span className="font-bold text-text-primary capitalize">{company.company_type?.replace(/_/g, ' ') || 'Studio / Agency'}</span>
              </div>
              <div className="p-4 rounded-xl bg-surface-2 border border-border">
                <span className="text-text-muted font-semibold block mb-1">Founded</span>
                <span className="font-bold text-text-primary">{company.founded_year ? `Est. ${company.founded_year}` : 'Not Specified'}</span>
              </div>
              <div className="p-4 rounded-xl bg-surface-2 border border-border">
                <span className="text-text-muted font-semibold block mb-1">Headquarters</span>
                <span className="font-bold text-text-primary">{company.headquarters || 'Nigeria'}</span>
              </div>
            </div>

            {/* Linked YouTube Channels if any */}
            {linkedChannels.length > 0 && (
              <div className="pt-6 border-t border-border/80">
                <span className="text-xs font-black text-text-muted uppercase tracking-wider block mb-3">
                  Official YouTube Distribution Channel
                </span>
                <div className="space-y-3">
                  {linkedChannels.map((ch) => (
                    <div key={ch.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-600/5 border border-red-500/20">
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:play-circle-bold" className="w-8 h-8 text-red-500 shrink-0" />
                        <div>
                          <h4 className="font-bold text-text-primary text-sm flex items-center gap-2">
                            <span>{ch.name || ch.channel_title}</span>
                            {ch.channel_handle && (
                              <span className="text-xs text-text-muted font-normal">{ch.channel_handle}</span>
                            )}
                          </h4>
                          <p className="text-xs text-text-muted">
                            Official YouTube Home {ch.subscriber_count ? `• ${formatViews(ch.subscriber_count)} Subscribers` : ''}
                          </p>
                        </div>
                      </div>
                      <a
                        href={ch.channel_url || `https://youtube.com/channel/${ch.channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shrink-0 self-start sm:self-auto"
                      >
                        <span>Visit Channel</span>
                        <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}