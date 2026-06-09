import React, { createContext, useContext, useState, useCallback } from 'react';

const QuickViewContext = createContext();

export function QuickViewProvider({ children }) {
  const [selectedFilm, setSelectedFilm] = useState(null);

  const openQuickView = useCallback((film) => {
    setSelectedFilm(film);
  }, []);

  const closeQuickView = useCallback(() => {
    setSelectedFilm(null);
  }, []);

  return (
    <QuickViewContext.Provider value={{ selectedFilm, openQuickView, closeQuickView }}>
      {children}
    </QuickViewContext.Provider>
  );
}

export function useQuickView() {
  const context = useContext(QuickViewContext);
  if (!context) {
    throw new Error('useQuickView must be used within a QuickViewProvider');
  }
  return context;
}
