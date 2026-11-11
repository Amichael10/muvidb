import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  fetchPortfolioByHandle,
  computePortfolioMetrics,
} from '../lib/portfolioClient';
import { MIRROR_FINISHES, LIVE_STATUS_PRESETS } from '../components/mirror/mirrorThemes';
import MirraPhoneFrame from '../components/mirror/MirraPhoneFrame';
import MirraHeroMedia from '../components/mirror/MirraHeroMedia';
import MirraPromptBar from '../components/mirror/MirraPromptBar';
import MirraIdentityCard from '../components/mirror/MirraIdentityCard';
import MirraConnectRow from '../components/mirror/MirraConnectRow';
import MirraSlidesCarousel from '../components/mirror/MirraSlidesCarousel';
import MirraBottomDock from '../components/mirror/MirraBottomDock';
import LumiLiveLine from '../components/mirror/LumiLiveLine';
import LumiMirrorBackPass from '../components/mirror/LumiMirrorBackPass';
import { toTitleCase } from '../utils/format';

/**
 * Authentic Mirra Reference Personas matching user screenshots
 * alongside Nollywood & Theatre icons.
 */
const MIRRA_PRESET_PERSONAS = {
  'daniella-keys': {
    person: {
      id: 'daniella-keys',
      name: 'Daniella Keys',
      slug: 'daniella-keys',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=85',
      hero_media_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=90',
      bio: 'Content Creator and digital creative strategist at Brandized. Specializing in high-fashion editorial storytelling and luxury brand campaigns.',
      roles: ['Content Creator - Brandized'],
      is_verified: true,
      booking_email: 'daniella@brandized.co',
      booking_whatsapp: '+14155552671',
    },
    portfolio: {
      handle: 'daniella-keys',
      tagline: 'Content Creator - Brandized',
      inquiry_email: 'daniella@brandized.co',
    },
    connectionsCount: '246',
    mutualsList: 'Jack Farrell, Dacoda Smith, Kate Green... +160 mutuals',
    totalConnections: '105.8K Mirra Connections',
    liveStatusText: 'Shooting Fall Editorial with Brandized in Milan',
    liveStatusCategory: 'on_set',
    moments: [
      {
        id: 'd1',
        title: 'Milan Fashion Week',
        subtitle: 'Brandized Autumn Showcase',
        location: 'Milan, Italy',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 'd2',
        title: 'San Diego Coastline',
        subtitle: 'Golden Hour Visual Diary',
        location: 'San Diego',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 'd3',
        title: 'Carlsbad Studio Session',
        subtitle: 'Editorial Campaign Preview',
        location: 'Carlsbad',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
  'kristen-chase': {
    person: {
      id: 'kristen-chase',
      name: 'Kristen Chase',
      slug: 'kristen-chase',
      photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&auto=format&fit=crop&q=85',
      hero_media_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=90',
      bio: 'Executive Sports Agent managing international athletes, athletic brand deals, and global championship representation.',
      roles: ['Sports Agent'],
      is_verified: true,
      booking_email: 'chase@chasesportsagency.com',
      booking_whatsapp: '+12125559812',
    },
    portfolio: {
      handle: 'kristen-chase',
      tagline: 'Sports Agent • Talent Representation',
      inquiry_email: 'chase@chasesportsagency.com',
    },
    connectionsCount: '287',
    mutualsList: 'Jack Farrell, Dacoda Smith, Kate Green... +160 mutuals',
    totalConnections: '105.8K Mirra Connections',
    liveStatusText: 'Contract negotiations at Madison Square Garden',
    liveStatusCategory: 'available',
    moments: [
      {
        id: 'k1',
        title: 'Championship Finals',
        subtitle: 'Courtside Representation',
        location: 'New York City',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 'k2',
        title: 'Nike Global Briefing',
        subtitle: 'Athlete Endorsement Launch',
        location: 'Beaverton, OR',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
  'lea-bourad': {
    person: {
      id: 'lea-bourad',
      name: 'Lea Bourad',
      slug: 'lea-bourad',
      photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&auto=format&fit=crop&q=85',
      hero_media_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&auto=format&fit=crop&q=90',
      bio: 'Professional Alpine Skier and outdoor adventure influencer. Competing on European circuits and partnering with premium alpine gear brands.',
      roles: ['Professional Skier - Influencer'],
      is_verified: true,
      booking_email: 'management@leabourad.com',
      booking_whatsapp: '+33612345678',
    },
    portfolio: {
      handle: 'lea-bourad',
      tagline: 'Professional Skier - Influencer',
      inquiry_email: 'management@leabourad.com',
    },
    connectionsCount: '848',
    mutualsList: 'Chris Davis, Kate Green, Shara Khan... +45 mutuals',
    totalConnections: '26.2K Mirra Connections',
    liveStatusText: 'Training high altitude descent in Zermatt',
    liveStatusCategory: 'on_set',
    moments: [
      {
        id: 'l1',
        title: 'Matterhorn Alpine Run',
        subtitle: 'Winter Championship Prep',
        location: 'Zermatt, Switzerland',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 'l2',
        title: 'Glacier Training Camp',
        subtitle: 'Speed & Aerodynamics',
        location: 'Chamonix, France',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
  'tope-adebayo': {
    person: {
      id: 'tope-adebayo',
      name: 'Tope Adebayo',
      slug: 'tope-adebayo',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&auto=format&fit=crop&q=85',
      hero_media_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=90',
      bio: 'Award-winning Nollywood director & visionary behind King of Thieves and Jagun Jagun. Championing epic Yoruba cinema and boundary-pushing African storytelling.',
      roles: ['Director • Producer - Nollywood'],
      is_verified: true,
      booking_email: 'productions@topeadebayo.com',
      booking_whatsapp: '+2348030001122',
      instagram_url: 'https://instagram.com/topeadebayosalami',
    },
    portfolio: {
      handle: 'tope-adebayo',
      tagline: 'Director • Epic Yoruba & African Cinema',
      inquiry_email: 'productions@topeadebayo.com',
    },
    connectionsCount: '1.4K',
    mutualsList: 'Kunle Afolayan, Bimbo Ademoye, Lateef Adedimeji... +45 mutuals',
    totalConnections: '48.2K Lumi Audience & Connections',
    liveStatusText: 'On Set filming King of Thieves II in Oyo State',
    liveStatusCategory: 'on_set',
    moments: [
      {
        id: 't1',
        title: 'King of Thieves II',
        subtitle: 'Principal Photography',
        location: 'Ibadan, Oyo State',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 't2',
        title: 'Terra Kulture Premiere',
        subtitle: 'DURO Stage Production',
        location: 'Victoria Island, Lagos',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 't3',
        title: 'Jagun Jagun Red Carpet',
        subtitle: 'Global Cinema Launch',
        location: 'Filmhouse IMAX, Lekki',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
  'lateef-adedimeji': {
    person: {
      id: 'lateef-adedimeji',
      name: 'Lateef Adedimeji',
      slug: 'lateef-adedimeji',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&auto=format&fit=crop&q=85',
      hero_media_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=1200&auto=format&fit=crop&q=90',
      bio: 'Leading Nigerian actor and performer acclaimed for Lisabi, Ayinla, and Jagun Jagun. Renowned for emotional intensity and versatile stage craft.',
      roles: ['Leading Actor • Cultural Ambassador'],
      is_verified: true,
      booking_email: 'representation@lateefadedimeji.com',
      booking_whatsapp: '+2348021112233',
      instagram_url: 'https://instagram.com/adedimejilateef',
    },
    portfolio: {
      handle: 'lateef-adedimeji',
      tagline: 'Leading Actor • Stage Performer',
      inquiry_email: 'representation@lateefadedimeji.com',
    },
    connectionsCount: '2.1K',
    mutualsList: 'Mo Abudu, Kunle Afolayan, Femi Adebayo... +82 mutuals',
    totalConnections: '86.4K Lumi Audience & Connections',
    liveStatusText: 'Rehearsing Kurunmi at Terra Kulture, VI',
    liveStatusCategory: 'theatre',
    moments: [
      {
        id: 'la1',
        title: 'Lisabi: The Uprising',
        subtitle: 'Lead Role (Lisabi Agbongbo Akala)',
        location: 'Abeokuta, Ogun State',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 'la2',
        title: 'Kurunmi Stage Drama',
        subtitle: 'Muson Centre Festival',
        location: 'Onikan, Lagos',
        sound: 'sound off',
        image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
};

/**
 * Isolated Preview Page for Lumi Mirror (True Mirra Digital Persona Experience)
 * Route: /mirror-preview/:handle or /mirror-preview
 */
export default function LumiMirrorPreview() {
  const { handle: routeHandle } = useParams();
  const navigate = useNavigate();

  // Normalize handle (default to 'daniella-keys' to immediately match the user's uploaded screenshot #2)
  const activeHandle = (routeHandle || 'daniella-keys').toLowerCase();

  const [finish, setFinish] = useState(MIRROR_FINISHES.obsidian);
  const [isFlipped, setIsFlipped] = useState(false);
  const [dbData, setDbData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch database creator if it exists, otherwise fall back to preset
  useEffect(() => {
    let isMounted = true;
    if (activeHandle && !MIRRA_PRESET_PERSONAS[activeHandle]) {
      setLoading(true);
      fetchPortfolioByHandle(activeHandle)
        .then((res) => {
          if (!isMounted) return;
          setDbData(res);
          setLoading(false);
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setDbData(null);
    }
    return () => {
      isMounted = false;
    };
  }, [activeHandle]);

  // Resolve current persona
  const currentPersona = useMemo(() => {
    if (dbData?.person) {
      const p = dbData.person;
      const port = dbData.portfolio || {};
      const films = dbData.films || [];
      const computedMetrics = computePortfolioMetrics(films, dbData.stageCredits || []);

      return {
        person: {
          ...p,
          hero_media_url: films[0]?.backdrop_url || films[0]?.poster_url || p.photo_url,
        },
        portfolio: port,
        connectionsCount: '312',
        mutualsList: 'Nollywood Creators & Stage Guild... +38 mutuals',
        totalConnections: `${computedMetrics.formattedViews || '45K'} Lumi Audience`,
        liveStatusText: p.availability_note || 'On Set in Lagos • Open for Bookings',
        liveStatusCategory: 'on_set',
        moments: films.slice(0, 3).map((f, i) => ({
          id: f.id || `film-${i}`,
          title: f.title,
          subtitle: f.roles?.[0] || 'Production',
          location: f.year ? `Cinema ${f.year}` : 'Lagos, Nigeria',
          sound: 'sound off',
          image: f.backdrop_url || f.poster_url || p.photo_url,
        })),
      };
    }

    return MIRRA_PRESET_PERSONAS[activeHandle] || MIRRA_PRESET_PERSONAS['daniella-keys'];
  }, [dbData, activeHandle]);

  const {
    person,
    portfolio,
    connectionsCount,
    mutualsList,
    totalConnections,
    liveStatusText,
    liveStatusCategory,
    moments,
  } = currentPersona;

  const rolesText = useMemo(() => {
    if (Array.isArray(person.roles)) return person.roles.join(' • ');
    return person.roles || 'Content Creator';
  }, [person]);

  return (
    <div className="min-h-screen bg-[#07080A] text-white selection:bg-brand selection:text-black font-sans relative overflow-x-hidden flex flex-col items-center">
      {/* Top Sandbox Navigation Bar */}
      <header className="w-full max-w-xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between text-xs z-50">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="font-mono font-bold tracking-wider uppercase text-white">LUMI MIRROR</span>
          </Link>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">
            True Mirra UI
          </span>
        </div>

        {/* Persona Quick Switcher */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1 text-[11px]">
          {Object.entries({
            'daniella-keys': 'Daniella (Screenshot)',
            'kristen-chase': 'Kristen',
            'lea-bourad': 'Lea',
            'tope-adebayo': 'Tope (Nollywood)',
            'lateef-adedimeji': 'Lateef',
          }).map(([slug, label]) => (
            <button
              key={slug}
              type="button"
              onClick={() => navigate(`/mirror-preview/${slug}`)}
              className={`px-2.5 py-1 rounded-full font-medium transition ${
                activeHandle === slug
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Center Phone Mockup Frame */}
      <MirraPhoneFrame>
        <div className="relative w-full pb-28">
          {/* 1. Full-Bleed Living Video / Studio Portrait Hero */}
          <MirraHeroMedia
            mediaUrl={person.hero_media_url}
            posterUrl={person.photo_url}
            alt={person.name}
          />

          {/* 2. Floating Glass Stack (Overlapping the hero photo) */}
          <div className="relative -mt-28 px-3.5 space-y-3 z-20">
            {/* The "Ask me anything..." Glass Prompt Bar */}
            <MirraPromptBar
              placeholder={`Ask me anything...`}
              creatorName={person.name}
              onAsk={(q) => {
                toast(`Lumi AI: Analyzing "${q}" for ${person.name}...`, { icon: '✨' });
              }}
            />

            {/* 3D Flip Container: Front = Identity Card, Back = Holographic Pass */}
            <div className="perspective-1000 w-full">
              <div
                className={`relative w-full transition-transform duration-700 preserve-3d ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* Front: Mirra Identity Card */}
                <div className="w-full backface-hidden">
                  <MirraIdentityCard
                    person={person}
                    portfolio={portfolio}
                    handle={activeHandle}
                    roles={rolesText}
                    connectionsCount={connectionsCount}
                    onFlipPass={() => setIsFlipped(true)}
                    onOpenInquiry={() => {
                      toast(`Opening direct inquiry client for ${person.name}`, { icon: '✉️' });
                    }}
                  />
                </div>

                {/* Back: Holographic QR Pass */}
                <div className="absolute inset-0 w-full h-full rotate-y-180 backface-hidden">
                  <LumiMirrorBackPass
                    person={person}
                    handle={activeHandle}
                    roles={rolesText}
                    finish={finish}
                    onFlipBack={() => setIsFlipped(false)}
                  />
                </div>
              </div>
            </div>

            {/* Social Proof / Mutuals Connect Row */}
            <MirraConnectRow
              creatorName={person.name}
              mutualsList={mutualsList}
              totalConnections={totalConnections}
            />

            {/* The "Live Line" Real-time Status Pulse */}
            <LumiLiveLine
              statusText={liveStatusText}
              category={liveStatusCategory}
              updatedAt="Active now"
              onClick={() => {
                toast.success('Live Line is active & broadcasted to your card', { icon: '🟢' });
              }}
            />

            {/* "My life in slides™" / "Filmography in slides™" */}
            <MirraSlidesCarousel
              title="My life in slides™"
              moments={moments}
              onSelectMoment={(m) => {
                toast(`Viewing moment: ${m.title}`, { icon: '🎬' });
              }}
            />
          </div>
        </div>
      </MirraPhoneFrame>

      {/* Floating Bottom Frosted Navigation Dock */}
      <MirraBottomDock
        avatarUrl={person.photo_url}
        notificationCount="12"
      />
    </div>
  );
}
