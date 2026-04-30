import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const COUNTRIES = [
  { name: 'Nigeria', image: '/images/countries/nigeria.png' },
  { name: 'Senegal', image: '/images/countries/senegal.png' },
  { name: 'Algeria', image: '/images/countries/algeria.png' },
  { name: 'Cameroon', image: '/images/countries/cameroon.png' },
];

export default function CountryRail() {
  return (
    <section className="py-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <h2 className="font-heading font-bold text-2xl text-text-primary tracking-tighter">
          Browse by Country
        </h2>
        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
          Explore cinema across the continent
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4 sm:px-6 lg:px-8 pb-4 max-w-7xl mx-auto">
        {COUNTRIES.map((country, i) => (
          <motion.div
            key={country.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
          >
            <Link
              to={`/browse?country=${country.name}`}
              className="group relative flex flex-col w-full aspect-[3/4] sm:aspect-auto sm:h-96 rounded-2xl overflow-hidden border border-border shadow-sm hover:border-brand/40 transition-all duration-500"
            >
              <img 
                src={country.image} 
                alt={country.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              
              <div className="absolute bottom-0 left-0 p-6 sm:p-8 w-full">
                <h3 className="text-white font-heading font-bold text-2xl sm:text-3xl tracking-tight mb-1">
                  {country.name}
                </h3>
                <span className="text-brand text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                  Explore Films
                  <span className="text-lg">→</span>
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
