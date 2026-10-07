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
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
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
  const [docsTab, setDocsTab] = useState('reference'); // 'reference' | 'guide'
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    return ['All', ...new Set(ENDPOINTS.map(e => e.category))];
  }, []);

  const filteredEndpoints = useMemo(() => {
    return ENDPOINTS.filter(e => {
      const matchesCat = selectedCategory === 'All' || e.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

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

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-brand/10 blur-[150px] pointer-events-none rounded-full" />

        {/* ── Top Navigation Bar (Atlas Style) ── */}
        <header className="flex items-center justify-between gap-4 py-4 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="font-heading font-black text-xl text-white tracking-tight">Muvi<span className="text-brand">DB</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
              <a href="#reference" className="hover:text-white transition">Docs</a>
              <a href="#reference" className="hover:text-white transition">API Reference</a>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <a href="#architecture" className="hover:text-white transition">Features</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>v1.0 Production</span>
            </div>
            <button
              onClick={() => openKeyModal('free')}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-black font-bold text-xs transition shadow-sm"
            >
              Get API key
            </button>
          </div>
        </header>

        {/* ── Hero Section (Atlas Split 2-Column Standard) ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center pt-8 pb-12 relative z-10">
          {/* Left: Typography & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-mono text-emerald-400 font-semibold">MuviDB</span>
              <span className="text-white/20">•</span>
              <span className="text-slate-400">v1.0 now live</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.06] font-heading">
              One API for<br />
              everything your<br />
              <span className="text-brand">cinema app needs.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              Films, verified ensemble cast &amp; crew, box office grosses, and streaming availability behind a single clean endpoint. Ship in minutes, scale to billions of requests.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => openKeyModal('free')}
                className="px-7 py-3 rounded-full bg-white hover:bg-slate-200 text-black font-bold text-xs tracking-wide transition shadow-xl"
              >
                Get API key
              </button>
              <a
                href="#reference"
                className="px-7 py-3 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/15 text-white font-medium text-xs tracking-wide transition flex items-center gap-2 group"
              >
                <span>Read the docs</span>
                <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">→</span>
              </a>
            </div>

            {/* Quick Metrics Bar */}
            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono border-t border-white/5">
              <div><strong className="text-white font-bold">12,400+</strong> Films</div>
              <div className="text-white/20">•</div>
              <div><strong className="text-white font-bold">15,000+</strong> Talent</div>
              <div className="text-white/20">•</div>
              <div><strong className="text-amber-400 font-bold">₦18.5B+</strong> Box Office</div>
              <div className="text-white/20">•</div>
              <div><strong className="text-emerald-400 font-bold">&lt; 42ms</strong> Edge Latency</div>
            </div>
          </div>

          {/* Right: The macOS Interactive Code Terminal (Atlas request.ts card) */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-[#090C12] border border-white/10 shadow-2xl overflow-hidden font-mono text-xs text-left">
              {/* macOS Window Titlebar */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                  <span className="ml-3 text-slate-400 text-xs font-sans font-medium">request.ts</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  GET
                </span>
              </div>

              {/* Request Code Area */}
              <div className="p-5 space-y-1.5 text-slate-300 leading-relaxed overflow-x-auto no-scrollbar">
                <div className="text-slate-500">// query Nollywood catalog &amp; box office in one call</div>
                <div>
                  <span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> muvidb.films.<span className="text-blue-400">search</span>(&#123;
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">query:</span> <span className="text-emerald-400">&quot;wedding&quot;</span>,
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">genre:</span> <span className="text-emerald-400">&quot;Romance&quot;</span>,
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">year:</span> <span className="text-amber-400">2024</span>
                </div>
                <div>&#125;);</div>
              </div>

              {/* Status Bar */}
              <div className="px-5 py-2.5 bg-white/[0.02] border-y border-white/5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span>← 200 OK</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">38ms</span>
                </div>
                <span className="text-slate-500 text-[10px]">canonical payload</span>
              </div>

              {/* Response Body */}
              <div className="p-5 space-y-1 text-slate-300 leading-relaxed overflow-x-auto no-scrollbar max-h-56">
                <div className="text-slate-500">&#123;</div>
                <div className="pl-4">
                  <span className="text-cyan-400">&quot;id&quot;</span>: <span className="text-emerald-400">&quot;the-wedding-party-2016&quot;</span>,
                </div>
                <div className="pl-4">
                  <span className="text-cyan-400">&quot;title&quot;</span>: <span className="text-emerald-400">&quot;The Wedding Party&quot;</span>,
                </div>
                <div className="pl-4">
                  <span className="text-cyan-400">&quot;release_year&quot;</span>: <span className="text-amber-400">2016</span>,
                </div>
                <div className="pl-4">
                  <span className="text-cyan-400">&quot;box_office_gross&quot;</span>: <span className="text-emerald-400">&quot;₦453,000,000&quot;</span>,
                </div>
                <div className="pl-4">
                  <span className="text-cyan-400">&quot;streaming&quot;</span>: [<span className="text-emerald-400">&quot;Netflix&quot;</span>, <span className="text-emerald-400">&quot;Prime Video&quot;</span>],
                </div>
                <div className="pl-4">
                  <span className="text-cyan-400">&quot;status&quot;</span>: <span className="text-emerald-400">&quot;verified&quot;</span>
                </div>
                <div className="text-slate-500">&#125;</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── API Reference & Documentation Explorer (Easypay Style) ── */}
        <section id="reference" className="scroll-mt-12 space-y-6 relative z-10">
          {/* Sub-bar with Mode Toggle + Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl bg-[#0C0F16] border border-white/10">
            {/* Toggle Pills: Documentation vs API Reference */}
            <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/5 text-xs">
              <button
                onClick={() => setDocsTab('reference')}
                className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
                  docsTab === 'reference'
                    ? 'bg-white/10 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                API Reference
              </button>
              <button
                onClick={() => setDocsTab('guide')}
                className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
                  docsTab === 'guide'
                    ? 'bg-white/10 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Documentation
              </button>
            </div>

            {/* Search Input Bar (Easypay Search style) */}
            <div className="flex-1 max-w-md relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search endpoints, parameters, methods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-16 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
                Ctrl K
              </div>
            </div>

            {/* Presets Chips */}
            <div className="hidden xl:flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-mono">Quick:</span>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-slate-300 hover:text-white transition font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Explorer Grid (2 Columns: Navigation Tree on Left, Details & Live Playground on Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Categorized Endpoints Tree */}
            <div className="lg:col-span-4 space-y-4">
              {/* Category Filter Pills */}
              <div 
                className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/5 overflow-x-auto no-scrollbar scrollbar-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
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

              {/* Endpoints Sidebar Items */}
              <div className="space-y-2">
                {filteredEndpoints.map(endpoint => {
                  const isSelected = selectedEndpoint.id === endpoint.id;
                  return (
                    <button
                      key={endpoint.id}
                      onClick={() => setSelectedEndpoint(endpoint)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#121622] border-brand/70 shadow-md text-white'
                          : 'bg-[#0A0D13] border-white/5 hover:border-white/15 hover:bg-[#0E121A]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{endpoint.name}</span>
                        <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${endpoint.tierBadgeColor}`}>
                          {endpoint.tier.includes('Pro') ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px]">
                          {endpoint.method}
                        </span>
                        <span className="text-slate-400 truncate">{endpoint.path}</span>
                      </div>
                    </button>
                  );
                })}

                {filteredEndpoints.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-white/[0.02] border border-white/5">
                    No matching endpoints found for &ldquo;{searchQuery}&rdquo;.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Endpoint Specification & Interactive Live Console */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Endpoint Documentation Card */}
              <div className="rounded-2xl bg-[#0A0D13] border border-white/10 p-6 space-y-6">
                {/* Endpoint Header */}
                <div className="space-y-3 pb-6 border-b border-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold text-xs border border-emerald-500/20">
                        {selectedEndpoint.method}
                      </span>
                      <span className="text-white text-sm font-semibold">{selectedEndpoint.path}</span>
                    </div>
                    <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md border ${selectedEndpoint.tierBadgeColor}`}>
                      {selectedEndpoint.tier}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white tracking-tight">{selectedEndpoint.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedEndpoint.description}
                  </p>
                </div>

                {/* Base URL & Auth Card (Easypay style) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-300">Base Production URL</div>
                    <div className="font-mono text-slate-400 text-[11px]">https://muvidb.com{selectedEndpoint.path}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(`https://muvidb.com${selectedEndpoint.path}`, 'quickstart')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono transition flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Icon icon="solar:copy-linear" className="text-xs" />
                    <span>Copy URL</span>
                  </button>
                </div>

                {/* Parameter Tuning Inputs */}
                {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Query Parameters</h4>
                      <span className="text-[11px] text-slate-500 font-mono">Tune live inputs</span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedEndpoint.params.map(param => (
                        <div key={param.name} className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-white font-semibold">{param.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">{param.type}</span>
                              {param.required && (
                                <span className="text-[10px] text-rose-400 font-mono">required</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">{param.desc}</span>
                          </div>
                          <input
                            type="text"
                            value={playgroundParams[param.name] ?? param.example ?? ''}
                            onChange={(e) => setPlaygroundParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                            placeholder={`Example: ${param.example}`}
                            className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-brand"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Code Generator & Snippets (Easypay / Stripe right console) */}
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

                  <button
                    onClick={() => handleCopy(activeSnippet, 'code')}
                    className="px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition flex items-center gap-1.5"
                  >
                    <Icon icon={copiedCode ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedCode ? "text-emerald-400" : ""} />
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                {/* Code Body */}
                <div className="p-5 font-mono text-xs text-slate-200 overflow-x-auto bg-[#05070A] leading-relaxed">
                  <pre>{activeSnippet}</pre>
                </div>
              </div>

              {/* Live Mock Response Inspector Card */}
              <div className="rounded-2xl bg-[#090C11] border border-white/10 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Icon icon="solar:code-file-bold" className="text-emerald-400 text-sm" />
                      Response Preview
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                      200 OK
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                      Time: 38ms
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(selectedEndpoint.responseSample, 'json')}
                    className="px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition flex items-center gap-1.5"
                  >
                    <Icon icon={copiedJson ? "solar:check-circle-bold" : "solar:copy-linear"} className={copiedJson ? "text-emerald-400" : ""} />
                    <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
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
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Flexible plans that grow with you
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              Free for indie developers and personal experiments. Upgrade to high-throughput commercial access when your app scales.
            </p>

            {/* Switchers Row (Billing cycle + Currency) */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              {/* Billing Cycle Switcher */}
              <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs shadow-inner">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
                    billingCycle === 'monthly'
                      ? 'bg-white/10 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                    billingCycle === 'yearly'
                      ? 'bg-white/10 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Yearly</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand/20 text-brand border border-brand/30">
                    Save 20%
                  </span>
                </button>
              </div>

              {/* Currency Switcher */}
              <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs shadow-inner">
                <button
                  onClick={() => setCurrency('NGN')}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold transition ${
                    currency === 'NGN'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NGN (₦)
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold transition ${
                    currency === 'USD'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          {/* 3 Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            
            {/* 1. Community (Free) */}
            <div className="rounded-2xl bg-[#0B0E14] border border-white/10 p-7 lg:p-8 flex flex-col justify-between hover:border-white/20 transition relative">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">Community</h3>
                  <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                    Free Forever
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed min-h-[34px]">
                  For indie hobbyists, students, and research prototypes exploring Nollywood cinema data.
                </p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {currency === 'NGN' ? '₦0' : '$0'}
                  </span>
                  <span className="text-xs font-medium text-slate-400">/month</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-6">No credit card required</p>

                <button
                  onClick={() => openKeyModal('free')}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition text-center mb-6"
                >
                  Get Free API Key
                </button>

                <div className="border-t border-white/5 pt-6 space-y-3 text-xs text-slate-300">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">What&apos;s included:</div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0 mt-0.5" />
                    <span><strong>100,000 requests</strong> / month</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0 mt-0.5" />
                    <span><strong>60 req / min</strong> rate limit</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0 mt-0.5" />
                    <span>Preview Catalog (First 500 Films &amp; Talent)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-base shrink-0 mt-0.5" />
                    <span>Top 10 Cast &amp; Crew filmographies</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-slate-400">
                    <Icon icon="solar:close-circle-linear" className="text-slate-600 text-base shrink-0 mt-0.5" />
                    <span>No Box Office gross rankings</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-slate-400">
                    <Icon icon="solar:close-circle-linear" className="text-slate-600 text-base shrink-0 mt-0.5" />
                    <span>Non-commercial license</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Pro Developer */}
            <div className="rounded-2xl bg-gradient-to-b from-[#141A24] to-[#0A0D13] border border-brand/50 ring-1 ring-brand/30 p-7 lg:p-8 flex flex-col justify-between shadow-2xl relative">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">Pro Developer</h3>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30">
                    Most Popular
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-6 leading-relaxed min-h-[34px]">
                  Full commercial license for mobile apps, entertainment portals, syndication networks, and analytics teams.
                </p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {currency === 'NGN'
                      ? (billingCycle === 'yearly' ? '₦36,000' : '₦45,000')
                      : (billingCycle === 'yearly' ? '$23' : '$29')}
                  </span>
                  <span className="text-xs font-medium text-slate-400">/month</span>
                </div>
                <p className="text-[11px] text-brand/80 mb-6">
                  {billingCycle === 'yearly'
                    ? (currency === 'NGN' ? 'Billed annually at ₦432,000 (Save 20%)' : 'Billed annually at $276 (Save 20%)')
                    : 'Billed monthly · Cancel anytime'}
                </p>

                <button
                  onClick={() => openKeyModal('pro')}
                  className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition shadow-lg shadow-brand/25 text-center mb-6"
                >
                  Upgrade to Pro Access
                </button>

                <div className="border-t border-white/10 pt-6 space-y-3 text-xs text-slate-200">
                  <div className="text-[11px] font-bold text-brand uppercase tracking-wider mb-2">Everything in Community, plus:</div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span><strong>1,500,000 requests</strong> / month</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span><strong>600 req / min</strong> burst limit</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span><strong>Full 12,400+ Films Catalog</strong> (Unrestricted)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span>Complete Ensemble Cast &amp; Crew filmographies</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span><strong>Theatrical Box Office Grosses</strong> &amp; weekly admissions</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span><strong>Commercial License</strong> included (White-label)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                    <span>Priority Discord &amp; email support (sub-12h response)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Enterprise */}
            <div className="rounded-2xl bg-[#0B0E14] border border-white/10 p-7 lg:p-8 flex flex-col justify-between hover:border-white/20 transition relative">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">Enterprise</h3>
                  <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Scale &amp; SLA
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed min-h-[34px]">
                  For major streaming networks, broadcast distributors, telecom VAS, and global aggregators.
                </p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white font-mono">Custom</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-6">Tailored agreements · Dedicated replica pool</p>

                <button
                  onClick={() => openKeyModal('enterprise')}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition text-center mb-6"
                >
                  Contact Enterprise Sales
                </button>

                <div className="border-t border-white/5 pt-6 space-y-3 text-xs text-slate-300">
                  <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-2">Everything in Pro, plus:</div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0 mt-0.5" />
                    <span><strong>2,000+ req / min</strong> or custom rate limit</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0 mt-0.5" />
                    <span>Dedicated database read replica pool</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0 mt-0.5" />
                    <span>Automated daily bulk JSON database dumps</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0 mt-0.5" />
                    <span>Real-time webhook events &amp; delta sync</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0 mt-0.5" />
                    <span><strong>99.98% guaranteed SLA</strong> with contractual credit</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon icon="solar:check-circle-bold" className="text-blue-400 text-base shrink-0 mt-0.5" />
                    <span>Dedicated Technical Account Manager &amp; Slack</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── Compare Plans Matrix ── */}
        <section className="space-y-8 scroll-mt-20" id="compare">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">Compare plans</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Detailed entitlement breakdown and feature matrix across all MuviDB Developer tiers.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0A0D13]/80 backdrop-blur-md">
            <div className="overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="p-5 w-2/5 font-semibold text-slate-300">Plan Features</th>
                    <th className="p-5 w-1/5 text-center">
                      <div className="font-bold text-sm text-white mb-2">Community</div>
                      <button 
                        onClick={() => openKeyModal('free')} 
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold transition"
                      >
                        Get Free Key
                      </button>
                    </th>
                    <th className="p-5 w-1/5 text-center bg-brand/[0.03]">
                      <div className="font-bold text-sm text-brand mb-2">Pro Developer</div>
                      <button 
                        onClick={() => openKeyModal('pro')} 
                        className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand/90 text-white text-[11px] font-semibold transition shadow-sm"
                      >
                        Get Pro Access
                      </button>
                    </th>
                    <th className="p-5 w-1/5 text-center">
                      <div className="font-bold text-sm text-white mb-2">Enterprise</div>
                      <button 
                        onClick={() => openKeyModal('enterprise')} 
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold transition"
                      >
                        Contact Sales
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {/* Category 1: Usage & Quotas */}
                  <tr className="bg-white/[0.04]">
                    <td colSpan={4} className="p-3 px-5 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                      Usage &amp; Quotas
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Monthly Request Quota</td>
                    <td className="p-4 text-center font-mono">100,000</td>
                    <td className="p-4 text-center font-mono font-bold text-white bg-brand/[0.02]">1,500,000</td>
                    <td className="p-4 text-center font-mono">Custom / Unlimited</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Burst Rate Limit</td>
                    <td className="p-4 text-center font-mono">60 req / min</td>
                    <td className="p-4 text-center font-mono font-bold text-brand bg-brand/[0.02]">600 req / min</td>
                    <td className="p-4 text-center font-mono text-blue-400">2,000+ req / min</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Global Edge Cache (sub-45ms)</td>
                    <td className="p-4 text-center"><Icon icon="solar:check-circle-bold" className="text-emerald-400 inline text-base" /></td>
                    <td className="p-4 text-center bg-brand/[0.02]"><Icon icon="solar:check-circle-bold" className="text-brand inline text-base" /></td>
                    <td className="p-4 text-center"><Icon icon="solar:check-circle-bold" className="text-blue-400 inline text-base" /></td>
                  </tr>

                  {/* Category 2: Catalog & Metadata */}
                  <tr className="bg-white/[0.04]">
                    <td colSpan={4} className="p-3 px-5 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                      Catalog &amp; Metadata
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Films &amp; Series Catalog</td>
                    <td className="p-4 text-center text-amber-400 font-medium">First 500 (Preview)</td>
                    <td className="p-4 text-center font-bold text-white bg-brand/[0.02]">Full 12,400+ Films</td>
                    <td className="p-4 text-center font-bold text-white">Full 12,400+ Films</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Talent &amp; Cast Directory</td>
                    <td className="p-4 text-center text-amber-400 font-medium">First 500 (Preview)</td>
                    <td className="p-4 text-center font-bold text-white bg-brand/[0.02]">Full 15,000+ People</td>
                    <td className="p-4 text-center font-bold text-white">Full 15,000+ People</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Ensemble Cast &amp; Crew Credits</td>
                    <td className="p-4 text-center text-slate-400">Top 10 only</td>
                    <td className="p-4 text-center font-bold text-brand bg-brand/[0.02]">Complete Filmographies</td>
                    <td className="p-4 text-center font-bold text-blue-400">Complete Filmographies</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Theatrical Box Office Grosses</td>
                    <td className="p-4 text-center"><Icon icon="solar:close-circle-linear" className="text-slate-600 inline text-base" /></td>
                    <td className="p-4 text-center bg-brand/[0.02]"><Icon icon="solar:check-circle-bold" className="text-brand inline text-base" /></td>
                    <td className="p-4 text-center"><Icon icon="solar:check-circle-bold" className="text-emerald-400 inline text-base" /></td>
                  </tr>

                  {/* Category 3: Licensing & Architecture */}
                  <tr className="bg-white/[0.04]">
                    <td colSpan={4} className="p-3 px-5 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                      Licensing &amp; Architecture
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Commercial Application License</td>
                    <td className="p-4 text-center text-slate-400">Non-commercial</td>
                    <td className="p-4 text-center text-emerald-400 font-semibold bg-brand/[0.02]">White-label Commercial</td>
                    <td className="p-4 text-center text-emerald-400 font-semibold">White-label Commercial</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Webhook Events &amp; Delta Sync</td>
                    <td className="p-4 text-center"><Icon icon="solar:close-circle-linear" className="text-slate-600 inline text-base" /></td>
                    <td className="p-4 text-center text-slate-300 bg-brand/[0.02]">Standard Webhooks</td>
                    <td className="p-4 text-center text-blue-400 font-semibold">Real-time Dedicated</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Automated Bulk Database Dumps</td>
                    <td className="p-4 text-center"><Icon icon="solar:close-circle-linear" className="text-slate-600 inline text-base" /></td>
                    <td className="p-4 text-center text-slate-400 bg-brand/[0.02]"><Icon icon="solar:close-circle-linear" className="text-slate-600 inline text-base" /></td>
                    <td className="p-4 text-center text-emerald-400 font-semibold">Daily JSON &amp; SQL Dumps</td>
                  </tr>

                  {/* Category 4: Support & SLA */}
                  <tr className="bg-white/[0.04]">
                    <td colSpan={4} className="p-3 px-5 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                      Support &amp; SLA
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Support Channels</td>
                    <td className="p-4 text-center text-slate-400">Community Docs</td>
                    <td className="p-4 text-center text-white bg-brand/[0.02]">Priority Discord &amp; Email</td>
                    <td className="p-4 text-center text-blue-400">Dedicated Slack &amp; TAM</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-4 px-5 font-medium text-white">Guaranteed Uptime SLA</td>
                    <td className="p-4 text-center text-slate-400">Best Effort (99.0%)</td>
                    <td className="p-4 text-center font-medium text-white bg-brand/[0.02]">99.9% Uptime</td>
                    <td className="p-4 text-center font-bold text-blue-400">99.98% SLA (Contractual)</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
