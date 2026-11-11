import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  fetchPortfolioByHandle,
  computePortfolioMetrics,
} from '../lib/portfolioClient';
import { MIRROR_FINISHES, LIVE_STATUS_PRESETS } from '../components/mirror/mirrorThemes';
import LumiMirrorToolbar from '../components/mirror/LumiMirrorToolbar';
import LumiMirrorCard from '../components/mirror/LumiMirrorCard';
import LumiMirrorBento from '../components/mirror/LumiMirrorBento';
import { toTitleCase } from '../utils/format';

/**
 * Fallback flagship creator profile for instant sandbox testing
 * when testing handles not yet populated with full media.
 */
const FALLBACK_SHOWCASE_CREATORS = {
  'tope-adebayo': {
    person: {
      id: 'tope-adebayo-demo',
      name: 'Tope Adebayo',
      slug: 'tope-adebayo',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
      bio: 'Award-winning Nollywood director & visionary behind King of Thieves (Agesinkole) and Jagun Jagun. Championing epic Yoruba cinema and boundary-pushing African storytelling.',
      is_verified: true,
      booking_email: 'management@topeadebayo.com',
      booking_whatsapp: '+2348030001122',
      instagram_url: 'https://instagram.com/topeadebayosalami',
      twitter_url: 'https://twitter.com/topeadebayo',
      youtube_handle: 'TopeAdebayoFilms',
    },
    portfolio: {
      handle: 'tope-adebayo',
      tagline: 'Director • Epic Yoruba & African Cinematic Storytelling',
      featured_reel_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      inquiry_email: 'productions@topeadebayostudios.com',
    },
    films: [
      {
        id: 'film-1',
        title: 'King of Thieves (Agesinkole)',
        slug: 'king-of-thieves',
        year: 2022,
        roles: ['Director'],
        poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
        backdrop_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80',
        box_office_domestic: 320800000,
        view_count: 8500000,
      },
      {
        id: 'film-2',
        title: 'Jagun Jagun (The Warrior)',
        slug: 'jagun-jagun',
        year: 2023,
        roles: ['Co-Director'],
        poster_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&auto=format&fit=crop&q=80',
        backdrop_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1000&auto=format&fit=crop&q=80',
        box_office_domestic: 450000000,
        view_count: 14200000,
      },
      {
        id: 'film-3',
        title: 'Seven and a Half Dates',
        slug: 'seven-and-a-half-dates',
        year: 2018,
        roles: ['Director'],
        poster_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&auto=format&fit=crop&q=80',
        backdrop_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&auto=format&fit=crop&q=80',
        box_office_domestic: 120000000,
      },
    ],
    stageCredits: [
      {
        role: 'Director',
        character_name: null,
        play: {
          title: 'DURO: Wait to be Pampered',
          slug: 'duro-wait-to-be-pampered',
          venue_name: 'Terra Kulture, Victoria Island',
          poster_url: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?w=400&auto=format&fit=crop&q=80',
        },
      },
    ],
    metrics: {
      hasCommercialFootprint: true,
      formattedBoxOffice: '₦890.8M',
      formattedViews: '22.7M',
      formattedStageBoxOffice: '₦34.5M',
    },
  },
  'lateef-adedimeji': {
    person: {
      id: 'lateef-adedimeji-demo',
      name: 'Lateef Adedimeji',
      slug: 'lateef-adedimeji',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
      bio: 'Leading Nigerian actor and performer acclaimed for Lisabi, Ayinla, and Jagun Jagun. Known for unmatched emotional intensity and chameleon versatility across film and stage.',
      is_verified: true,
      booking_email: 'representation@lateefadedimeji.com',
      booking_whatsapp: '+2348021112233',
      instagram_url: 'https://instagram.com/adedimejilateef',
      twitter_url: 'https://twitter.com/theislatedimeji',
    },
    portfolio: {
      handle: 'lateef-adedimeji',
      tagline: 'Leading Actor • Stage Performer • Cultural Ambassador',
      featured_reel_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      inquiry_email: 'booking@lateefadedimeji.com',
    },
    films: [
      {
        id: 'film-l1',
        title: 'Lisabi: The Uprising',
        slug: 'lisabi-the-uprising',
        year: 2024,
        roles: ['Lead Actor (Lisabi)'],
        poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
        backdrop_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1000&auto=format&fit=crop&q=80',
        box_office_domestic: 520000000,
        view_count: 11000000,
      },
      {
        id: 'film-l2',
        title: 'Ayinla',
        slug: 'ayinla',
        year: 2021,
        roles: ['Lead Actor (Ayinla Omowura)'],
        poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
        backdrop_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1000&auto=format&fit=crop&q=80',
        box_office_domestic: 210000000,
      },
    ],
    stageCredits: [
      {
        role: 'Lead',
        character_name: 'Kurunmi',
        play: {
          title: 'Kurunmi: The Battle of Ijaiye',
          slug: 'kurunmi',
          venue_name: 'Muson Centre, Onikan',
          poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400&auto=format&fit=crop&q=80',
        },
      },
    ],
    metrics: {
      hasCommercialFootprint: true,
      formattedBoxOffice: '₦730.0M',
      formattedViews: '15.8M',
      formattedStageBoxOffice: '₦22.0M',
    },
  },
};

