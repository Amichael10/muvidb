import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import { Icon } from '@iconify/react';

export default function Onboarding() {
  const role = 'fan'; // Only fan accounts are offered
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "MuviDB | Complete Your Profile";
    if (user?.onboarded) {
      navigate('/dashboard');
    }
    if (user?.name) setName(user.name);
  }, [user, navigate]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // In a real app, we'd upload the avatar to Supabase Storage here
      // For now, we update the metadata
      await updateUserProfile({
        name: name || user.email.split('@')[0],
        role: role,
        onboarded: true,
        // avatar_url: preview // This would be the storage URL normally
      });
      
      navigate('/dashboard');
    } catch (err) {
      console.error('Onboarding failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-10 space-y-2">
        <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tighter uppercase italic leading-none">
          Complete <span className="text-brand">Profile</span>
        </h2>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-60">
          Personalize your MuviDB experience
        </p>
      </div>

      <form onSubmit={handleComplete} className="space-y-8">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-border group-hover:border-brand transition-all bg-surface-2 flex items-center justify-center">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Icon icon="solar:user-circle-linear" className="text-6xl text-text-muted opacity-40" />
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Upload</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest opacity-40">
            Profile Image (Optional)
          </p>
        </div>

        {/* Display Name */}
        <div className="space-y-8">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="your name"
              className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-[11px] font-bold tracking-widest focus:border-brand focus:outline-none transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand text-white text-[11px] font-black uppercase tracking-widest py-5 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand/20 disabled:opacity-50"
        >
          {isLoading ? 'SYNCING PROFILE...' : 'START YOUR JOURNEY'}
        </button>
      </form>
    </AuthLayout>
  );
}
