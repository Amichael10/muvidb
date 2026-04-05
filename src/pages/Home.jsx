import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import PersonCard from '../components/person/PersonCard';
import { people, genres } from '../data/mockData';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [films, setFilms] = useState([]);
  const spotlightPerson = people[0];
  const otherPeople = people.slice(1, 4);

  useEffect(() => {
    document.title = "FilmDba | Home";
    fetchFilms();
  }, []);

  const fetchFilms = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('films')
        .select('*');
        
      if (error) throw error;
      setFilms(data || []);
    } catch (error) {
      console.error('Error fetching films:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full pb-20">
      <HeroSection featuredFilm={films.length > 0 ? films[0] : null} />
      
      <div className="mt-8 space-y-4">
        <FilmRow 
          title="Trending This Week" 
          films={films} 
          sortKey="views" 
          isLoading={isLoading}
        />
        
        {/* Filmmaker Spotlight Section */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary">
                Filmmaker Spotlight
              </h2>
              <Link 
                to="/browse?type=filmmakers" 
                className="text-gold hover:text-text-primary transition-all duration-300 active:scale-95 font-medium text-sm md:text-base flex items-center gap-1"
              >
                View All Filmmakers
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>

            <div className="relative bg-surface rounded-2xl p-6 md:p-8 overflow-hidden border border-border">
              {/* Subtle terracotta gradient background */}
              <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-terracotta/10 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-center justify-between">
                {/* Full PersonCard */}
                <div className="lg:w-3/5">
                  <PersonCard person={spotlightPerson} variant="full" />
                </div>
                
                {/* Divider for desktop */}
                <div className="hidden lg:block w-px h-32 bg-border"></div>
                
                {/* Divider for mobile */}
                <div className="lg:hidden w-full h-px bg-border"></div>

                {/* Mini Grid of Compact PersonCards */}
                <div className="lg:w-1/3 flex justify-around lg:justify-end gap-4 sm:gap-8">
                  {otherPeople.map(person => (
                    <PersonCard key={person.id} person={person} variant="compact" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <FilmRow 
          title="New Releases" 
          films={films} 
          sortKey="year" 
          isLoading={isLoading}
        />
        
        {/* Browse by Genre Section */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary mb-6">
              Browse by Genre
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {genres.map((genre, index) => {
                // Generate a fake count based on index for variety
                const fakeCount = 120 + (index * 45) - (index % 3 * 20);
                
                return (
                  <Link 
                    key={genre}
                    to={`/browse?genre=${genre}`}
                    className="group bg-surface hover:bg-surface-2 border border-border hover:border-gold rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(212,160,23,0.15)] active:scale-95"
                  >
                    <h3 className="font-heading font-bold text-lg text-text-primary group-hover:text-gold transition-colors mb-2">
                      {genre}
                    </h3>
                    <p className="text-sm text-text-muted">
                      {fakeCount} Films
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <FilmRow 
          title="Top Rated" 
          films={films} 
          sortKey="rating" 
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
