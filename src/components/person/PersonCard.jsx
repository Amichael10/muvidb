import { Link } from 'react-router-dom';

export default function PersonCard({ person, variant = 'compact', isLoading }) {
  if (isLoading) {
    if (variant === 'compact') {
      return (
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface-2 animate-shimmer mb-3 border border-border"></div>
          <div className="w-16 h-4 bg-surface-2 animate-shimmer rounded-md mb-1"></div>
          <div className="w-12 h-3 bg-surface-2 animate-shimmer rounded-md opacity-50"></div>
        </div>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center w-full">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg bg-surface-2 animate-shimmer shrink-0 border border-border shadow-sm"></div>
        <div className="flex-1 w-full space-y-4">
          <div className="w-1/3 h-8 bg-surface-2 animate-shimmer rounded-lg"></div>
          <div className="w-1/4 h-4 bg-surface-2 animate-shimmer rounded-md"></div>
          <div className="w-full h-12 bg-surface-2 animate-shimmer rounded-md"></div>
          <div className="flex gap-6">
            <div className="w-16 h-8 bg-surface-2 animate-shimmer rounded-md"></div>
            <div className="w-16 h-8 bg-surface-2 animate-shimmer rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!person) return null;

  // Format popularity (e.g., 12400000 -> 12.4M)
  const formatPopularity = (pop) => {
    if (pop >= 1000000) {
      return (pop / 1000000).toFixed(1) + 'M';
    }
    return pop;
  };

  if (variant === 'compact') {
    return (
      <Link 
        to={`/people/${person.id}`}
        className="flex flex-col items-center text-center group"
      >
        <div className="relative mb-3">
          <img 
            src={person.photo_url || person.photo} 
            alt={person.name} 
            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-transparent group-hover:border-gold transition-colors duration-300"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface-2 border border-border text-text-primary text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            {person.film_count} Films
          </div>
        </div>
        <h4 className="font-bold text-text-primary text-sm md:text-base group-hover:text-gold transition-colors line-clamp-1">
          {person.name}
        </h4>
        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
          {person.role}
        </p>
      </Link>
    );
  }

  // Full variant
  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
      <Link to={`/person/${person.id}`} className="shrink-0 group">
        <img 
          src={person.photo_url || person.photo} 
          alt={person.name} 
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg object-cover border-2 border-transparent group-hover:border-gold transition-colors duration-300"
        />
      </Link>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Link to={`/person/${person.id}`}>
            <h3 className="font-heading font-bold text-2xl text-text-primary hover:text-gold transition-colors">
              {person.name}
            </h3>
          </Link>
          {person.is_verified && (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="var(--color-gold)" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          )}
        </div>
        
        <p className="text-gold font-medium text-sm mb-3">
          {person.role}
        </p>
        
        <p className="text-text-muted text-sm line-clamp-2 mb-4 max-w-xl">
          {person.bio}
        </p>
        
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-text-primary font-bold">{formatPopularity(person.popularity_score || person.popularity)}</span>
            <span className="text-text-muted text-xs uppercase tracking-wider">Views</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex flex-col">
            <span className="text-text-primary font-bold">{person.film_count}</span>
            <span className="text-text-muted text-xs uppercase tracking-wider">Films</span>
          </div>
          
          <button className="ml-auto sm:ml-6 bg-transparent border border-gold text-gold hover:bg-gold hover:text-bg px-6 py-2 rounded-full font-medium transition-all duration-300 active:scale-95 text-sm min-h-[44px]">
            Follow
          </button>
        </div>
      </div>
    </div>
  );
}
