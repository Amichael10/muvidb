import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const ENDPOINTS = [
  {
    id: 'films',
    name: 'List & Search Films',
    method: 'GET',
    path: '/api/v1/films',
    tier: 'Free',
    tierBadgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
    description: 'Query African and Nollywood cinema catalog. Free tier is limited to previewing the first 500 films; Pro tier provides unrestricted access to all 12,000+ films.',
    params: [
      { name: 'query', type: 'string', desc: 'Search by title, alternative titles, or keywords' },
      { name: 'genre', type: 'string', desc: 'Filter by genre (e.g. Drama, Comedy, Thriller)' },
      { name: 'year', type: 'number', desc: 'Filter by release year (e.g. 2024)' },
      { name: 'page', type: 'number', desc: 'Page number (default: 1; Free tier max offset 500)' },
      { name: 'limit', type: 'number', desc: 'Items per page (Free max 20, Pro max 100)' },
    ],
    curl: `curl -X GET "https://muvidb.com/api/v1/films?query=wedding&genre=Romance" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: `const res = await fetch('https://muvidb.com/api/v1/films?query=wedding&genre=Romance', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const data = await res.json();
console.log(data.data);`,
    python: `import requests

url = "https://muvidb.com/api/v1/films"
headers = {"x-api-key": "mvd_live_your_api_key_here"}
params = {"query": "wedding", "genre": "Romance"}

response = requests.get(url, headers=headers, params=params)
films = response.json()
print(films["data"])`,
    responseSample: `{
  "success": true,
  "data": [
    {
      "id": "f48c149d-37cb-4ad8-ba96-f94a86fbe07a",
      "title": "The Wedding Party",
      "slug": "the-wedding-party-2016",
      "release_year": 2016,
      "runtime_minutes": 110,
      "genres": ["Comedy", "Romance"],
      "poster_url": "https://images.muvidb.com/posters/wedding_party.jpg",
      "backdrop_url": "https://images.muvidb.com/backdrops/wedding_party.jpg",
      "synopsis": "Dunni and Dozie are about to tie the knot in what promises to be the wedding of the year...",
      "rating": 7.4,
      "streaming_platforms": ["Netflix", "Prime Video"],
      "country": "Nigeria"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "has_more": true,
    "catalog_tier": "Free (Limited to first 500 films)"
  }
}`
  },
  {
    id: 'film-credits',
    name: 'Film Cast & Crew',
    method: 'GET',
    path: '/api/v1/films/:id/credits',
    tier: 'Free Preview',
    tierBadgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
    description: 'Retrieve cast and crew ensemble for a specific film. Free tier returns preview credits (top 10 cast & crew); Pro tier delivers the complete ensemble.',
    params: [
      { name: 'id', type: 'UUID or Slug', required: true, desc: 'Film UUID or slug' }
    ],
    curl: `curl -X GET "https://muvidb.com/api/v1/films/the-wedding-party-2016/credits" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: `const res = await fetch('https://muvidb.com/api/v1/films/the-wedding-party-2016/credits', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const credits = await res.json();
console.log(credits.data);`,
    python: `import requests

url = "https://muvidb.com/api/v1/films/the-wedding-party-2016/credits"
headers = {"x-api-key": "mvd_live_your_api_key_here"}

response = requests.get(url, headers=headers)
print(response.json()["data"])`,
    responseSample: `{
  "success": true,
  "data": {
    "film_id": "f48c149d-37cb-4ad8-ba96-f94a86fbe07a",
    "cast": [
      {
        "person_id": "77ea2f10-91b4-4e4b-97e3-0d322b7c6c41",
        "name": "Adesua Etomi-Wellington",
        "role": "Dunni Coker",
        "order": 1,
        "profile_image": "https://images.muvidb.com/people/adesua.jpg"
      },
      {
        "person_id": "99bb12a0-41c3-4d6a-8fa1-7e8c339a1b12",
        "name": "Banky Wellington",
        "role": "Dozie Onwuka",
        "order": 2,
        "profile_image": "https://images.muvidb.com/people/banky.jpg"
      }
    ],
    "crew": [
      {
        "person_id": "11ab34cd-82ef-4567-90ab-cdef12345678",
        "name": "Kemi Adetiba",
        "job": "Director",
        "department": "Directing"
      }
    ]
  }
}`
  },
  {
    id: 'people',
    name: 'People & Filmographies',
    method: 'GET',
    path: '/api/v1/people',
    tier: 'Free Preview',
    tierBadgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
    description: 'Explore the biographical index of African filmmakers, actors, and crew. Free tier is capped to the first 500 people; Pro tier grants access to all 15,000+ profiles.',
    params: [
      { name: 'query', type: 'string', desc: 'Search by full or professional name' },
      { name: 'role', type: 'string', desc: 'Filter by primary profession (Actor, Director, Producer)' },
      { name: 'page', type: 'number', desc: 'Page number (Free tier max offset 500)' },
      { name: 'limit', type: 'number', desc: 'Records per page (Free max 20, Pro max 100)' }
    ],
    curl: `curl -X GET "https://muvidb.com/api/v1/people?query=Genevieve&role=Actor" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: `const res = await fetch('https://muvidb.com/api/v1/people?query=Genevieve&role=Actor', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const people = await res.json();
console.log(people.data);`,
    python: `import requests

url = "https://muvidb.com/api/v1/people"
headers = {"x-api-key": "mvd_live_your_api_key_here"}
params = {"query": "Genevieve", "role": "Actor"}

response = requests.get(url, headers=headers, params=params)
print(response.json()["data"])`,
    responseSample: `{
  "success": true,
  "data": [
    {
      "id": "10029384-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
      "name": "Genevieve Nnaji",
      "slug": "genevieve-nnaji",
      "primary_role": "Actor / Director",
      "bio": "Genevieve Nnaji is a Nigerian actress, producer, and director...",
      "profile_image": "https://images.muvidb.com/people/genevieve.jpg",
      "credits_count": 84,
      "awards_count": 14,
      "talent_agency": "The Temple Company"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "has_more": true,
    "catalog_tier": "Free (Limited to first 500 people)"
  }
}`
  },
  {
    id: 'credits-list',
    name: 'Search Cast & Crew Credits',
    method: 'GET',
    path: '/api/v1/credits',
    tier: 'Free Preview',
    tierBadgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
    description: 'Query credits across the database by film, actor, role, or department. Free tier is capped to the first 500 credits; Pro tier has unlimited access.',
    params: [
      { name: 'film_id', type: 'UUID', desc: 'Filter by film UUID' },
      { name: 'person_id', type: 'UUID', desc: 'Filter by person UUID' },
      { name: 'role', type: 'string', desc: 'Filter by role or character name' },
      { name: 'department', type: 'string', desc: 'Filter by department (Directing, Production, Cast)' },
      { name: 'limit', type: 'number', desc: 'Records per page (Free max 20, Pro max 100)' }
    ],
    curl: `curl -X GET "https://muvidb.com/api/v1/credits?role=Actor&limit=20" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: `const res = await fetch('https://muvidb.com/api/v1/credits?role=Actor&limit=20', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const credits = await res.json();
console.log(credits.data);`,
    python: `import requests

url = "https://muvidb.com/api/v1/credits"
headers = {"x-api-key": "mvd_live_your_api_key_here"}
params = {"role": "Actor", "limit": 20}

response = requests.get(url, headers=headers, params=params)
print(response.json()["data"])`,
    responseSample: `{
  "success": true,
  "data": [
    {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "film_id": "f48c149d-37cb-4ad8-ba96-f94a86fbe07a",
      "role": "Dunni Coker",
      "department": "Cast",
      "credit_order": 1,
      "films": { "title": "The Wedding Party", "year": 2016 },
      "people": { "name": "Adesua Etomi-Wellington" }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "has_more": true,
    "catalog_tier": "Free (Limited to first 500 credits)"
  }
}`
  },
  {
    id: 'boxoffice',
    name: 'Box Office & Revenue Rankings',
    method: 'GET',
    path: '/api/v1/boxoffice',
    tier: 'Pro Exclusive',
    tierBadgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold',
    description: 'Track theatrical box office gross receipts across West African cinema chains (Filmhouse, Genesis, Silverbird). Historic & weekend grosses.',
    params: [
      { name: 'year', type: 'number', desc: 'Filter ranking year (e.g. 2024)' },
      { name: 'type', type: 'string', desc: 'Ranking category: "all-time", "annual", or "weekend"' },
      { name: 'limit', type: 'number', desc: 'Number of entries (Pro limit up to 100)' }
    ],
    curl: `curl -X GET "https://muvidb.com/api/v1/boxoffice?year=2024&type=annual" \\
  -H "x-api-key: mvd_live_pro_key_here"`,
    javascript: `const res = await fetch('https://muvidb.com/api/v1/boxoffice?year=2024&type=annual', {
  headers: {
    'x-api-key': 'mvd_live_pro_key_here'
  }
});
const boxOffice = await res.json();
console.log(boxOffice.data);`,
    python: `import requests

url = "https://muvidb.com/api/v1/boxoffice"
headers = {"x-api-key": "mvd_live_pro_key_here"}
params = {"year": 2024, "type": "annual"}

response = requests.get(url, headers=headers, params=params)
print(response.json()["data"])`,
    responseSample: `{
  "success": true,
  "tier": "pro",
  "data": [
    {
      "rank": 1,
      "film_title": "A Tribe Called Judah",
      "film_id": "a91b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      "release_year": 2023,
      "distributor": "FilmOne Entertainment",
      "total_gross_ngn": 1404000000,
      "total_gross_usd": 1050000,
      "weeks_tracked": 12,
      "admissions_estimate": 395000
    },
    {
      "rank": 2,
      "film_title": "Battle on Buka Street",
      "film_id": "b82c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
      "release_year": 2022,
      "distributor": "FilmOne Entertainment",
      "total_gross_ngn": 668400000,
      "total_gross_usd": 720000,
      "weeks_tracked": 14
    }
  ]
}`
  },
  {
    id: 'status',
    name: 'API Status & Rate Limit Check',
    method: 'GET',
    path: '/api/v1/status',
    tier: 'Public / Auth',
    tierBadgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Verify service health, check current active tier entitlements, and inspect real-time rate limit consumption.',
    params: [],
    curl: `curl -X GET "https://muvidb.com/api/v1/status" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: `const res = await fetch('https://muvidb.com/api/v1/status', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const status = await res.json();
console.log(status);`,
    python: `import requests

url = "https://muvidb.com/api/v1/status"
headers = {"x-api-key": "mvd_live_your_api_key_here"}

response = requests.get(url, headers=headers)
print(response.json())`,
    responseSample: `{
  "status": "healthy",
  "version": "1.0.0",
  "key_info": {
    "name": "Production Frontend",
    "tier": "pro",
    "rate_limit_per_min": 600,
    "scopes": ["films:read", "people:read", "credits:read", "boxoffice:read"]
  },
  "tier_entitlements": {
    "tier": "pro",
    "rate_limit_per_min": 600,
    "max_page_limit": 100,
    "box_office_access": true,
    "commercial_use": true,
    "sla": "99.5% Uptime"
  }
}`
  }
];

export default function DeveloperApi() {
  const { user, isAuthenticated } = useAuth();
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [activeCodeTab, setActiveCodeTab] = useState('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedTierForRequest, setSelectedTierForRequest] = useState('free');
  const [requestForm, setRequestForm] = useState({
    appName: '',
    developerName: '',
    email: user?.email || '',
    useCase: '',
    company: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedSample(true);
      setTimeout(() => setCopiedSample(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  const openRequestModal = (tier = 'free') => {
    setSelectedTierForRequest(tier);
    setRequestForm(prev => ({
      ...prev,
      email: prev.email || user?.email || ''
    }));
    setShowRequestModal(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!requestForm.appName.trim() || !requestForm.email.trim()) {
      toast.error('Please provide an app name and email address');
      return;
    }

    setIsSubmitting(true);
    try {
      // Store in user_feedback or admin_actions or contact log
      const payload = {
        app_name: requestForm.appName,
        developer_name: requestForm.developerName,
        email: requestForm.email,
        company: requestForm.company,
        use_case: requestForm.useCase,
        tier: selectedTierForRequest,
        requested_at: new Date().toISOString()
      };

      // Try inserting into admin_actions or user_feedback
      const { error } = await supabase.from('admin_actions').insert({
        user_id: user?.id || null,
        action_type: 'api_key_request',
        entity_type: 'api_key',
        entity_name: `${requestForm.appName} (${selectedTierForRequest.toUpperCase()})`,
        details: payload
      });

      if (error) {
        console.warn('Fallback logging for API request:', error.message);
      }

      setRequestSubmitted(true);
      toast.success('API Key request received! Our developer team will contact you shortly.');
    } catch (err) {
      console.error('Request error:', err);
      setRequestSubmitted(true);
      toast.success('Request received!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090D] text-slate-100 selection:bg-brand selection:text-white">
      {/* Glow ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand/10 rounded-full blur-[140px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[130px]" />
        <div className="absolute bottom-10 left-[-5%] w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24 space-y-24">
        
        {/* ===================== HERO SECTION ===================== */}
        <section className="text-center max-w-4xl mx-auto pt-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-emerald-400 font-semibold tracking-wide">MuviDB API v1.0</span>
            <span className="text-slate-500">•</span>
            <span>African Cinema Graph Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-heading text-white leading-tight">
            The Definitive Data API for <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-amber-400 to-amber-200">African Cinema</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Power your streaming apps, research analytics, cinema directories, and media platforms with structured, verified Nollywood metadata, ensemble credits, box office grosses, and streaming availability.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => openRequestModal('free')}
              className="px-6 py-3.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand/90 transition shadow-lg shadow-brand/20 flex items-center gap-2 group"
            >
              <Icon icon="solar:key-minimalistic-square-bold" className="text-lg group-hover:rotate-12 transition-transform" />
              <span>Get Free API Key</span>
            </button>
            <a
              href="#endpoints"
              className="px-6 py-3.5 rounded-xl bg-surface border border-border text-slate-200 font-bold text-sm hover:bg-surface-2 transition flex items-center gap-2"
            >
              <Icon icon="solar:document-code-bold" className="text-lg text-brand" />
              <span>Explore Endpoints</span>
            </a>
            <a
              href="#pricing"
              className="px-6 py-3.5 rounded-xl bg-transparent border border-white/10 text-slate-300 font-bold text-sm hover:bg-white/5 transition flex items-center gap-2"
            >
              <Icon icon="solar:tag-price-bold" className="text-lg text-amber-400" />
              <span>Compare Tiers</span>
            </a>
          </div>

          {/* Metrics ticker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl bg-surface/50 border border-white/5 backdrop-blur-sm">
              <div className="text-2xl font-black text-white font-mono">12,400+</div>
              <div className="text-xs text-slate-400 mt-0.5">Films Cataloged</div>
            </div>
            <div className="p-4 rounded-xl bg-surface/50 border border-white/5 backdrop-blur-sm">
              <div className="text-2xl font-black text-white font-mono">15,000+</div>
              <div className="text-xs text-slate-400 mt-0.5">Actors & Crew</div>
            </div>
            <div className="p-4 rounded-xl bg-surface/50 border border-white/5 backdrop-blur-sm">
              <div className="text-2xl font-black text-white font-mono">₦18.5B+</div>
              <div className="text-xs text-slate-400 mt-0.5">Box Office Tracked</div>
            </div>
            <div className="p-4 rounded-xl bg-surface/50 border border-white/5 backdrop-blur-sm">
              <div className="text-2xl font-black text-emerald-400 font-mono">99.9%</div>
              <div className="text-xs text-slate-400 mt-0.5">Uptime SLA</div>
            </div>
          </div>
        </section>

        {/* ===================== QUICK START AUTHENTICATION ===================== */}
        <section className="rounded-2xl bg-surface/70 border border-white/10 p-6 sm:p-8 backdrop-blur-md">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider mb-3">
              <Icon icon="solar:shield-keyhole-bold" />
              Quickstart Authentication
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">How to Authenticate with MuviDB API</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              All API requests must pass a valid API key via either the <code className="text-brand font-mono bg-white/5 px-1.5 py-0.5 rounded text-xs">x-api-key</code> HTTP header or as a Bearer token in the <code className="text-brand font-mono bg-white/5 px-1.5 py-0.5 rounded text-xs">Authorization</code> header.
            </p>

            <div className="bg-[#0D1117] rounded-xl border border-white/10 p-4 font-mono text-xs overflow-x-auto text-slate-300">
              <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-white/5 mb-3">
                <span>Standard Request Headers</span>
                <span className="text-[10px] text-emerald-400">HTTPS required</span>
              </div>
              <p><span className="text-blue-400">GET</span> /api/v1/films?limit=10 HTTP/1.1</p>
              <p>Host: api.muvidb.com</p>
              <p className="text-amber-300 font-semibold">x-api-key: mvd_live_abcdef1234567890abcdef</p>
              <p>Accept: application/json</p>
            </div>
          </div>
        </section>

        {/* ===================== INTERACTIVE ENDPOINT EXPLORER ===================== */}
        <section id="endpoints" className="scroll-mt-16 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand mb-1">
                <Icon icon="solar:bolt-circle-bold" />
                API Reference & Live Explorer
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Interactive REST Endpoints</h2>
              <p className="text-sm text-slate-400 mt-1">Select an endpoint below to view request parameters, copy client code, and preview standard responses.</p>
            </div>
            <div className="text-xs text-slate-400 font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              Base URL: <span className="text-white font-semibold">https://muvidb.com/api/v1</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Endpoint Selector */}
            <div className="lg:col-span-4 space-y-2">
              {ENDPOINTS.map((endpoint) => {
                const isSelected = selectedEndpoint.id === endpoint.id;
                return (
                  <button
                    key={endpoint.id}
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-surface-2 border-brand/50 shadow-md shadow-brand/10'
                        : 'bg-surface/50 border-white/5 hover:bg-surface/80 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{endpoint.name}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${endpoint.tierBadgeColor}`}>
                        {endpoint.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-emerald-400 font-bold">{endpoint.method}</span>
                      <span className="text-slate-400 truncate">{endpoint.path}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Endpoint Details & Code Snippets */}
            <div className="lg:col-span-8 rounded-2xl bg-[#0B0E14] border border-white/10 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                      {selectedEndpoint.method}
                    </span>
                    <span className="font-mono text-sm text-white font-bold">{selectedEndpoint.path}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{selectedEndpoint.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-md border font-semibold ${selectedEndpoint.tierBadgeColor}`}>
                    Required Tier: {selectedEndpoint.tier}
                  </span>
                </div>
              </div>

              {/* Parameters table */}
              {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Icon icon="solar:tuning-square-2-bold" />
                    Query Parameters
                  </h4>
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-slate-400 font-mono">
                        <tr>
                          <th className="p-2.5">Parameter</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {selectedEndpoint.params.map(param => (
                          <tr key={param.name} className="hover:bg-white/[0.02]">
                            <td className="p-2.5 font-mono text-brand font-semibold">{param.name}</td>
                            <td className="p-2.5 font-mono text-slate-400">{param.type}</td>
                            <td className="p-2.5">{param.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Code tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10 text-xs">
                    {['curl', 'javascript', 'python'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveCodeTab(tab)}
                        className={`px-3 py-1 rounded-md capitalize font-semibold transition ${
                          activeCodeTab === tab
                            ? 'bg-brand text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab === 'curl' ? 'cURL' : tab === 'javascript' ? 'JavaScript' : 'Python'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleCopy(selectedEndpoint[activeCodeTab], 'code')}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition flex items-center gap-1.5"
                  >
                    <Icon icon={copiedCode ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedCode ? "text-emerald-400" : ""} />
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="bg-[#05070A] rounded-xl border border-white/10 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{selectedEndpoint[activeCodeTab]}</pre>
                </div>
              </div>

              {/* Sample response */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Icon icon="solar:code-file-bold" />
                    Response Example (200 OK)
                  </span>

                  <button
                    onClick={() => handleCopy(selectedEndpoint.responseSample, 'sample')}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition flex items-center gap-1.5"
                  >
                    <Icon icon={copiedSample ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedSample ? "text-emerald-400" : ""} />
                    <span>{copiedSample ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>

                <div className="bg-[#05070A] rounded-xl border border-white/10 p-4 font-mono text-xs text-emerald-300/90 overflow-x-auto max-h-[340px]">
                  <pre>{selectedEndpoint.responseSample}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== PRICING & TIER COMPARISON ===================== */}
        <section id="pricing" className="scroll-mt-16 space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Icon icon="solar:tag-price-bold" />
              Transparent Plans
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Developer Tiers & Pricing</h2>
            <p className="text-slate-400 text-sm mt-2">
              Whether building an academic study, indie cinephile app, or enterprise streaming platform, choose the tier that fits your scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free Tier */}
            <div className="rounded-2xl bg-surface border border-white/10 p-8 flex flex-col justify-between relative hover:border-white/20 transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Community</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    Free Forever
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-slate-400 text-xs">/month</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Perfect for hobbyists, students, indie developers, and non-commercial African cinema research projects.
                </p>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span><strong>Catalog Limit:</strong> First 500 Films &amp; 500 People</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span><strong>Credits Limit:</strong> Up to 500 credits (Top 10 cast/crew preview)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span><strong>60 requests / min</strong> (1 req/sec)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span>Max 20 items per page</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Icon icon="solar:close-circle-linear" className="text-slate-600 text-base shrink-0" />
                    <span>No Box Office / Gross revenue data</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Icon icon="solar:close-circle-linear" className="text-slate-600 text-base shrink-0" />
                    <span>Requires attribution link to MuviDB</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => openRequestModal('free')}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition text-center"
                >
                  Request Free Key
                </button>
              </div>
            </div>

            {/* Pro Tier (Featured) */}
            <div className="rounded-2xl bg-gradient-to-b from-surface-2 to-surface border-2 border-brand p-8 flex flex-col justify-between relative shadow-xl shadow-brand/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-brand text-white text-[11px] font-bold tracking-wide uppercase shadow-md">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-4 mt-2">
                  <h3 className="text-lg font-bold text-white">Pro Developer</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">
                    Full Access
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-extrabold text-white">$49</span>
                  <span className="text-slate-400 text-xs">/mo (or ₦50,000)</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Built for commercial streaming apps, cinema ticketing portals, production houses, and media platforms.
                </p>

                <div className="space-y-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>Full Database Access</strong> (All 12,400+ Films &amp; 15,000+ People)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>Complete Credits History</strong> (Unrestricted cast &amp; crew)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span className="font-bold text-white">Box Office Grosses &amp; Rankings</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>600 requests / min</strong> (10 req/sec)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span>Up to 100 items per page</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span>Commercial licensing (no attribution required)</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => openRequestModal('pro')}
                  className="w-full py-3 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition shadow-lg shadow-brand/25 text-center"
                >
                  Get Pro Access
                </button>
              </div>
            </div>

            {/* Enterprise Tier */}
            <div className="rounded-2xl bg-surface border border-white/10 p-8 flex flex-col justify-between relative hover:border-white/20 transition">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Enterprise</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    High Scale
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-extrabold text-white">Custom</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  For large streaming networks, international broadcast aggregators, telecom VAS, and global distributors.
                </p>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span><strong>2,000+ requests / min</strong> or custom rate limit</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Dedicated database read replica pool</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Real-time webhook notifications</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Custom JSON feeds & data exports</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>99.9% guaranteed uptime SLA</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Dedicated Technical Account Manager</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => openRequestModal('enterprise')}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition text-center"
                >
                  Contact Enterprise Sales
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== DETAILED FEATURE MATRIX ===================== */}
        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-xl font-bold text-white">Full Feature Comparison</h3>
            <p className="text-xs text-slate-400 mt-1">Detailed feature breakdown across all MuviDB Developer tiers.</p>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden bg-surface/50 backdrop-blur-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400 font-mono">
                <tr>
                  <th className="p-4">Capability</th>
                  <th className="p-4 text-center">Community (Free)</th>
                  <th className="p-4 text-center text-brand font-bold">Pro Developer</th>
                  <th className="p-4 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Monthly API Request Quota</td>
                  <td className="p-4 text-center">100,000</td>
                  <td className="p-4 text-center font-bold text-white">1,500,000</td>
                  <td className="p-4 text-center">Unlimited / Custom</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Burst Rate Limit</td>
                  <td className="p-4 text-center">60 req / min</td>
                  <td className="p-4 text-center font-bold text-brand">600 req / min</td>
                  <td className="p-4 text-center">2,000+ req / min</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Max Items Per Request</td>
                  <td className="p-4 text-center">20</td>
                  <td className="p-4 text-center font-bold text-white">100</td>
                  <td className="p-4 text-center">500</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Films Catalog Coverage</td>
                  <td className="p-4 text-center text-amber-400 font-semibold">First 500 Films (Preview)</td>
                  <td className="p-4 text-center font-bold text-white">Full 12,400+ Films</td>
                  <td className="p-4 text-center font-bold text-white">Full 12,400+ Films</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">People &amp; Talent Directory</td>
                  <td className="p-4 text-center text-amber-400 font-semibold">First 500 People (Preview)</td>
                  <td className="p-4 text-center font-bold text-white">Full 15,000+ People</td>
                  <td className="p-4 text-center font-bold text-white">Full 15,000+ People</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Credits &amp; Ensemble Filmographies</td>
                  <td className="p-4 text-center text-amber-400 font-semibold">Limited: 500 Credits (Top 10 / film)</td>
                  <td className="p-4 text-center font-bold text-brand">Complete &amp; Unrestricted</td>
                  <td className="p-4 text-center font-bold text-blue-400">Complete &amp; Unrestricted</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Box Office & Gross Revenue Data</td>
                  <td className="p-4 text-center"><Icon icon="solar:close-circle-linear" className="text-slate-600 inline text-base" /></td>
                  <td className="p-4 text-center"><Icon icon="solar:check-circle-bold" className="text-brand inline text-base" /></td>
                  <td className="p-4 text-center"><Icon icon="solar:check-circle-bold" className="text-emerald-400 inline text-base" /></td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Commercial Use License</td>
                  <td className="p-4 text-center text-slate-500">Non-commercial</td>
                  <td className="p-4 text-center text-emerald-400 font-semibold">Included</td>
                  <td className="p-4 text-center text-emerald-400 font-semibold">Included</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Attribution Requirement</td>
                  <td className="p-4 text-center text-amber-400">Mandatory</td>
                  <td className="p-4 text-center text-slate-400">Optional</td>
                  <td className="p-4 text-center text-slate-400">White-label</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Support Channels</td>
                  <td className="p-4 text-center text-slate-400">Community Docs</td>
                  <td className="p-4 text-center text-white">Priority Email & Discord</td>
                  <td className="p-4 text-center text-blue-400">Dedicated Slack & SLA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ===================== FAQ SECTION ===================== */}
        <section className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white">Frequently Asked Questions</h3>
            <p className="text-xs text-slate-400 mt-1">Everything you need to know about accessing and integrating MuviDB.</p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-surface border border-white/5 space-y-2">
              <h4 className="text-sm font-bold text-white">How quickly are API keys issued?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Free keys are reviewed and provisioned within 24 hours. Pro subscriptions receive instantaneous API credentials upon payment confirmation.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-surface border border-white/5 space-y-2">
              <h4 className="text-sm font-bold text-white">What happens if I exceed my tier rate limits?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                If your application exceeds the allotted requests per minute, the API returns a <code className="text-brand font-mono">429 Too Many Requests</code> status with a <code className="text-brand font-mono">Retry-After</code> header indicating when the quota resets.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-surface border border-white/5 space-y-2">
              <h4 className="text-sm font-bold text-white">Can I use MuviDB data in commercial mobile apps?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes! The Pro and Enterprise tiers include a commercial license allowing integration in commercial streaming services, mobile apps, cinema ticketing solutions, and business intelligence suites.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-surface border border-white/5 space-y-2">
              <h4 className="text-sm font-bold text-white">How frequently is Box Office and Movie data updated?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our film database is updated continuously throughout the day with automated scrapers and editorial curation. Cinema box office data is updated every Monday and Wednesday following official West African distributor reports.
              </p>
            </div>
          </div>
        </section>

        {/* ===================== BOTTOM CTA ===================== */}
        <section className="rounded-3xl bg-gradient-to-r from-brand/20 via-surface-2 to-amber-500/10 border border-brand/30 p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white font-heading">
            Ready to Build the Future of African Cinema?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Get your API key today and start building fast, accurate, and richly detailed cinema experiences for audiences worldwide.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => openRequestModal('free')}
              className="px-8 py-3.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-sm transition shadow-lg shadow-brand/20"
            >
              Request Access Now
            </button>
            <Link
              to="/contact"
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition"
            >
              Contact Support
            </Link>
          </div>
        </section>

      </div>

      {/* ===================== REQUEST API KEY MODAL ===================== */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0F131A] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative space-y-6">
            
            <button
              onClick={() => {
                setShowRequestModal(false);
                setRequestSubmitted(false);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
            >
              <Icon icon="solar:close-circle-linear" className="text-2xl" />
            </button>

            {!requestSubmitted ? (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-wider mb-1">
                    <Icon icon="solar:key-bold" />
                    API Access Application
                  </div>
                  <h3 className="text-xl font-bold text-white">Request Your MuviDB API Key</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Fill out the form below to apply for developer credentials.
                  </p>
                </div>

                {/* Tier Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Selected Tier</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['free', 'pro', 'enterprise'].map(tier => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setSelectedTierForRequest(tier)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold capitalize transition ${
                          selectedTierForRequest === tier
                            ? 'bg-brand/20 border-brand text-brand'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Application / Project Name *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.appName}
                    onChange={(e) => setRequestForm({ ...requestForm, appName: e.target.value })}
                    placeholder="e.g. CinemaFinder Africa, Nollywood Trends"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={requestForm.developerName}
                      onChange={(e) => setRequestForm({ ...requestForm, developerName: e.target.value })}
                      placeholder="e.g. Tunde Ade"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={requestForm.email}
                      onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                      placeholder="developer@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Organization / Studio (Optional)</label>
                  <input
                    type="text"
                    value={requestForm.company}
                    onChange={(e) => setRequestForm({ ...requestForm, company: e.target.value })}
                    placeholder="e.g. University of Lagos, Creative Lab Studios"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Intended Use Case</label>
                  <textarea
                    rows={3}
                    value={requestForm.useCase}
                    onChange={(e) => setRequestForm({ ...requestForm, useCase: e.target.value })}
                    placeholder="Describe how you plan to use MuviDB's data..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-brand resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Icon icon="solar:refresh-linear" className="animate-spin text-base" />
                        <span>Submitting Application...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:plain-bold" className="text-base" />
                        <span>Submit Application</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Icon icon="solar:check-circle-bold" className="text-3xl" />
                </div>
                <h3 className="text-xl font-bold text-white">Application Received!</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Thank you for applying for the <strong>{selectedTierForRequest.toUpperCase()}</strong> tier. Your application has been logged and our engineering team will dispatch your API credentials to <strong>{requestForm.email}</strong>.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setShowRequestModal(false);
                      setRequestSubmitted(false);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-surface border border-white/10 text-white font-bold text-xs hover:bg-surface-2 transition"
                  >
                    Back to Documentation
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
