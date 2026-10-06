import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchUserManagedCompanies,
  fetchCompanyFullProfile,
  saveCompanyMovie,
  fetchFilmCredits,
  saveFilmCredit,
  deleteFilmCredit,
  createPersonAndAttachCredit,
  saveTalentRepresentation,
  deleteTalentRepresentation,
  updateCompanyProfile,
} from '../lib/companyClient';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, formatPersonName, toTitleCase } from '../utils/format';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation tabs: 'overview' | 'films' | 'credits' | 'talents' | 'team' | 'api' | 'settings'
  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    });
  };

  // State
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Movie Management Modals
  const [movieModalOpen, setMovieModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [savingMovie, setSavingMovie] = useState(false);
  const [movieForm, setMovieForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    poster_url: '',
    backdrop_url: '',
    synopsis: '',
    trailer_url: '',
    status: 'released',
    release_date: '',
    box_office_domestic: '',
    box_office_worldwide: '',
    box_office_currency: 'NGN',
    role: 'production',
  });

  // Credit Management
  const [selectedFilmForCredits, setSelectedFilmForCredits] = useState(null);
  const [creditsList, setCreditsList] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [newPersonModalOpen, setNewPersonModalOpen] = useState(false);
  const [savingCredit, setSavingCredit] = useState(false);

  // Person search for credits
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [searchingPeople, setSearchingPeople] = useState(false);

  // Credit Form
  const [creditForm, setCreditForm] = useState({
    character_name: '',
    role: 'Actor',
    department: 'Cast',
    billing_order: 1,
  });

  // New Person Form
  const [newPersonForm, setNewPersonForm] = useState({
    name: '',
    photo_url: '',
    bio: '',
    birth_date: '',
    primary_role: 'Actor',
  });

  // Talent Representation Modal
  const [talentModalOpen, setTalentModalOpen] = useState(false);
  const [talentForm, setTalentForm] = useState({
    person_id: '',
    representation_type: 'Theatrical / Film',
    agent_name: '',
    contact_email: '',
    contact_phone: '',
    booking_url: '',
  });

  // API Access state
  const [apiKey, setApiKey] = useState('mvd_live_7e8b91a24d5f6c802143eb99a4');
  const [keyCopied, setKeyCopied] = useState(false);
  const [checkingOutOpay, setCheckingOutOpay] = useState(false);
  const [opayModalData, setOpayModalData] = useState(null);
  const [confirmingOpayPayment, setConfirmingOpayPayment] = useState(false);
  const [selectedOpayMethod, setSelectedOpayMethod] = useState('card');

  const handleOpayCheckout = async (amount = 25000, planType = 'pro_monthly') => {
    setCheckingOutOpay(true);
    try {
      const res = await fetch('/api/opay?op=initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany?.id,
          userEmail: user?.email || 'admin@muvidb.com',
          userName: user?.user_metadata?.name || currentCompany?.name || 'Studio Representative',
          amount,
          planType,
          returnUrl: window.location.origin + '/company/dashboard?tab=api&payment=success',
        }),
      });

      const data = await res.json().catch(() => null);

      if (data?.isSandbox || data?.cashierUrl?.includes('mock_opay=1')) {
        setOpayModalData({
          reference: data.reference || `MUV_${Date.now()}`,
          orderNo: data.orderNo || `OPAY_${Date.now()}`,
          amount,
          planType,
          companyId: currentCompany?.id,
        });
      } else if (data?.cashierUrl) {
        toast.success('Redirecting to OPay Cashier...');
        window.location.href = data.cashierUrl;
      } else {
        toast.error(data?.error || 'Failed to initialize OPay checkout. Please verify OPay credentials.');
      }
    } catch (err) {
      console.error('OPay checkout error:', err);
      toast.error('Failed to connect to payment gateway.');
    } finally {
      setCheckingOutOpay(false);
    }
  };

  const handleConfirmMockOpay = async () => {
    setConfirmingOpayPayment(true);
    try {
      const res = await fetch('/api/opay?op=confirm_sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: opayModalData?.companyId || currentCompany?.id,
          reference: opayModalData?.reference,
        }),
      });
      const result = await res.json().catch(() => null);
      if (result?.success) {
        toast.success('Payment Confirmed! Studio Pro API tier is now active.');
        setOpayModalData(null);
        if (currentCompany) {
          setCurrentCompany({ ...currentCompany, api_tier: 'pro' });
        }
        setRefreshTrigger((prev) => prev + 1);
      } else {
        toast.error(result?.error || 'Failed to confirm sandbox payment');
      }
    } catch (err) {
      toast.error('Payment confirmation failed');
    } finally {
      setConfirmingOpayPayment(false);
    }
  };

  // Team Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');

  // Load companies
  useEffect(() => {
    async function loadUserCompanies() {
      setLoading(true);
      try {
        const list = await fetchUserManagedCompanies(user);
        setCompanies(list);

        if (list.length > 0) {
          const requestedCompanyId = searchParams.get('companyId');
          const matched = list.find((c) => c.id === requestedCompanyId) || list[0];
          setCurrentCompany(matched);
        }
      } catch (err) {
        console.error('Error loading user companies:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserCompanies();
  }, [user, searchParams.get('companyId')]);

  // Load full profile of current company
  useEffect(() => {
    if (!currentCompany?.id) return;
    let isMounted = true;

    async function loadDetails() {
      try {
        const details = await fetchCompanyFullProfile(currentCompany.id);
        if (isMounted) {
          setCompanyDetails(details);
          if (details?.films?.length > 0 && !selectedFilmForCredits) {
            setSelectedFilmForCredits(details.films[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching company details:', err);
      }
    }

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [currentCompany?.id, refreshTrigger]);

  // Load credits when a film is selected
  useEffect(() => {
    if (!selectedFilmForCredits?.id) {
      setCreditsList([]);
      return;
    }

    async function loadFilmCredits() {
      setLoadingCredits(true);
      try {
        const list = await fetchFilmCredits(selectedFilmForCredits.id);
        setCreditsList(list);
      } catch (err) {
        console.error('Error fetching film credits:', err);
      } finally {
        setLoadingCredits(false);
      }
    }

    loadFilmCredits();
  }, [selectedFilmForCredits?.id]);

  // People search autocomplete for credits & talent representation
  useEffect(() => {
    if (personQuery.trim().length < 2 || selectedPerson) {
      setPersonResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingPeople(true);
      try {
        const { data } = await supabase
          .from('people')
          .select('id, name, slug, photo_url, primary_role')
          .ilike('name', `%${personQuery.trim()}%`)
          .order('name', { ascending: true })
          .limit(6);

        setPersonResults(data || []);
      } catch (err) {
        console.error('Error searching people:', err);
      } finally {
        setSearchingPeople(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [personQuery, selectedPerson]);

  // Calculations for Overview stats
  const stats = useMemo(() => {
    if (!companyDetails) return { totalFilms: 0, totalBoxOffice: 0, rosterSize: 0, activeTheatrical: 0 };
    const films = companyDetails.films || [];
    const totalFilms = films.length;
    const activeTheatrical = films.filter((f) => f.status === 'in_theaters').length;
    const totalBoxOffice = films.reduce((acc, f) => acc + (Number(f.box_office_worldwide) || Number(f.box_office_domestic) || 0), 0);
    const rosterSize = companyDetails.talents?.length || 0;
    const teamSize = companyDetails.members?.length || 1;

    return {
      totalFilms,
      totalBoxOffice,
      activeTheatrical,
      rosterSize,
      teamSize,
    };
  }, [companyDetails]);

  // Format currency
  const formatNaira = (val) => {
    if (!val) return '₦0';
    if (val >= 1_000_000_000) return `₦${(val / 1_000_000_000).toFixed(2)}B`;
    if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(2)}M`;
    return `₦${Number(val).toLocaleString()}`;
  };

  // Movie Save Handler
  const handleSaveMovie = async (e) => {
    e.preventDefault();
    if (!currentCompany?.id) return;
    if (!movieForm.title.trim()) {
      toast.error('Movie title is required');
      return;
    }

    setSavingMovie(true);
    try {
      await saveCompanyMovie(currentCompany.id, {
        id: editingMovie?.id,
        ...movieForm,
      });

      toast.success(editingMovie ? 'Movie updated successfully!' : 'Movie added to studio slate!');
      setMovieModalOpen(false);
      setEditingMovie(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('Error saving movie:', err);
      toast.error('Failed to save movie. Please try again.');
    } finally {
      setSavingMovie(false);
    }
  };

  // Open Edit Movie Modal
  const openEditMovieModal = (film) => {
    setEditingMovie(film);
    setMovieForm({
      title: film.title || '',
      year: film.year || new Date().getFullYear(),
      poster_url: film.poster_url || '',
      backdrop_url: film.backdrop_url || '',
      synopsis: film.synopsis || '',
      trailer_url: film.trailer_url || '',
      status: film.status || 'released',
      release_date: film.release_date || '',
      box_office_domestic: film.box_office_domestic || '',
      box_office_worldwide: film.box_office_worldwide || '',
      box_office_currency: film.box_office_currency || 'NGN',
      role: film.role || 'production',
    });
    setMovieModalOpen(true);
  };

  // Credit Save Handler (Zero duplicate guarantee)
  const handleSaveCredit = async (e) => {
    e.preventDefault();
    if (!selectedFilmForCredits?.id) {
      toast.error('Please select a film first');
      return;
    }
    if (!selectedPerson?.id) {
      toast.error('Please select an actor or filmmaker');
      return;
    }

    setSavingCredit(true);
    try {
      await saveFilmCredit(selectedFilmForCredits.id, selectedPerson.id, creditForm);
      toast.success('Credit added to film ensemble (zero duplicates guaranteed)!');
      setCreditModalOpen(false);
      setSelectedPerson(null);
      setPersonQuery('');
      // Reload credits
      const updated = await fetchFilmCredits(selectedFilmForCredits.id);
      setCreditsList(updated);
    } catch (err) {
      console.error('Error saving credit:', err);
      toast.error('Failed to add credit.');
    } finally {
      setSavingCredit(false);
    }
  };

  // Create New Person & Link Credit
  const handleCreateNewPersonAndCredit = async (e) => {
    e.preventDefault();
    if (!selectedFilmForCredits?.id) return;
    if (!newPersonForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSavingCredit(true);
    try {
      await createPersonAndAttachCredit(selectedFilmForCredits.id, newPersonForm, creditForm);
      toast.success(`${newPersonForm.name} created and credited!`);
      setNewPersonModalOpen(false);
      setNewPersonForm({ name: '', photo_url: '', bio: '', birth_date: '', primary_role: 'Actor' });
      // Reload credits
      const updated = await fetchFilmCredits(selectedFilmForCredits.id);
      setCreditsList(updated);
    } catch (err) {
      console.error('Error creating person:', err);
      toast.error('Failed to create person.');
    } finally {
      setSavingCredit(false);
    }
  };

  // Delete Credit
  const handleDeleteCredit = async (creditId) => {
    if (!window.confirm('Are you sure you want to remove this credit?')) return;
    try {
      await deleteFilmCredit(creditId);
      toast.success('Credit removed');
      setCreditsList((prev) => prev.filter((c) => c.id !== creditId));
    } catch (err) {
      toast.error('Failed to delete credit');
    }
  };

  // Save Talent Representation
  const handleSaveTalentRep = async (e) => {
    e.preventDefault();
    if (!currentCompany?.id) return;
    if (!selectedPerson?.id) {
      toast.error('Please select a person to represent');
      return;
    }

    try {
      await saveTalentRepresentation(currentCompany.id, {
        person_id: selectedPerson.id,
        ...talentForm,
      });
      toast.success('Talent added to official roster!');
      setTalentModalOpen(false);
      setSelectedPerson(null);
      setPersonQuery('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      toast.error('Failed to add talent representation');
    }
  };

  // Copy API Key
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setKeyCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon icon="solar:restart-linear" className="animate-spin text-brand" width="32" />
          <p className="text-xs text-text-muted font-medium">Loading Studio Workspace...</p>
        </div>
      </div>
    );
  }

  // If user has no company yet
  if (!currentCompany && companies.length === 0) {
    return (
      <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand/20">
            <Icon icon="solar:buildings-bold" width="32" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">No Studio Profile Linked</h2>
          <p className="text-sm text-text-muted mb-6 leading-relaxed">
            You do not currently manage an official production company or agency. Claim an existing company or create a new studio page on MuviDB.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/claim/company"
              className="bg-brand text-white font-bold py-3 px-4 rounded-xl text-sm transition hover:bg-brand/90 flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
            >
              <Icon icon="solar:shield-check-bold" width="18" />
              Claim Existing Studio
            </Link>
            <Link
              to="/companies"
              className="py-3 px-4 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-2 transition text-text-muted hover:text-text-primary"
            >
              Explore Studios Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col md:flex-row">
      
      {/* ── LEFT SIDEBAR (Task.Pro & RealEstate Pro Aesthetic) ── */}
      <aside className="w-full md:w-64 bg-surface border-r border-border shrink-0 flex flex-col justify-between p-4 md:p-5">
        <div>
          {/* Logo & Company Dropdown Switcher */}
          <div className="mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-black text-sm shadow-md shadow-brand/20">
                M
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-text-primary">MuviDB Studio</span>
                <span className="block text-[10px] text-brand uppercase font-bold tracking-widest">Management Hub</span>
              </div>
            </div>

            {/* Current Studio Selector */}
            {companies.length > 1 ? (
              <div className="relative">
                <select
                  value={currentCompany?.id}
                  onChange={(e) => {
                    const chosen = companies.find((c) => c.id === e.target.value);
                    if (chosen) setCurrentCompany(chosen);
                  }}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-brand"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
                  width="14"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-2 bg-surface-2/60 rounded-xl border border-border">
                <div className="w-8 h-8 rounded-lg bg-black/40 overflow-hidden flex items-center justify-center shrink-0 border border-border">
                  <ImageWithFallback
                    src={currentCompany?.logo_url}
                    alt={currentCompany?.name}
                    fallbackType="company"
                    name={currentCompany?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-text-primary truncate">{currentCompany?.name}</div>
                  <div className="text-[10px] text-text-muted truncate">{currentCompany?.company_type || 'Production Company'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                activeTab === 'overview'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:widget-2-bold" width="18" />
              <span>Studio Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('films')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
                activeTab === 'films'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon icon="solar:clapperboard-play-bold" width="18" />
                <span>Films & Releases</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${activeTab === 'films' ? 'bg-white/20' : 'bg-surface-2'}`}>
                {companyDetails?.films?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('credits')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                activeTab === 'credits'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:users-group-two-rounded-bold" width="18" />
              <span>Cast & Credits</span>
            </button>

            <button
              onClick={() => setActiveTab('talents')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
                activeTab === 'talents'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon icon="solar:star-bold" width="18" />
                <span>Talent Roster</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${activeTab === 'talents' ? 'bg-white/20' : 'bg-surface-2'}`}>
                {companyDetails?.talents?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                activeTab === 'team'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:shield-user-bold" width="18" />
              <span>Team & Access</span>
            </button>

            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                activeTab === 'api'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:key-square-bold" width="18" />
              <span>API Access</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                activeTab === 'settings'
                  ? 'bg-brand text-white font-bold shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:settings-bold" width="18" />
              <span>Studio Profile</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-border mt-4">
          <Link
            to={`/companies/${currentCompany?.slug || currentCompany?.id}`}
            target="_blank"
            className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 transition text-xs font-semibold text-text-primary"
          >
            <span className="flex items-center gap-2">
              <Icon icon="solar:square-top-down-linear" width="16" />
              Public Studio Page
            </span>
            <Icon icon="solar:arrow-right-up-linear" width="14" className="text-text-muted" />
          </Link>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
              <span>{currentCompany?.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" width="12" /> Verified Studio
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingMovie(null);
                setMovieForm({
                  title: '',
                  year: new Date().getFullYear(),
                  poster_url: '',
                  backdrop_url: '',
                  synopsis: '',
                  trailer_url: '',
                  status: 'in_theaters',
                  release_date: '',
                  box_office_domestic: '',
                  box_office_worldwide: '',
                  box_office_currency: 'NGN',
                  role: 'production',
                });
                setMovieModalOpen(true);
              }}
              className="bg-brand text-white hover:bg-brand/90 font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-brand/20 transition"
            >
              <Icon icon="solar:add-circle-bold" width="16" />
              <span>+ Add New Movie</span>
            </button>
          </div>
        </header>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-6 max-w-7xl w-full space-y-6">
            
            {/* KPI Metrics Cards (Matching Task.Pro design reference) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Filmography Slate</span>
                  <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <Icon icon="solar:film-strip-bold" width="18" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-text-primary">{stats.totalFilms}</div>
                <p className="text-[11px] text-text-muted mt-1">
                  <span className="text-emerald-500 font-bold">{stats.activeTheatrical} Active</span> in Theaters
                </p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Total Box Office</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Icon icon="solar:tag-price-bold" width="18" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-emerald-500">{formatNaira(stats.totalBoxOffice)}</div>
                <p className="text-[11px] text-text-muted mt-1">Reported gross across domestic & world theatrical</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Represented Talent</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Icon icon="solar:star-bold" width="18" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-text-primary">{stats.rosterSize}</div>
                <p className="text-[11px] text-text-muted mt-1">Actors & directors with direct booking access</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Studio Team</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Icon icon="solar:users-group-rounded-bold" width="18" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-text-primary">{stats.teamSize}</div>
                <p className="text-[11px] text-text-muted mt-1">Verified members managing this page</p>
              </div>

            </div>

            {/* Recent Films Slate & Quick Action */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-text-primary">Featured Film Slate</h3>
                  <p className="text-xs text-text-muted">Manage theatrical status, box office earnings, and synopsis</p>
                </div>
                <button
                  onClick={() => setActiveTab('films')}
                  className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                >
                  View All ({companyDetails?.films?.length || 0}) <Icon icon="solar:arrow-right-linear" width="14" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(companyDetails?.films || []).slice(0, 6).map((film) => (
                  <div
                    key={film.id}
                    className="border border-border rounded-xl p-4 bg-surface-2/40 hover:border-brand/40 transition flex gap-3.5 group"
                  >
                    <div className="w-16 h-24 rounded-lg bg-black/60 overflow-hidden shrink-0 border border-border">
                      <ImageWithFallback
                        src={film.poster_url}
                        alt={film.title}
                        fallbackType="film"
                        name={film.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            film.status === 'in_theaters'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : film.status === 'streaming'
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : 'bg-surface text-text-muted border border-border'
                          }`}>
                            {film.status === 'in_theaters' ? 'In Theaters' : film.status === 'streaming' ? 'Streaming' : 'Released'}
                          </span>
                          <span className="text-[10px] text-text-muted">{film.year}</span>
                        </div>
                        <h4 className="text-xs font-bold text-text-primary truncate">{formatFilmTitle(film.title)}</h4>
                        {film.box_office_domestic || film.box_office_worldwide ? (
                          <p className="text-[11px] font-bold text-emerald-500 mt-1">
                            {formatNaira(film.box_office_worldwide || film.box_office_domestic)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                        <button
                          onClick={() => openEditMovieModal(film)}
                          className="text-[10px] font-bold text-text-muted hover:text-brand transition flex items-center gap-1"
                        >
                          <Icon icon="solar:pen-bold" width="12" /> Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFilmForCredits(film);
                            setActiveTab('credits');
                          }}
                          className="text-[10px] font-bold text-text-muted hover:text-brand transition flex items-center gap-1"
                        >
                          <Icon icon="solar:users-group-two-rounded-bold" width="12" /> Cast ({film.credit_count || 'Ensemble'})
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    <Icon icon="solar:user-plus-bold" width="20" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Add Unlisted Actor or Filmmaker</h4>
                    <p className="text-xs text-text-muted">Create a new person in MuviDB and link them to your project</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('credits');
                    setNewPersonModalOpen(true);
                  }}
                  className="w-full bg-surface-2 hover:bg-surface-2/80 border border-border text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  <Icon icon="solar:add-circle-bold" width="16" />
                  Create Person Profile
                </button>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Icon icon="solar:key-square-bold" width="20" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Developer API Credentials</h4>
                    <p className="text-xs text-text-muted">Integrate studio title data into your custom apps and site</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('api')}
                  className="w-full bg-surface-2 hover:bg-surface-2/80 border border-border text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  <Icon icon="solar:eye-bold" width="16" />
                  Manage API Access
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: FILMS & RELEASES */}
        {activeTab === 'films' && (
          <div className="p-6 max-w-7xl w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Company Filmography</h2>
                <p className="text-xs text-text-muted">Directly manage all theatrical releases, streaming titles, and upcoming productions</p>
              </div>
              <button
                onClick={() => {
                  setEditingMovie(null);
                  setMovieForm({
                    title: '',
                    year: new Date().getFullYear(),
                    poster_url: '',
                    backdrop_url: '',
                    synopsis: '',
                    trailer_url: '',
                    status: 'in_theaters',
                    release_date: '',
                    box_office_domestic: '',
                    box_office_worldwide: '',
                    box_office_currency: 'NGN',
                    role: 'production',
                  });
                  setMovieModalOpen(true);
                }}
                className="bg-brand text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition hover:bg-brand/90 shadow-md shadow-brand/20"
              >
                <Icon icon="solar:add-circle-bold" width="16" />
                Add Movie
              </button>
            </div>

            {/* Films Table / Cards */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2/60 text-text-muted uppercase font-bold text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Movie</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Studio Role</th>
                      <th className="py-3 px-4">Box Office</th>
                      <th className="py-3 px-4">Trailer</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(companyDetails?.films || []).map((film) => (
                      <tr key={film.id} className="hover:bg-surface-2/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-14 rounded bg-black/40 overflow-hidden shrink-0 border border-border">
                              <ImageWithFallback
                                src={film.poster_url}
                                alt={film.title}
                                fallbackType="film"
                                name={film.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-text-primary text-sm">{formatFilmTitle(film.title)}</div>
                              <div className="text-[11px] text-text-muted">{film.year || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            film.status === 'in_theaters'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : film.status === 'streaming'
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : 'bg-surface-2 text-text-muted border border-border'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {film.status === 'in_theaters' ? 'In Theaters' : film.status === 'streaming' ? 'Streaming' : 'Released'}
                          </span>
                        </td>
                        <td className="py-3 px-4 capitalize font-medium text-text-secondary">
                          {film.role || 'Production'}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-500">
                          {film.box_office_domestic || film.box_office_worldwide ? formatNaira(film.box_office_worldwide || film.box_office_domestic) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {film.trailer_url ? (
                            <a
                              href={film.trailer_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-red-500 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Icon icon="solar:play-circle-bold" width="16" /> Watch
                            </a>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedFilmForCredits(film);
                                setActiveTab('credits');
                              }}
                              className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80 text-text-muted hover:text-text-primary transition"
                              title="Manage Cast & Credits"
                            >
                              <Icon icon="solar:users-group-two-rounded-bold" width="16" />
                            </button>
                            <button
                              onClick={() => openEditMovieModal(film)}
                              className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80 text-text-muted hover:text-text-primary transition"
                              title="Edit Movie Details"
                            >
                              <Icon icon="solar:pen-bold" width="16" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: CREDITS & ENSEMBLE (Zero Duplicate Actor Guarantee) */}
        {activeTab === 'credits' && (
          <div className="p-6 max-w-7xl w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Cast & Crew Credits Management</h2>
                <p className="text-xs text-text-muted">
                  Guaranteed zero duplicates. Add or update actor roles and characters in-place.
                </p>
              </div>

              {/* Select Film Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Film:</span>
                <select
                  value={selectedFilmForCredits?.id || ''}
                  onChange={(e) => {
                    const f = companyDetails?.films?.find((x) => x.id === e.target.value);
                    if (f) setSelectedFilmForCredits(f);
                  }}
                  className="bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-text-primary focus:outline-none focus:border-brand"
                >
                  {(companyDetails?.films || []).map((film) => (
                    <option key={film.id} value={film.id}>
                      {film.title} ({film.year})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setSelectedPerson(null);
                    setPersonQuery('');
                    setCreditForm({ character_name: '', role: 'Actor', department: 'Cast', billing_order: creditsList.length + 1 });
                    setCreditModalOpen(true);
                  }}
                  className="bg-brand text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow transition hover:bg-brand/90"
                >
                  <Icon icon="solar:user-plus-bold" width="14" />
                  + Add Credit
                </button>

                <button
                  onClick={() => setNewPersonModalOpen(true)}
                  className="bg-surface-2 hover:bg-surface-2/80 border border-border text-text-primary font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition"
                >
                  <Icon icon="solar:user-bold" width="14" />
                  + Create New Person
                </button>
              </div>
            </div>

            {/* Selected Film Header */}
            {selectedFilmForCredits && (
              <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-16 rounded-lg bg-black overflow-hidden shrink-0 border border-border">
                  <ImageWithFallback
                    src={selectedFilmForCredits.poster_url}
                    alt={selectedFilmForCredits.title}
                    fallbackType="film"
                    name={selectedFilmForCredits.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">{formatFilmTitle(selectedFilmForCredits.title)}</h3>
                  <p className="text-xs text-text-muted">
                    {creditsList.length} verified credit records • Status: <span className="text-emerald-500 font-bold">{selectedFilmForCredits.status || 'released'}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Credits List */}
            {loadingCredits ? (
              <div className="py-12 flex justify-center text-xs text-text-muted">
                <Icon icon="solar:restart-linear" className="animate-spin text-brand mr-2" width="18" /> Loading credits...
              </div>
            ) : creditsList.length === 0 ? (
              <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-2 text-text-muted flex items-center justify-center mx-auto mb-3">
                  <Icon icon="solar:users-group-two-rounded-bold" width="24" />
                </div>
                <h4 className="text-sm font-bold text-text-primary mb-1">No credits recorded yet</h4>
                <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
                  Click "+ Add Credit" to search and assign actors or filmmakers to this title.
                </p>
                <button
                  onClick={() => setCreditModalOpen(true)}
                  className="bg-brand text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Add First Credit
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {creditsList.map((cred) => (
                  <div
                    key={cred.id}
                    className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-brand/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-lg bg-black overflow-hidden shrink-0 border border-border">
                        <ImageWithFallback
                          src={cred.people?.photo_url}
                          alt={cred.people?.name}
                          fallbackType="avatar"
                          name={cred.people?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-primary truncate">
                          {formatPersonName(cred.people?.name || 'Unknown')}
                        </div>
                        <div className="text-[11px] text-brand font-semibold truncate">
                          {cred.character_name ? `as ${cred.character_name}` : cred.role || 'Crew'}
                        </div>
                        <div className="text-[10px] text-text-muted">
                          Order: #{cred.billing_order ?? '—'} • {cred.department || 'Cast'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={() => handleDeleteCredit(cred.id)}
                        className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition"
                        title="Remove Credit"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" width="14" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* Tab 4: TALENT ROSTER */}
        {activeTab === 'talents' && (
          <div className="p-6 max-w-7xl w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Represented Talent Roster</h2>
                <p className="text-xs text-text-muted">Manage signed actors, directors, and creators represented by your agency or studio</p>
              </div>
              <button
                onClick={() => {
                  setSelectedPerson(null);
                  setPersonQuery('');
                  setTalentForm({
                    person_id: '',
                    representation_type: 'Theatrical / Film',
                    agent_name: '',
                    contact_email: '',
                    contact_phone: '',
                    booking_url: '',
                  });
                  setTalentModalOpen(true);
                }}
                className="bg-brand text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition hover:bg-brand/90"
              >
                <Icon icon="solar:user-plus-bold" width="16" />
                + Add Talent to Roster
              </button>
            </div>

            {/* Roster Cards */}
            {companyDetails?.talents?.length === 0 ? (
              <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-2 text-text-muted flex items-center justify-center mx-auto mb-3">
                  <Icon icon="solar:star-bold" width="24" />
                </div>
                <h4 className="text-sm font-bold text-text-primary mb-1">No represented talents added</h4>
                <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
                  Showcase the actors and creatives represented by your firm with verified direct booking details.
                </p>
                <button
                  onClick={() => setTalentModalOpen(true)}
                  className="bg-brand text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Add First Talent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(companyDetails?.talents || []).map((rep) => (
                  <div key={rep.id} className="bg-surface border border-border rounded-2xl p-4 flex gap-3.5 relative group">
                    <div className="w-16 h-20 rounded-xl bg-black overflow-hidden shrink-0 border border-border">
                      <ImageWithFallback
                        src={rep.people?.photo_url}
                        alt={rep.people?.name}
                        fallbackType="avatar"
                        name={rep.people?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-text-primary truncate">{formatPersonName(rep.people?.name)}</h4>
                      <p className="text-[11px] text-brand font-semibold">{rep.representation_type || 'Theatrical'}</p>
                      {rep.agent_name && (
                        <p className="text-[11px] text-text-muted mt-1">Rep Agent: {rep.agent_name}</p>
                      )}
                      {rep.contact_email && (
                        <p className="text-[10px] text-text-muted truncate mt-0.5">{rep.contact_email}</p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Remove from represented roster?')) return;
                        await deleteTalentRepresentation(rep.id);
                        toast.success('Talent removed');
                        setRefreshTrigger((p) => p + 1);
                      }}
                      className="absolute top-3 right-3 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" width="16" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: TEAM & MEMBERS */}
        {activeTab === 'team' && (
          <div className="p-6 max-w-7xl w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Studio Team & Role Permissions</h2>
                <p className="text-xs text-text-muted">Manage colleagues who have write access to update titles, box office, and credits</p>
              </div>
              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-brand text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition hover:bg-brand/90"
              >
                <Icon icon="solar:user-plus-bold" width="16" />
                Invite Team Member
              </button>
            </div>

            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2/60 text-text-muted uppercase font-bold text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(companyDetails?.members || []).map((m) => (
                    <tr key={m.id} className="hover:bg-surface-2/40 transition">
                      <td className="py-3 px-4 font-semibold text-text-primary">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                            {m.email ? m.email[0].toUpperCase() : 'U'}
                          </div>
                          <span>{m.email || user?.email || 'studio-executive@company.com'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded bg-surface-2 font-bold text-[10px]">
                          {m.role || 'Admin'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-500 font-semibold flex items-center gap-1">
                        <Icon icon="solar:check-circle-bold" width="14" /> Active
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted">
                        <span className="text-[10px]">Owner</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: API ACCESS & KEYS (RealEstate Pro Aesthetic) */}
        {activeTab === 'api' && (
          <div className="p-6 max-w-4xl w-full space-y-6">
            <div>
              <h2 className="text-lg font-bold text-text-primary">API Access & Developer Keys</h2>
              <p className="text-xs text-text-muted">
                Use your official studio API credentials to automate filmography updates, fetch live box office figures, and sync with your internal CMS.
              </p>
            </div>

            {/* Connected API Box matching Reference Image */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Live Production Key</h4>
                  <p className="text-xs text-text-muted">Grants programmatic read & write access to {currentCompany?.name}'s slate</p>
                </div>
                <button
                  onClick={() => {
                    const randomSuffix = Math.random().toString(36).substring(2, 10);
                    setApiKey(`mvd_live_${randomSuffix}`);
                    toast.success('Generated new API key');
                  }}
                  className="text-xs font-bold text-emerald-500 hover:underline"
                >
                  Regenerate
                </button>
              </div>

              {/* Credential Box */}
              <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl p-2 pl-3">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="bg-transparent text-xs font-mono text-text-primary flex-1 outline-none"
                />
                <button
                  onClick={handleCopyKey}
                  className="bg-surface hover:bg-surface-2 border border-border text-text-primary font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1"
                >
                  <Icon icon={keyCopied ? 'solar:check-circle-bold' : 'solar:copy-bold'} width="14" className={keyCopied ? 'text-emerald-500' : ''} />
                  <span>{keyCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 text-xs">
                <Link to="/developers" target="_blank" className="text-brand font-semibold hover:underline flex items-center gap-1">
                  View API Documentation <Icon icon="solar:arrow-right-up-linear" width="14" />
                </Link>
                <span className="text-text-muted text-[11px]">
                  Rate Limit: {currentCompany?.api_tier === 'pro' ? '100,000 req/day (Studio Pro)' : '10,000 req/day (Free Tier)'}
                </span>
              </div>
            </div>

            {/* OPay Merchant Checkout Card / Active Pro Status */}
            {currentCompany?.api_tier === 'pro' ? (
              <div className="bg-gradient-to-br from-surface to-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-lg">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                      <Icon icon="solar:verified-check-bold" width="12" /> Studio Pro Active
                    </div>
                    <h3 className="text-lg font-bold text-text-primary">Studio Pro Plan Activated</h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Your studio has unlocked 100,000 requests/day, live automated box office data webhooks, dedicated tech support, and instant catalog indexing.
                    </p>
                    <div className="flex items-center gap-4 pt-1 text-xs">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Icon icon="solar:shield-check-bold" width="14" /> Verified by OPay Merchant Gateway
                      </span>
                      <span className="text-text-muted">Auto-renews monthly</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <div className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs flex items-center justify-center gap-2">
                      <Icon icon="solar:check-circle-bold" width="16" />
                      <span>Pro Status Enabled</span>
                    </div>
                    <p className="text-[10px] text-center text-text-muted">
                      Merchant ID: 256626100609333
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-surface to-surface-2 border border-emerald-500/30 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-lg">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-wider">
                      <Icon icon="solar:shield-check-bold" width="12" /> OPay Merchant Checkout
                    </div>
                    <h3 className="text-lg font-bold text-text-primary">Upgrade to Studio Pro API Plan</h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Unlock 100,000 requests/day, live automated box office data webhooks, dedicated tech support, and instant catalog indexing.
                    </p>
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-2xl font-black text-text-primary">₦25,000</span>
                      <span className="text-xs text-text-muted font-semibold">/ month</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpayCheckout(25000, 'pro_monthly')}
                      disabled={checkingOutOpay}
                      className="bg-[#00B875] hover:bg-[#009E64] text-white font-extrabold px-6 py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-[#00B875]/25 disabled:opacity-50 cursor-pointer"
                    >
                      {checkingOutOpay ? (
                        <>
                          <Icon icon="solar:restart-linear" className="animate-spin" width="16" />
                          <span>Connecting to OPay...</span>
                        </>
                      ) : (
                        <>
                          <Icon icon="solar:card-2-bold" width="16" />
                          <span>Pay with OPay (Card / Transfer / App)</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-center text-text-muted">
                      Secured by OPay Central Payment Gateway
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Connected Apps / Integrations Showcase */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-text-primary mb-3">Sync & Webhooks</h4>
              <p className="text-xs text-text-muted mb-4">
                Automatically push new trailer releases, theatrical updates, and box office milestones to external platforms.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-surface-2/60 border border-border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="logos:youtube-icon" width="20" />
                    <span className="font-semibold text-text-primary">YouTube Trailers Sync</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
                </div>

                <div className="p-3.5 bg-surface-2/60 border border-border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon icon="solar:bell-bold" className="text-brand" width="20" />
                    <span className="font-semibold text-text-primary">Box Office Webhook</span>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted bg-surface px-2 py-0.5 rounded border border-border">Configured</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 7: STUDIO SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-6 max-w-4xl w-full space-y-6">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Studio Brand & Profile Settings</h2>
              <p className="text-xs text-text-muted">Update your official bio, logo, headquarters, and public contact information</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Company Name</label>
                  <input
                    type="text"
                    defaultValue={currentCompany?.name}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Headquarters</label>
                  <input
                    type="text"
                    defaultValue={currentCompany?.headquarters || 'Lagos, Nigeria'}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Official Website</label>
                <input
                  type="url"
                  defaultValue={currentCompany?.website}
                  placeholder="https://companywebsite.com"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">About / Studio Overview</label>
                <textarea
                  rows={3}
                  defaultValue={currentCompany?.description}
                  className="w-full bg-surface-2 border border-border rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => toast.success('Studio profile updated')}
                  className="bg-brand text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-brand/20 hover:bg-brand/90 transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── MODAL: ADD / EDIT MOVIE ── */}
      {movieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="text-base font-bold text-text-primary">
                {editingMovie ? `Edit Movie: ${editingMovie.title}` : 'Add New Movie to Studio Slate'}
              </h3>
              <button onClick={() => setMovieModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            <form onSubmit={handleSaveMovie} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Movie Title *</label>
                  <input
                    type="text"
                    required
                    value={movieForm.title}
                    onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                    placeholder="e.g. The Wedding Party"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Release Year *</label>
                  <input
                    type="number"
                    required
                    value={movieForm.year}
                    onChange={(e) => setMovieForm({ ...movieForm, year: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Theatrical / Release Status</label>
                  <select
                    value={movieForm.status}
                    onChange={(e) => setMovieForm({ ...movieForm, status: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  >
                    <option value="in_theaters">Now In Theaters</option>
                    <option value="streaming">Streaming Now</option>
                    <option value="released">Released</option>
                    <option value="in_production">In Production</option>
                    <option value="upcoming">Coming Soon</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Studio Role</label>
                  <select
                    value={movieForm.role}
                    onChange={(e) => setMovieForm({ ...movieForm, role: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  >
                    <option value="production">Lead Production Company</option>
                    <option value="distribution">Theatrical Distributor</option>
                    <option value="co-production">Co-Production</option>
                  </select>
                </div>
              </div>

              {/* Box office */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Domestic Box Office (NGN)</label>
                  <input
                    type="number"
                    value={movieForm.box_office_domestic}
                    onChange={(e) => setMovieForm({ ...movieForm, box_office_domestic: e.target.value })}
                    placeholder="e.g. 450000000"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Worldwide Gross (NGN)</label>
                  <input
                    type="number"
                    value={movieForm.box_office_worldwide}
                    onChange={(e) => setMovieForm({ ...movieForm, box_office_worldwide: e.target.value })}
                    placeholder="e.g. 520000000"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* URLs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Poster Image URL</label>
                  <input
                    type="url"
                    value={movieForm.poster_url}
                    onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Trailer Video URL</label>
                  <input
                    type="url"
                    value={movieForm.trailer_url}
                    onChange={(e) => setMovieForm({ ...movieForm, trailer_url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Synopsis</label>
                <textarea
                  rows={3}
                  value={movieForm.synopsis}
                  onChange={(e) => setMovieForm({ ...movieForm, synopsis: e.target.value })}
                  placeholder="Official movie synopsis or plot summary..."
                  className="w-full bg-surface-2 border border-border rounded-xl p-2.5 text-text-primary focus:border-brand focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setMovieModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 text-text-muted hover:text-text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMovie}
                  className="px-5 py-2 rounded-xl bg-brand text-white font-bold hover:bg-brand/90 transition shadow-md shadow-brand/20 flex items-center gap-1.5"
                >
                  {savingMovie ? <Icon icon="solar:restart-linear" className="animate-spin" width="16" /> : null}
                  Save Movie to Slate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT CREDIT (Zero Duplicate Guarantee) ── */}
      {creditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="text-sm font-bold text-text-primary">Add Cast / Crew Member</h3>
              <button onClick={() => setCreditModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-bold" width="18" />
              </button>
            </div>

            <form onSubmit={handleSaveCredit} className="space-y-4 text-xs">
              {/* Person Search */}
              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Search Actor or Crew *</label>
                {selectedPerson ? (
                  <div className="flex items-center justify-between p-2.5 bg-surface-2 border border-brand/40 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-black overflow-hidden shrink-0">
                        <ImageWithFallback src={selectedPerson.photo_url} alt={selectedPerson.name} fallbackType="avatar" name={selectedPerson.name} />
                      </div>
                      <span className="font-bold text-text-primary">{selectedPerson.name}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedPerson(null)} className="text-[10px] text-brand font-bold">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={personQuery}
                      onChange={(e) => setPersonQuery(e.target.value)}
                      placeholder="Type actor name (e.g. Richard Mofe-Damijo, Genevieve)..."
                      className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                    />
                    {personResults.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-border">
                        {personResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPerson(p);
                              setPersonResults([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-surface-2 flex items-center gap-2.5 transition"
                          >
                            <div className="w-7 h-7 rounded-full bg-black overflow-hidden shrink-0">
                              <ImageWithFallback src={p.photo_url} alt={p.name} fallbackType="avatar" name={p.name} />
                            </div>
                            <span className="font-bold text-text-primary">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Character Name (for Cast)</label>
                <input
                  type="text"
                  value={creditForm.character_name}
                  onChange={(e) => setCreditForm({ ...creditForm, character_name: e.target.value })}
                  placeholder="e.g. Chief Onwuka"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Role Type</label>
                  <input
                    type="text"
                    value={creditForm.role}
                    onChange={(e) => setCreditForm({ ...creditForm, role: e.target.value })}
                    placeholder="Actor, Director, Writer"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Billing Order (#)</label>
                  <input
                    type="number"
                    value={creditForm.billing_order}
                    onChange={(e) => setCreditForm({ ...creditForm, billing_order: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 text-text-muted font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCredit || !selectedPerson}
                  className="px-5 py-2 rounded-xl bg-brand text-white font-bold hover:bg-brand/90 transition shadow-md shadow-brand/20 disabled:opacity-50"
                >
                  {savingCredit ? 'Saving...' : 'Add Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE NEW PERSON ON THE FLY ── */}
      {newPersonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="text-sm font-bold text-text-primary">Create New Actor / Filmmaker Profile</h3>
              <button onClick={() => setNewPersonModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-bold" width="18" />
              </button>
            </div>

            <form onSubmit={handleCreateNewPersonAndCredit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Full Legal / Stage Name *</label>
                <input
                  type="text"
                  required
                  value={newPersonForm.name}
                  onChange={(e) => setNewPersonForm({ ...newPersonForm, name: e.target.value })}
                  placeholder="e.g. Gabriel Afolayan"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Primary Role</label>
                  <select
                    value={newPersonForm.primary_role}
                    onChange={(e) => setNewPersonForm({ ...newPersonForm, primary_role: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  >
                    <option value="Actor">Actor</option>
                    <option value="Director">Director</option>
                    <option value="Writer">Writer</option>
                    <option value="Producer">Producer</option>
                    <option value="Cinematographer">Cinematographer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={newPersonForm.birth_date}
                    onChange={(e) => setNewPersonForm({ ...newPersonForm, birth_date: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Headshot Photo URL</label>
                <input
                  type="url"
                  value={newPersonForm.photo_url}
                  onChange={(e) => setNewPersonForm({ ...newPersonForm, photo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Mini Biography</label>
                <textarea
                  rows={2}
                  value={newPersonForm.bio}
                  onChange={(e) => setNewPersonForm({ ...newPersonForm, bio: e.target.value })}
                  placeholder="Short bio or background..."
                  className="w-full bg-surface-2 border border-border rounded-xl p-2.5 text-text-primary focus:border-brand focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setNewPersonModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 text-text-muted font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCredit}
                  className="px-5 py-2 rounded-xl bg-brand text-white font-bold hover:bg-brand/90 transition shadow-md shadow-brand/20"
                >
                  Create & Link to Film
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TALENT ROSTER ── */}
      {talentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="text-sm font-bold text-text-primary">Add Talent to Agency Roster</h3>
              <button onClick={() => setTalentModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-bold" width="18" />
              </button>
            </div>

            <form onSubmit={handleSaveTalentRep} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Search Talent *</label>
                {selectedPerson ? (
                  <div className="flex items-center justify-between p-2.5 bg-surface-2 border border-brand/40 rounded-xl">
                    <span className="font-bold text-text-primary">{selectedPerson.name}</span>
                    <button type="button" onClick={() => setSelectedPerson(null)} className="text-[10px] text-brand font-bold">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={personQuery}
                      onChange={(e) => setPersonQuery(e.target.value)}
                      placeholder="Type person name..."
                      className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                    />
                    {personResults.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-border">
                        {personResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPerson(p);
                              setPersonResults([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-surface-2 flex items-center gap-2.5 transition"
                          >
                            <span className="font-bold text-text-primary">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Representation Type</label>
                <select
                  value={talentForm.representation_type}
                  onChange={(e) => setTalentForm({ ...talentForm, representation_type: e.target.value })}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                >
                  <option value="Theatrical / Film">Theatrical / Film</option>
                  <option value="Commercial & Brand">Commercial & Brand</option>
                  <option value="Voiceover">Voiceover</option>
                  <option value="Literary / Screenwriting">Literary / Screenwriting</option>
                  <option value="All-Inclusive Representation">All-Inclusive Representation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Rep Agent Name</label>
                  <input
                    type="text"
                    value={talentForm.agent_name}
                    onChange={(e) => setTalentForm({ ...talentForm, agent_name: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Booking Phone</label>
                  <input
                    type="tel"
                    value={talentForm.contact_phone}
                    onChange={(e) => setTalentForm({ ...talentForm, contact_phone: e.target.value })}
                    placeholder="+234..."
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Booking Email</label>
                <input
                  type="email"
                  value={talentForm.contact_email}
                  onChange={(e) => setTalentForm({ ...talentForm, contact_email: e.target.value })}
                  placeholder="bookings@agency.com"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setTalentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 text-text-muted font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedPerson}
                  className="px-5 py-2 rounded-xl bg-brand text-white font-bold hover:bg-brand/90 transition shadow-md shadow-brand/20 disabled:opacity-50"
                >
                  Add to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: OPAY HOSTED CASHIER SIMULATION ── */}
      {opayModalData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-[#00B875]/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative">
            
            {/* OPay Branded Header */}
            <div className="bg-[#00B875] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
                  <Icon icon="solar:card-2-bold" width="22" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">OPay Central Cashier</h3>
                  <p className="text-[10px] text-white/80 font-medium flex items-center gap-1">
                    <Icon icon="solar:shield-check-bold" width="12" /> Official Merchant Checkout
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpayModalData(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              
              {/* Order Info & Amount Card */}
              <div className="bg-surface-2/80 border border-border rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Merchant Order</span>
                  <span className="font-bold text-text-primary text-xs truncate max-w-[180px] block">
                    {currentCompany?.name || 'MuviDB Studio Pro'}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {opayModalData.reference}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Total Amount</span>
                  <span className="text-xl font-black text-[#00B875]">₦25,000</span>
                  <span className="text-[9px] text-text-muted block">NGN</span>
                </div>
              </div>

              {/* Payment Channel Selector */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  Choose Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOpayMethod('card')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedOpayMethod === 'card'
                        ? 'border-[#00B875] bg-[#00B875]/10 text-text-primary font-bold shadow-sm'
                        : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:card-bold" width="18" className={selectedOpayMethod === 'card' ? 'text-[#00B875]' : ''} />
                    <span className="text-[11px]">Bank Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOpayMethod('wallet')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedOpayMethod === 'wallet'
                        ? 'border-[#00B875] bg-[#00B875]/10 text-text-primary font-bold shadow-sm'
                        : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:smartphone-2-bold" width="18" className={selectedOpayMethod === 'wallet' ? 'text-[#00B875]' : ''} />
                    <span className="text-[11px]">OPay Wallet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOpayMethod('transfer')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedOpayMethod === 'transfer'
                        ? 'border-[#00B875] bg-[#00B875]/10 text-text-primary font-bold shadow-sm'
                        : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:bank-bold" width="18" className={selectedOpayMethod === 'transfer' ? 'text-[#00B875]' : ''} />
                    <span className="text-[11px]">Transfer</span>
                  </button>
                </div>
              </div>

              {/* Method Details simulation */}
              {selectedOpayMethod === 'card' && (
                <div className="p-3.5 bg-surface-2 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>Card Number</span>
                    <span className="text-[10px] text-emerald-500 font-bold">Mastercard / Visa / Verve</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-text-primary tracking-widest bg-surface p-2 rounded-lg border border-border">
                    5399 •••• •••• 8910
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-surface p-2 rounded-lg border border-border font-mono text-[11px] text-text-muted">
                      EXP: 12/28
                    </div>
                    <div className="w-16 bg-surface p-2 rounded-lg border border-border font-mono text-[11px] text-text-muted text-center">
                      CVV: •••
                    </div>
                  </div>
                </div>
              )}

              {selectedOpayMethod === 'wallet' && (
                <div className="p-3.5 bg-surface-2 border border-border rounded-xl space-y-1.5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#00B875]/15 text-[#00B875] flex items-center justify-center mx-auto mb-1">
                    <Icon icon="solar:qr-code-bold" width="24" />
                  </div>
                  <p className="font-bold text-text-primary text-xs">OPay Express One-Click</p>
                  <p className="text-[11px] text-text-muted">
                    Debit your registered OPay account: <span className="font-mono font-bold text-text-primary">256626100609333</span>
                  </p>
                </div>
              )}

              {selectedOpayMethod === 'transfer' && (
                <div className="p-3.5 bg-surface-2 border border-border rounded-xl space-y-1 text-center">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Dynamic Virtual Account</p>
                  <p className="font-mono text-base font-black text-text-primary tracking-wider">9028 411 902</p>
                  <p className="text-[11px] text-[#00B875] font-bold">OPay Digital Services Limited</p>
                </div>
              )}

              {/* Merchant Security Badge */}
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-[11px] text-emerald-400">
                <Icon icon="solar:shield-check-bold" width="16" className="shrink-0" />
                <span>OPay Test Sandbox: Click Authorize to test live plan activation and elevate your company's API access limits instantly.</span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpayModalData(null)}
                  disabled={confirmingOpayPayment}
                  className="w-1/3 py-3 rounded-xl bg-surface-2 border border-border text-text-muted hover:text-text-primary font-bold transition text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmMockOpay}
                  disabled={confirmingOpayPayment}
                  className="w-2/3 py-3 rounded-xl bg-[#00B875] hover:bg-[#009E64] text-white font-extrabold transition text-xs shadow-lg shadow-[#00B875]/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {confirmingOpayPayment ? (
                    <>
                      <Icon icon="solar:restart-linear" className="animate-spin" width="16" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:lock-keyhole-bold" width="14" />
                      <span>Authorize & Pay ₦25,000</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-text-muted">
                Merchant ID: 256626100609333 • PCI DSS Level 1 Certified
              </p>

            </div>

          </div>
        </div>
      )}

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="text-sm font-bold text-text-primary">Invite Team Member</h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-bold" width="18" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Colleague Work Email *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-text-muted uppercase tracking-wider mb-1">Access Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand focus:outline-none"
                >
                  <option value="editor">Editor (Can edit movies, credits, and talents)</option>
                  <option value="admin">Admin (Can manage team, keys, and movies)</option>
                  <option value="owner">Owner (Full administrative authority)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 text-text-muted font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!inviteEmail.trim()) {
                      toast.error('Please enter an email');
                      return;
                    }
                    toast.success(`Invitation sent to ${inviteEmail}!`);
                    setInviteModalOpen(false);
                    setInviteEmail('');
                  }}
                  className="px-5 py-2 rounded-xl bg-brand text-white font-bold hover:bg-brand/90 transition shadow-md shadow-brand/20"
                >
                  Send Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
