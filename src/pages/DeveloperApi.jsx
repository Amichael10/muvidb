import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const ENDPOINTS = [
  {
    id: 'films',
    name: 'List & Search Films',
    category: 'Films',
    method: 'GET',
    path: '/api/v1/films',
    tier: 'Free Preview / Pro Full',
    tierBadgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Query African and Nollywood cinema catalog. Filter by genre, release year, streaming destination, or full-text title search. Free tier previews first 500 catalog titles; Pro tier unlocks all 12,400+ films.',
    params: [
      { name: 'query', type: 'string', desc: 'Search by title, alternative titles, or keywords', example: 'wedding' },
      { name: 'genre', type: 'string', desc: 'Filter by genre (Drama, Comedy, Thriller, Romance)', example: 'Romance' },
      { name: 'year', type: 'number', desc: 'Filter by release year (e.g. 2024)', example: '2024' },
      { name: 'page', type: 'number', desc: 'Page offset number (default: 1)', example: '1' },
      { name: 'limit', type: 'number', desc: 'Items per page (Free max 20, Pro max 100)', example: '20' },
    ],
    curl: (params) => `curl -X GET "https://muvidb.com/api/v1/films?query=${params.query || 'wedding'}&genre=${params.genre || 'Romance'}" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: (params) => `const res = await fetch('https://muvidb.com/api/v1/films?query=${params.query || 'wedding'}&genre=${params.genre || 'Romance'}', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const data = await res.json();
console.log(data.data);`,
    python: (params) => `import requests

url = "https://muvidb.com/api/v1/films"
headers = {"x-api-key": "mvd_live_your_api_key_here"}
params = {"query": "${params.query || 'wedding'}", "genre": "${params.genre || 'Romance'}"}

response = requests.get(url, headers=headers, params=params)
films = response.json()
print(films["data"])`,
    go: (params) => `package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  req, _ := http.NewRequest("GET", "https://muvidb.com/api/v1/films?query=${params.query || 'wedding'}", nil)
  req.Header.Set("x-api-key", "mvd_live_your_api_key_here")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
    php: (params) => `<?php
$ch = curl_init("https://muvidb.com/api/v1/films?query=${params.query || 'wedding'}&genre=${params.genre || 'Romance'}");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: mvd_live_your_api_key_here"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    responseSample: {
      success: true,
      data: [
        {
          id: "f48c149d-37cb-4ad8-ba96-f94a86fbe07a",
          title: "The Wedding Party",
          slug: "the-wedding-party-2016",
          release_year: 2016,
          runtime_minutes: 110,
          genres: ["Comedy", "Romance"],
          poster_url: "https://images.muvidb.com/posters/wedding_party.jpg",
          backdrop_url: "https://images.muvidb.com/backdrops/wedding_party.jpg",
          synopsis: "Dunni and Dozie are about to tie the knot in what promises to be the lavish wedding of the year...",
          rating: 7.4,
          streaming_platforms: ["Netflix", "Prime Video"],
          country: "Nigeria"
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 12450,
        has_more: true,
        catalog_tier: "Pro (Full 12,400+ archive)"
      }
    }
  },
  {
    id: 'film-detail',
    name: 'Film by ID or Slug',
    category: 'Films',
    method: 'GET',
    path: '/api/v1/films/:id',
    tier: 'Free Preview / Pro Full',
    tierBadgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Retrieve full metadata for an individual title by UUID or slug, including verified runtime, box office estimates, release history, and platform watch links.',
    params: [
      { name: 'id', type: 'UUID or Slug', required: true, desc: 'Film UUID or slug identifier', example: 'the-wedding-party-2016' }
    ],
    curl: (params) => `curl -X GET "https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: (params) => `const res = await fetch('https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const film = await res.json();
console.log(film.data);`,
    python: (params) => `import requests

url = "https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}"
headers = {"x-api-key": "mvd_live_your_api_key_here"}

response = requests.get(url, headers=headers)
print(response.json()["data"])`,
    go: (params) => `package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  req, _ := http.NewRequest("GET", "https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}", nil)
  req.Header.Set("x-api-key", "mvd_live_your_api_key_here")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
    php: (params) => `<?php
$ch = curl_init("https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: mvd_live_your_api_key_here"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    responseSample: {
      success: true,
      data: {
        id: "f48c149d-37cb-4ad8-ba96-f94a86fbe07a",
        title: "The Wedding Party",
        slug: "the-wedding-party-2016",
        release_date: "2016-12-16",
        runtime_minutes: 110,
        genres: ["Comedy", "Romance"],
        director: "Kemi Adetiba",
        production_company: "EbonyLife Films",
        total_gross_ngn: 453000000,
        streaming_links: [
          { platform: "Netflix", url: "https://netflix.com/title/80182479" }
        ],
        poster_url: "https://images.muvidb.com/posters/wedding_party.jpg"
      }
    }
  },
  {
    id: 'film-credits',
    name: 'Cast & Crew Ensemble',
    category: 'Credits',
    method: 'GET',
    path: '/api/v1/films/:id/credits',
    tier: 'Free Preview / Pro Full',
    tierBadgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Retrieve full ensemble credits for a specific film. Returns canonical actor character names, department breakdowns (Directing, Camera, Writing), and verified billing orders.',
    params: [
      { name: 'id', type: 'UUID or Slug', required: true, desc: 'Film UUID or slug', example: 'the-wedding-party-2016' }
    ],
    curl: (params) => `curl -X GET "https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}/credits" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: (params) => `const res = await fetch('https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}/credits', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const credits = await res.json();
console.log(credits.data);`,
    python: (params) => `import requests

url = "https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}/credits"
headers = {"x-api-key": "mvd_live_your_api_key_here"}

response = requests.get(url, headers=headers)
print(response.json()["data"])`,
    go: (params) => `package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  req, _ := http.NewRequest("GET", "https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}/credits", nil)
  req.Header.Set("x-api-key", "mvd_live_your_api_key_here")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
    php: (params) => `<?php
$ch = curl_init("https://muvidb.com/api/v1/films/${params.id || 'the-wedding-party-2016'}/credits");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: mvd_live_your_api_key_here"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    responseSample: {
      success: true,
      data: {
        film_id: "f48c149d-37cb-4ad8-ba96-f94a86fbe07a",
        cast: [
          {
            person_id: "77ea2f10-91b4-4e4b-97e3-0d322b7c6c41",
            name: "Adesua Etomi-Wellington",
            character_name: "Dunni Coker",
            billing_order: 1,
            profile_image: "https://images.muvidb.com/people/adesua.jpg"
          },
          {
            person_id: "99bb12a0-41c3-4d6a-8fa1-7e8c339a1b12",
            name: "Banky Wellington",
            character_name: "Dozie Onwuka",
            billing_order: 2,
            profile_image: "https://images.muvidb.com/people/banky.jpg"
          }
        ],
        crew: [
          {
            person_id: "11ab34cd-82ef-4567-90ab-cdef12345678",
            name: "Kemi Adetiba",
            role: "Director",
            department: "Directing"
          }
        ]
      }
    }
  },
  {
    id: 'people',
    name: 'People & Filmographies',
    category: 'Talent',
    method: 'GET',
    path: '/api/v1/people',
    tier: 'Free Preview / Pro Full',
    tierBadgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Explore the biographical index of 15,000+ African filmmakers, actors, cinematographers, and producers. Includes verified social handles and full historical credit tallies.',
    params: [
      { name: 'query', type: 'string', desc: 'Search by full or professional name', example: 'Genevieve' },
      { name: 'role', type: 'string', desc: 'Filter by profession (Actor, Director, Producer)', example: 'Actor' },
      { name: 'page', type: 'number', desc: 'Page number offset', example: '1' },
      { name: 'limit', type: 'number', desc: 'Records per page (Free max 20, Pro max 100)', example: '20' }
    ],
    curl: (params) => `curl -X GET "https://muvidb.com/api/v1/people?query=${params.query || 'Genevieve'}&role=${params.role || 'Actor'}" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: (params) => `const res = await fetch('https://muvidb.com/api/v1/people?query=${params.query || 'Genevieve'}&role=${params.role || 'Actor'}', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const people = await res.json();
console.log(people.data);`,
    python: (params) => `import requests

url = "https://muvidb.com/api/v1/people"
headers = {"x-api-key": "mvd_live_your_api_key_here"}
params = {"query": "${params.query || 'Genevieve'}", "role": "${params.role || 'Actor'}"}

response = requests.get(url, headers=headers, params=params)
print(response.json()["data"])`,
    go: (params) => `package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  req, _ := http.NewRequest("GET", "https://muvidb.com/api/v1/people?query=${params.query || 'Genevieve'}", nil)
  req.Header.Set("x-api-key", "mvd_live_your_api_key_here")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
    php: (params) => `<?php
$ch = curl_init("https://muvidb.com/api/v1/people?query=${params.query || 'Genevieve'}");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: mvd_live_your_api_key_here"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    responseSample: {
      success: true,
      data: [
        {
          id: "10029384-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
          name: "Genevieve Nnaji",
          slug: "genevieve-nnaji",
          known_for_department: "Directing / Acting",
          bio: "Genevieve Nnaji is an acclaimed Nigerian actress, producer, and director who directed Lionheart, the first Netflix original from Nigeria...",
          photo_url: "https://images.muvidb.com/people/genevieve.jpg",
          film_count: 84,
          social_links: {
            instagram: "https://instagram.com/genevievennaji",
            twitter: "https://twitter.com/genevievennaji1"
          }
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 15200,
        has_more: true
      }
    }
  },
  {
    id: 'boxoffice',
    name: 'Box Office & Revenue Rankings',
    category: 'Intelligence',
    method: 'GET',
    path: '/api/v1/boxoffice',
    tier: 'Pro Commercial Exclusive',
    tierBadgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    description: 'Track audited theatrical box office receipts across Nigerian cinema chains (Filmhouse, Genesis, Silverbird, Viva). Provides all-time rankings, annual totals, and weekend grosses in NGN and USD.',
    params: [
      { name: 'year', type: 'number', desc: 'Ranking release year (e.g. 2024)', example: '2024' },
      { name: 'type', type: 'string', desc: 'Ranking category ("all-time", "annual", "weekend")', example: 'annual' },
      { name: 'limit', type: 'number', desc: 'Number of entries (up to 100)', example: '25' }
    ],
    curl: (params) => `curl -X GET "https://muvidb.com/api/v1/boxoffice?year=${params.year || '2024'}&type=${params.type || 'annual'}" \\
  -H "x-api-key: mvd_live_pro_key_here"`,
    javascript: (params) => `const res = await fetch('https://muvidb.com/api/v1/boxoffice?year=${params.year || '2024'}&type=${params.type || 'annual'}', {
  headers: {
    'x-api-key': 'mvd_live_pro_key_here'
  }
});
const boxOffice = await res.json();
console.log(boxOffice.data);`,
    python: (params) => `import requests

url = "https://muvidb.com/api/v1/boxoffice"
headers = {"x-api-key": "mvd_live_pro_key_here"}
params = {"year": ${params.year || 2024}, "type": "${params.type || 'annual'}"}

response = requests.get(url, headers=headers, params=params)
print(response.json()["data"])`,
    go: (params) => `package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  req, _ := http.NewRequest("GET", "https://muvidb.com/api/v1/boxoffice?year=${params.year || '2024'}", nil)
  req.Header.Set("x-api-key", "mvd_live_pro_key_here")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
    php: (params) => `<?php
$ch = curl_init("https://muvidb.com/api/v1/boxoffice?year=${params.year || '2024'}");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: mvd_live_pro_key_here"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    responseSample: {
      success: true,
      tier: "pro",
      data: [
        {
          rank: 1,
          film_title: "A Tribe Called Judah",
          film_id: "a91b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
          release_year: 2023,
          distributor: "FilmOne Entertainment",
          total_gross_ngn: 1404000000,
          total_gross_usd: 1050000,
          weeks_tracked: 12,
          admissions_estimate: 395000
        },
        {
          rank: 2,
          film_title: "Battle on Buka Street",
          film_id: "b82c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
          release_year: 2022,
          distributor: "FilmOne Entertainment",
          total_gross_ngn: 668400000,
          total_gross_usd: 720000,
          weeks_tracked: 14
        }
      ]
    }
  },
  {
    id: 'status',
    name: 'Status & Rate Limit Health',
    category: 'System',
    method: 'GET',
    path: '/api/v1/status',
    tier: 'Public / Auth',
    tierBadgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Inspect live API cluster health, your current plan entitlements, active scopes, and real-time rate limit consumption.',
    params: [],
    curl: () => `curl -X GET "https://muvidb.com/api/v1/status" \\
  -H "x-api-key: mvd_live_your_api_key_here"`,
    javascript: () => `const res = await fetch('https://muvidb.com/api/v1/status', {
  headers: {
    'x-api-key': 'mvd_live_your_api_key_here'
  }
});
const status = await res.json();
console.log(status);`,
    python: () => `import requests

url = "https://muvidb.com/api/v1/status"
headers = {"x-api-key": "mvd_live_your_api_key_here"}

response = requests.get(url, headers=headers)
print(response.json())`,
    go: () => `package main

import (
  "fmt"
  "net/http"
  "io"
)

func main() {
  req, _ := http.NewRequest("GET", "https://muvidb.com/api/v1/status", nil)
  req.Header.Set("x-api-key", "mvd_live_your_api_key_here")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
    php: () => `<?php
$ch = curl_init("https://muvidb.com/api/v1/status");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: mvd_live_your_api_key_here"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    responseSample: {
      status: "active",
      api_version: "v1.0",
      client: {
        organization: "Prime Video Africa / Engineering",
        tier: "pro",
        scopes: ["films:read", "people:read", "credits:read", "boxoffice:read"],
        rate_limit_per_min: 600
      },
      tier_entitlements: {
        tier: "pro",
        max_page_limit: 100,
        full_catalog_access: true,
        box_office_access: true,
        commercial_license: true,
        priority_support: true
      }
    }
  }
];

const PRESETS = [
  { label: 'Wedding Party 2016', endpointId: 'films', params: { query: 'wedding party', genre: 'Comedy', year: '2016' } },
  { label: 'Genevieve Nnaji Filmography', endpointId: 'people', params: { query: 'Genevieve', role: 'Actor' } },
  { label: '2024 Box Office Kings', endpointId: 'boxoffice', params: { year: '2024', type: 'annual', limit: '10' } },
  { label: 'Health & Quota Check', endpointId: 'status', params: {} }
];

export default function DeveloperApi() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [activeCodeTab, setActiveCodeTab] = useState('curl');
  const [currency, setCurrency] = useState('NGN'); // 'NGN' | 'USD'
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedQuickstart, setCopiedQuickstart] = useState(false);

  // Dynamic parameter state for playground
  const [playgroundParams, setPlaygroundParams] = useState({
    query: 'wedding',
    genre: 'Romance',
    year: '2024',
    limit: '20',
    id: 'the-wedding-party-2016',
    role: 'Actor',
    type: 'annual'
  });

  // Modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [modalTab, setModalTab] = useState('instant'); // 'instant' | 'pro' | 'enterprise'
  const [modalForm, setModalForm] = useState({
    appName: '',
    developerName: '',
    email: user?.email || '',
    company: '',
    useCase: '',
    tier: 'free'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedKey, setSubmittedKey] = useState(null);

  const categories = useMemo(() => {
    return ['All', ...new Set(ENDPOINTS.map(e => e.category))];
  }, []);

  const filteredEndpoints = useMemo(() => {
    if (selectedCategory === 'All') return ENDPOINTS;
    return ENDPOINTS.filter(e => e.category === selectedCategory);
  }, [selectedCategory]);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else if (type === 'json') {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } else if (type === 'quickstart') {
      setCopiedQuickstart(true);
      setTimeout(() => setCopiedQuickstart(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  const handleApplyPreset = (preset) => {
    const ep = ENDPOINTS.find(e => e.id === preset.endpointId);
    if (ep) {
      setSelectedEndpoint(ep);
      setPlaygroundParams(prev => ({ ...prev, ...preset.params }));
      toast.success(`Loaded preset: ${preset.label}`);
    }
  };

  const openKeyModal = (tier = 'free') => {
    setModalTab(tier === 'free' ? 'instant' : tier);
    setModalForm(prev => ({
      ...prev,
      tier,
      email: prev.email || user?.email || ''
    }));
    setSubmittedKey(null);
    setShowKeyModal(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modalForm.appName.trim() || !modalForm.email.trim()) {
      toast.error('App name and email are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedTestKey = `mvd_live_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
      const payload = {
        app_name: modalForm.appName,
        developer_name: modalForm.developerName,
        email: modalForm.email,
        company: modalForm.company,
        use_case: modalForm.useCase,
        tier: modalForm.tier,
        issued_key: modalForm.tier === 'free' ? generatedTestKey : null,
        requested_at: new Date().toISOString()
      };

      await supabase.from('admin_actions').insert({
        user_id: user?.id || null,
        action_type: 'api_key_request',
        entity_type: 'api_key',
        entity_name: `${modalForm.appName} (${modalForm.tier.toUpperCase()})`,
        details: payload
      });

      setSubmittedKey(modalForm.tier === 'free' ? generatedTestKey : 'pending_review');
      toast.success(modalForm.tier === 'free' ? 'API Key generated!' : 'Application submitted!');
    } catch (err) {
      console.error(err);
      setSubmittedKey(`mvd_live_demo_${Date.now().toString(36)}`);
      toast.success('Application received!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSnippet = useMemo(() => {
    if (typeof selectedEndpoint[activeCodeTab] === 'function') {
      return selectedEndpoint[activeCodeTab](playgroundParams);
    }
    return selectedEndpoint[activeCodeTab] || '';
  }, [selectedEndpoint, activeCodeTab, playgroundParams]);

  return (
    <div className="min-h-screen bg-[#080A0D] text-slate-100 selection:bg-brand selection:text-white relative overflow-x-hidden font-sans">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-32 space-y-20">

        {/* ── Navigation Strip ── */}
        <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="font-heading font-black text-xl text-white tracking-tight">Muvi<span className="text-brand">DB</span></span>
            </Link>
            <span className="text-white/20 font-light">/</span>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>v1.0 Production API</span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-semibold text-slate-300">
            <a href="#console" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">Live Console</a>
            <a href="#endpoints" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">Endpoints</a>
            <a href="#architecture" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">Features</a>
            <a href="#pricing" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">Pricing</a>
            <a href="#faq" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openKeyModal('free')}
              className="px-4 py-2 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition shadow-lg shadow-brand/20 flex items-center gap-1.5 group"
            >
              <Icon icon="solar:key-bold" className="text-sm group-hover:rotate-12 transition-transform" />
              <span>Get API Key</span>
            </button>
          </div>
        </header>

        {/* ── Hero Section ── */}
        <section className="text-center max-w-4xl mx-auto space-y-8 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300 shadow-inner">
            <Icon icon="solar:server-square-bold" className="text-brand text-sm" />
            <span className="text-slate-400 font-mono">Edge CDN Latency:</span>
            <span className="text-emerald-400 font-mono font-bold">&lt; 42ms</span>
            <span className="text-white/20">•</span>
            <span>REST JSON &amp; Webhook Events</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight font-heading text-white leading-[1.08]">
            The Definitive Data Engine for{' '}
            <span className="text-brand">African Cinema</span>
          </h1>

          <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Power streaming apps, media intelligence suites, cinema booking engines, and editorial portals with verified Nollywood metadata, ensemble credits, box office grosses, and deep-linked streaming availability.
          </p>

          {/* Quickstart Command Bar */}
          <div className="max-w-2xl mx-auto p-2.5 rounded-2xl bg-black/60 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 px-3 py-1 text-xs font-mono text-slate-300 overflow-x-auto w-full">
              <span className="text-brand font-bold select-none">$</span>
              <span className="text-slate-400 select-none">curl -H &quot;x-api-key: mvd_live_...&quot;</span>
              <span className="text-emerald-400 whitespace-nowrap">https://muvidb.com/api/v1/films?query=wedding</span>
            </div>
            <button
              onClick={() => handleCopy('curl -H "x-api-key: mvd_live_demo_key" https://muvidb.com/api/v1/films?query=wedding', 'quickstart')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs font-semibold shrink-0 transition flex items-center justify-center gap-1.5"
            >
              <Icon icon={copiedQuickstart ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedQuickstart ? "text-emerald-400" : ""} />
              <span>{copiedQuickstart ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md text-left relative overflow-hidden group hover:border-brand/30 transition">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Verified Films</span>
                <Icon icon="solar:videocamera-record-bold" className="text-brand text-sm" />
              </div>
              <div className="text-3xl font-black text-white font-mono">12,400+</div>
              <p className="text-[11px] text-slate-500 mt-1">Cross-era Nollywood archive</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md text-left relative overflow-hidden group hover:border-brand/30 transition">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Actors &amp; Crew</span>
                <Icon icon="solar:users-group-two-rounded-bold" className="text-blue-400 text-sm" />
              </div>
              <div className="text-3xl font-black text-white font-mono">15,000+</div>
              <p className="text-[11px] text-slate-500 mt-1">Zero-duplicate entity graph</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md text-left relative overflow-hidden group hover:border-brand/30 transition">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Box Office Tracked</span>
                <Icon icon="solar:wallet-money-bold" className="text-amber-400 text-sm" />
              </div>
              <div className="text-3xl font-black text-amber-300 font-mono">₦18.5B+</div>
              <p className="text-[11px] text-slate-500 mt-1">West African cinema grosses</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md text-left relative overflow-hidden group hover:border-brand/30 transition">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Edge SLA</span>
                <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-sm" />
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono">99.98%</div>
              <p className="text-[11px] text-slate-500 mt-1">Global multi-region failover</p>
            </div>
          </div>
        </section>

        {/* ── Interactive Live API Console / Sandbox ── */}
        <section id="console" className="scroll-mt-20 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand mb-2">
                <Icon icon="solar:code-circle-bold" className="text-base" />
                Live Developer Console
              </div>
              <h2 className="text-3xl font-extrabold text-white">Interactive Endpoint Playground</h2>
              <p className="text-sm text-slate-400 mt-1">
                Customize query parameters, generate production-ready code in 5 languages, and preview canonical responses.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400">Presets:</span>
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Category & Endpoint Navigation */}
            <div className="lg:col-span-4 space-y-4">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/5 overflow-x-auto">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-brand text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Endpoint Cards */}
              <div className="space-y-2.5">
                {filteredEndpoints.map(endpoint => {
                  const isSelected = selectedEndpoint.id === endpoint.id;
                  return (
                    <button
                      key={endpoint.id}
                      onClick={() => setSelectedEndpoint(endpoint)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#141A22] border-brand shadow-sm text-white'
                          : 'bg-[#0E1217] border-white/10 hover:border-white/20 hover:bg-[#121620]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{endpoint.name}</span>
                        <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md border ${endpoint.tierBadgeColor}`}>
                          {endpoint.tier.includes('Pro') ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">{endpoint.method}</span>
                        <span className="text-slate-300 truncate">{endpoint.path}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Query Parameter Inputs */}
              {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                <div className="p-5 rounded-2xl bg-surface/40 border border-white/10 space-y-3.5 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Icon icon="solar:tuning-square-2-bold" className="text-brand" />
                      Configure Parameters
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Live updates</span>
                  </div>

                  <div className="space-y-3">
                    {selectedEndpoint.params.map(param => (
                      <div key={param.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-mono text-slate-300 font-semibold">{param.name}</label>
                          <span className="text-[11px] text-slate-500">{param.type}</span>
                        </div>
                        <input
                          type="text"
                          value={playgroundParams[param.name] ?? param.example ?? ''}
                          onChange={(e) => setPlaygroundParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                          placeholder={param.desc}
                          className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-brand"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Code Snippet & Live Response Console */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Code Generator Card */}
              <div className="rounded-2xl bg-[#090C11] border border-white/10 overflow-hidden shadow-2xl">
                {/* Header with Language Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-xs">
                    {[
                      { id: 'curl', label: 'cURL' },
                      { id: 'javascript', label: 'TypeScript / Node' },
                      { id: 'python', label: 'Python' },
                      { id: 'go', label: 'Go' },
                      { id: 'php', label: 'PHP' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveCodeTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg font-mono font-medium transition ${
                          activeCodeTab === tab.id
                            ? 'bg-brand text-white shadow-sm font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(activeSnippet, 'code')}
                      className="px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition flex items-center gap-1.5"
                    >
                      <Icon icon={copiedCode ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedCode ? "text-emerald-400" : ""} />
                      <span>{copiedCode ? 'Copied Snippet' : 'Copy Code'}</span>
                    </button>
                  </div>
                </div>

                {/* Code Body */}
                <div className="p-5 font-mono text-xs text-slate-200 overflow-x-auto bg-[#05070A] leading-relaxed">
                  <pre>{activeSnippet}</pre>
                </div>
              </div>

              {/* Response Inspector Card */}
              <div className="rounded-2xl bg-[#090C11] border border-white/10 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Icon icon="solar:code-file-bold" className="text-emerald-400 text-sm" />
                      Mock Response Inspector
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                      200 OK
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                      Time: 38ms • gzip: 1.4KB
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(selectedEndpoint.responseSample, 'json')}
                    className="px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition flex items-center gap-1.5"
                  >
                    <Icon icon={copiedJson ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedJson ? "text-emerald-400" : ""} />
                    <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
                  </button>
                </div>

                <div className="p-5 font-mono text-xs text-emerald-300/90 overflow-x-auto bg-[#05070A] max-h-[420px] leading-relaxed">
                  <pre>{JSON.stringify(selectedEndpoint.responseSample, null, 2)}</pre>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ── Architecture & Enterprise Strengths Grid ── */}
        <section id="architecture" className="scroll-mt-20 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider">
              <Icon icon="solar:graph-bold" />
              Engine Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Why Top Media Teams Rely on MuviDB</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Engineered from the ground up to solve the fragmented, noisy, and unstructured nature of Nollywood and West African screen entertainment data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-brand/40 transition group relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                <Icon icon="solar:users-group-two-rounded-bold" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Canonical Nollywood Hierarchy</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Guaranteed zero-duplicate talent profiles. Merges aliases, handles OCR title variations from YouTube &amp; theatrical rolls, and maps verified character roles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-amber-400/40 transition group relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                <Icon icon="solar:wallet-money-bold" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Theatrical Box Office Receipts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Audited weekend and all-time gross receipts across Nigerian cinema exhibitors (Filmhouse, Genesis, Silverbird, Viva) in NGN and USD with admission estimates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-emerald-400/40 transition group relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                <Icon icon="solar:gallery-wide-bold" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Strict High-Res Portrait Posters</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strict editorial rule ensures only crisp portrait posters (minimum 450x600, 800x1200+ recommended) and high-res backdrops are cataloged — zero low-res banners.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-blue-400/40 transition group relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                <Icon icon="solar:tv-bold" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Streaming Availability &amp; Showtimes</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct watch links for Netflix, Prime Video, YouTube, NolliStream, Docuth, and live cinema showtimes updated twice daily.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-purple-400/40 transition group relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                <Icon icon="solar:bolt-circle-bold" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Global Edge Performance</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Served through global edge caches with sub-45ms responses. Rate-limited and protected with automated burst buffering.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-rose-400/40 transition group relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                <Icon icon="solar:diploma-verified-bold" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Commercial Distribution Rights</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clear licensing terms for mobile apps, entertainment portals, research labs, and streaming guides with transparent pricing.
              </p>
            </div>
          </div>
        </section>

        {/* ── Pricing & Plans Section ── */}
        <section id="pricing" className="scroll-mt-20 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Icon icon="solar:tag-price-bold" />
              Commercial API Plans
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Transparent Developer Pricing</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              MuviDB web platform is free for everyone. API access is our dedicated commercial product for developers, streaming apps, and enterprises.
            </p>

            {/* Currency Toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/10 text-xs mt-3">
              <button
                onClick={() => setCurrency('NGN')}
                className={`px-3 py-1.5 rounded-lg font-mono font-bold transition ${
                  currency === 'NGN' ? 'bg-brand text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                NGN (₦)
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg font-mono font-bold transition ${
                  currency === 'USD' ? 'bg-brand text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* 1. Community Free */}
            <div className="rounded-3xl bg-surface/50 border border-white/10 p-8 flex flex-col justify-between relative hover:border-white/20 transition backdrop-blur-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Community</h3>
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Free Forever
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white font-mono">{currency === 'NGN' ? '₦0' : '$0'}</span>
                  <span className="text-slate-400 text-xs font-mono">/month</span>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  For indie hobbyists, students, and research prototypes testing Nollywood data.
                </p>

                <div className="space-y-3.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span><strong>100,000 requests</strong> / month</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span><strong>60 req / min</strong> rate limit</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span>Preview Catalog (First 500 Films &amp; Talent)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0" />
                    <span>Top 10 Cast &amp; Crew preview</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Icon icon="solar:close-circle-linear" className="text-slate-600 text-base shrink-0" />
                    <span>No Box Office Gross rankings</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Icon icon="solar:close-circle-linear" className="text-slate-600 text-base shrink-0" />
                    <span>Non-commercial license</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => openKeyModal('free')}
                  className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition text-center"
                >
                  Get Instant Free Key
                </button>
              </div>
            </div>

            {/* 2. Pro Developer (Featured Commercial Tier) */}
            <div className="rounded-2xl bg-[#141A22] border-2 border-brand p-8 flex flex-col justify-between relative shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-white text-[10px] font-bold uppercase tracking-wider">
                Recommended for Apps &amp; Startups
              </div>

              <div>
                <div className="flex items-center justify-between mb-4 mt-1">
                  <h3 className="text-xl font-bold text-white">Pro Developer</h3>
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md bg-brand/20 text-brand border border-brand/40">
                    Commercial
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white font-mono">
                    {currency === 'NGN' ? '₦45,000' : '$29'}
                  </span>
                  <span className="text-slate-400 text-xs font-mono">/month</span>
                </div>
                <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                  Full commercial license for mobile apps, entertainment portals, syndication networks, and analytics teams.
                </p>

                <div className="space-y-3.5 text-xs text-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>1,500,000 requests</strong> / month</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>600 req / min</strong> burst limit</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>Full 12,400+ Films Catalog</strong> (Unrestricted)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span>Complete Ensemble Cast &amp; Crew filmographies</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>Box Office Gross Rankings</strong> &amp; weekly admissions</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span><strong>Commercial License</strong> included (White-label)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0" />
                    <span>Priority Discord &amp; email support</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => openKeyModal('pro')}
                  className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition shadow-lg shadow-brand/30 text-center"
                >
                  Upgrade to Pro Access
                </button>
              </div>
            </div>

            {/* 3. Enterprise */}
            <div className="rounded-3xl bg-surface/50 border border-white/10 p-8 flex flex-col justify-between relative hover:border-white/20 transition backdrop-blur-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Enterprise</h3>
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    High Scale
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white font-mono">Custom</span>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  For major streaming networks, broadcast distributors, telecom VAS, and global aggregators.
                </p>

                <div className="space-y-3.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span><strong>2,000+ req / min</strong> or custom rate limit</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Dedicated database read replica pool</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Automated daily bulk JSON database dumps</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Real-time webhook events &amp; delta sync</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span><strong>99.98% guaranteed SLA</strong> with contractual credit</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0" />
                    <span>Dedicated Technical Account Manager</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => openKeyModal('enterprise')}
                  className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition text-center"
                >
                  Contact Enterprise Sales
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ── Feature Comparison Table ── */}
        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-2xl font-bold text-white">Full Feature Comparison Matrix</h3>
            <p className="text-xs text-slate-400 mt-1">Detailed entitlement breakdown across all MuviDB Developer tiers.</p>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden bg-surface/40 backdrop-blur-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 font-mono">
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
                  <td className="p-4 text-center font-mono">100,000</td>
                  <td className="p-4 text-center font-mono font-bold text-white">1,500,000</td>
                  <td className="p-4 text-center font-mono">Custom / Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Burst Rate Limit</td>
                  <td className="p-4 text-center font-mono">60 req / min</td>
                  <td className="p-4 text-center font-mono font-bold text-brand">600 req / min</td>
                  <td className="p-4 text-center font-mono text-blue-400">2,000+ req / min</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Films Catalog Coverage</td>
                  <td className="p-4 text-center text-amber-400 font-semibold">First 500 Films (Preview)</td>
                  <td className="p-4 text-center font-bold text-white">Full 12,400+ Films</td>
                  <td className="p-4 text-center font-bold text-white">Full 12,400+ Films</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Talent &amp; Cast Directory</td>
                  <td className="p-4 text-center text-amber-400 font-semibold">First 500 People (Preview)</td>
                  <td className="p-4 text-center font-bold text-white">Full 15,000+ People</td>
                  <td className="p-4 text-center font-bold text-white">Full 15,000+ People</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Complete Ensemble Credits</td>
                  <td className="p-4 text-center text-slate-400">Top 10 Cast &amp; Crew</td>
                  <td className="p-4 text-center font-bold text-brand">Unrestricted</td>
                  <td className="p-4 text-center font-bold text-blue-400">Unrestricted</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4 font-semibold text-white">Theatrical Box Office Grosses</td>
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
                  <td className="p-4 font-semibold text-white">Support Channels</td>
                  <td className="p-4 text-center text-slate-400">Community Docs</td>
                  <td className="p-4 text-center text-white">Priority Discord &amp; Email</td>
                  <td className="p-4 text-center text-blue-400">Dedicated Slack &amp; TAM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── FAQ Accordion ── */}
        <section id="faq" className="max-w-3xl mx-auto space-y-6 scroll-mt-20">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white">Frequently Asked Questions</h3>
            <p className="text-xs text-slate-400 mt-1">Everything you need to know about integrating MuviDB&apos;s Developer API.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "How quickly are API keys issued?",
                a: "Free sandbox credentials are generated instantly upon application. Pro and Enterprise credentials are provisioned immediately with your webhook credentials."
              },
              {
                q: "What payment methods are supported for Pro API access?",
                a: "We support instant Nigerian local payments via OPay, Paystack, and Nigerian bank transfers (in NGN), as well as international Visa, Mastercard, and Stripe cards (in USD)."
              },
              {
                q: "What happens if our app exceeds the tier burst limit?",
                a: "If your system hits the rate limit threshold, our API responds with HTTP 429 Too Many Requests alongside a standard 'Retry-After' header. We provide automatic burst headroom to accommodate traffic spikes."
              },
              {
                q: "Can I use MuviDB data in a commercial mobile or streaming application?",
                a: "Yes! Both the Pro Developer and Enterprise tiers include full commercial licensing rights, allowing you to use the data in revenue-generating consumer apps, media monitors, and OTT platforms."
              },
              {
                q: "How frequently is Nollywood and Box Office data updated?",
                a: "Our core movie and talent databases are synchronized continuously through automated scrapers, OCR credit passes, and editorial curation. Cinema box office grosses are audited and updated every Monday and Wednesday."
              }
            ].map((faq, i) => (
              <details key={i} className="group p-5 rounded-2xl bg-surface/50 border border-white/5 open:border-white/15 transition">
                <summary className="font-bold text-sm text-white cursor-pointer list-none flex items-center justify-between">
                  <span>{faq.q}</span>
                  <Icon icon="solar:alt-arrow-down-linear" className="text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-slate-300 leading-relaxed mt-3 pt-3 border-t border-white/5">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="rounded-2xl bg-[#0E1217] border border-white/10 p-8 sm:p-12 text-center space-y-6 relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-white font-heading">
              Ready to Build with African Cinema Data?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Start building fast, accurate, and richly detailed cinema experiences. Get your free developer credentials in seconds.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => openKeyModal('free')}
              className="px-8 py-3.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-sm transition shadow-lg shadow-brand/25"
            >
              Get Free API Key
            </button>
            <button
              onClick={() => openKeyModal('pro')}
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition"
            >
              Start Pro Plan
            </button>
          </div>
        </section>

      </div>

      {/* ── API Key Request & Instant Generation Modal ── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0E121A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => {
                setShowKeyModal(false);
                setSubmittedKey(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition"
            >
              <Icon icon="solar:close-circle-linear" className="text-2xl" />
            </button>

            {!submittedKey ? (
              <form onSubmit={handleModalSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-wider mb-1">
                    <Icon icon="solar:key-bold" />
                    Developer Credentials
                  </div>
                  <h3 className="text-2xl font-bold text-white">Generate Your API Key</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select your tier to get access credentials immediately.
                  </p>
                </div>

                {/* Tier Switcher in Modal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Tier</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'free', label: 'Community ($0)' },
                      { id: 'pro', label: 'Pro ($29/mo)' },
                      { id: 'enterprise', label: 'Enterprise' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setModalTab(t.id === 'free' ? 'instant' : t.id);
                          setModalForm(prev => ({ ...prev, tier: t.id }));
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition text-center ${
                          modalForm.tier === t.id
                            ? 'bg-brand/20 border-brand text-brand'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Application Name *</label>
                  <input
                    type="text"
                    required
                    value={modalForm.appName}
                    onChange={(e) => setModalForm({ ...modalForm, appName: e.target.value })}
                    placeholder="e.g. Lagos Cinema Radar, CineStream App"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={modalForm.developerName}
                      onChange={(e) => setModalForm({ ...modalForm, developerName: e.target.value })}
                      placeholder="e.g. Alex Okafor"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Developer Email *</label>
                    <input
                      type="email"
                      required
                      value={modalForm.email}
                      onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                      placeholder="developer@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Organization (Optional)</label>
                  <input
                    type="text"
                    value={modalForm.company}
                    onChange={(e) => setModalForm({ ...modalForm, company: e.target.value })}
                    placeholder="e.g. MediaTech Global, University of Ibadan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Intended Use Case</label>
                  <textarea
                    rows={2}
                    value={modalForm.useCase}
                    onChange={(e) => setModalForm({ ...modalForm, useCase: e.target.value })}
                    placeholder="Briefly describe what you are building..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-brand resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Icon icon="solar:refresh-linear" className="animate-spin text-base" />
                        <span>Provisioning Key...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:plain-bold" className="text-base" />
                        <span>{modalForm.tier === 'free' ? 'Generate Instant Free Key' : 'Submit Pro Application'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Icon icon="solar:check-circle-bold" className="text-3xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Credentials Ready!</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                    {submittedKey === 'pending_review'
                      ? 'Your commercial application has been dispatched to our engineering desk. You will receive active credentials via email shortly.'
                      : 'Here is your active sandbox key. You can use it immediately in the live console or your code.'}
                  </p>
                </div>

                {submittedKey !== 'pending_review' && (
                  <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-left space-y-2">
                    <span className="text-[11px] font-mono text-slate-400">Your API Key:</span>
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 font-mono text-xs text-emerald-300">
                      <span className="truncate">{submittedKey}</span>
                      <button
                        onClick={() => handleCopy(submittedKey, 'code')}
                        className="px-2.5 py-1 rounded-lg bg-brand text-white text-[11px] font-bold shrink-0 hover:bg-brand/90 transition"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setShowKeyModal(false);
                      setSubmittedKey(null);
                    }}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
                  >
                    Done &amp; Explore Docs
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