/**
 * Isolated Preview Page for Lumi Mirror
 * Route: /mirror-preview/:handle or /mirror-preview
 */
export default function LumiMirrorPreview() {
  const { handle: routeHandle } = useParams();
  const navigate = useNavigate();

  const activeHandle = (routeHandle || 'tope-adebayo').toLowerCase();

  const [finish, setFinish] = useState(MIRROR_FINISHES.obsidian);
  const [liveStatusKey, setLiveStatusKey] = useState('on_set');
  const [liveStatusText, setLiveStatusText] = useState('On Set filming in Ibadan');
  const [loading, setLoading] = useState(true);
  const [dbData, setDbData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchPortfolioByHandle(activeHandle)
      .then((res) => {
        if (!isMounted) return;
        setDbData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Sandbox handle fetch fallback to showcase:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeHandle]);

  // Merge live database data or fall back to high-fidelity showcase profile
  const creatorData = useMemo(() => {
    if (dbData?.person) {
      const computedMetrics = computePortfolioMetrics(dbData.films || [], dbData.stageCredits || []);
      return {
        person: dbData.person,
        portfolio: dbData.portfolio || { handle: activeHandle },
        films: dbData.films || [],
        stageCredits: dbData.stageCredits || [],
        metrics: computedMetrics,
      };
    }

    const fallback = FALLBACK_SHOWCASE_CREATORS[activeHandle] || FALLBACK_SHOWCASE_CREATORS['tope-adebayo'];
    return fallback;
  }, [dbData, activeHandle]);

  const { person, portfolio, films, stageCredits, metrics } = creatorData;

  // Constructed roles string
  const rolesString = useMemo(() => {
    if (!person) return 'Filmmaker';
    const roleSet = new Set();
    if (Array.isArray(person.roles)) {
      person.roles.forEach((r) => r && roleSet.add(toTitleCase(String(r).trim())));
    }
    films.forEach((f) => {
      (f.roles || []).forEach((r) => {
        const lower = String(r).toLowerCase();
        if (lower.includes('direct')) roleSet.add('Director');
        else if (lower.includes('produc')) roleSet.add('Producer');
        else if (lower.includes('act') || lower.includes('cast') || lower.includes('lead')) roleSet.add('Actor');
        else if (lower.includes('writ') || lower.includes('screen')) roleSet.add('Writer');
      });
    });
    if (stageCredits.length > 0) roleSet.add('Theatre');

    const arr = Array.from(roleSet);
    return arr.length > 0 ? arr.slice(0, 3).join(' • ') : 'Filmmaker & Producer';
  }, [person, films, stageCredits]);

  const handleFinishChange = (finishId) => {
    const nextFinish = MIRROR_FINISHES[finishId] || MIRROR_FINISHES.obsidian;
    setFinish(nextFinish);
    toast.success(`Optical Finish: ${nextFinish.name}`, {
      icon: '🪞',
      style: { background: '#18181B', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
    });
  };

  const handleStatusChange = (statusKey) => {
    setLiveStatusKey(statusKey);
    const preset = LIVE_STATUS_PRESETS.find((p) => p.key === statusKey);
    if (preset) {
      setLiveStatusText(preset.defaultText);
      toast.success(`Live Line: ${preset.label}`, {
        icon: '🟢',
        style: { background: '#18181B', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
      });
    }
  };

  const handleCustomStatus = (text) => {
    if (!text.trim()) return;
    setLiveStatusText(text.trim());
    toast.success('Live Line updated!', {
      icon: '✨',
      style: { background: '#18181B', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
    });
  };

  const handleCreatorChange = (newHandle) => {
    navigate(`/mirror-preview/${newHandle}`);
  };

  return (
    <div
      className={`min-h-screen ${finish.bg} text-white selection:bg-brand selection:text-black font-sans relative overflow-x-hidden pb-20`}
    >
      {/* Background Ambient Spotlight Halo */}
      <div
        className={`fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-gradient-to-b ${finish.ambientGlow} blur-[120px] opacity-40 pointer-events-none z-0`}
      />

      {/* Floating Sandbox Interactive Toolbar */}
      <LumiMirrorToolbar
        activeFinish={finish}
        onSelectFinish={handleFinishChange}
        activeStatusKey={liveStatusKey}
        onSelectStatus={handleStatusChange}
        onCustomStatusChange={handleCustomStatus}
        currentStatusText={liveStatusText}
        creatorHandle={activeHandle}
        onSelectCreator={handleCreatorChange}
      />

      {/* Main Column: Mobile-First link-in-bio viewport */}
      <main className="relative z-10 max-w-md sm:max-w-lg mx-auto px-4 space-y-4">
        {/* Brand Bar: Lumi Logo + Return Link */}
        <div className="flex items-center justify-between py-1.5 px-2">
          <Link to="/" className="flex items-center group select-none">
            <img
              src="/images/MuviDB Brand/White Wordmark.svg"
              alt="Lumi"
              className="h-6 sm:h-7 object-contain opacity-90 group-hover:opacity-100 transition"
            />
          </Link>

          <Link
            to={`/@${activeHandle}`}
            className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
            title="View original creator link"
          >
            <span>Original Link</span>
            <Icon icon="solar:arrow-right-up-linear" width="12" />
          </Link>
        </div>

        {/* ===================== THE MIRROR CARD ===================== */}
        <LumiMirrorCard
          person={person}
          portfolio={portfolio}
          handle={activeHandle}
          roles={rolesString}
          finish={finish}
          liveStatusText={liveStatusText}
          liveStatusCategory={liveStatusKey}
          onOpenLiveStatusEditor={() => {
            const nextIdx = (LIVE_STATUS_PRESETS.findIndex((p) => p.key === liveStatusKey) + 1) % LIVE_STATUS_PRESETS.length;
            handleStatusChange(LIVE_STATUS_PRESETS[nextIdx].key);
          }}
          avatarVideoUrl={portfolio.avatar_video_url}
        />

        {/* ===================== MODULAR BENTO GRID ===================== */}
        <LumiMirrorBento
          portfolio={portfolio}
          person={person}
          films={films}
          stageCredits={stageCredits}
          finish={finish}
          metrics={metrics}
        />

        {/* Footer Brand Seal */}
        <footer className="pt-8 text-center text-zinc-500 text-xs">
          <p className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
            <span>Powered by</span>
            <span className="font-bold text-white tracking-wider">LUMI</span>
            <span>• Cinema & Theatre Identity</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
