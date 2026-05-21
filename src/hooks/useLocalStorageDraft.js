import { useEffect, useRef } from 'react';

export function useLocalStorageDraft(key, data, isEnabled = true) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isEnabled || !key) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.error("Failed to save draft to local storage", err);
      }
    }, 1000); // 1 second debounce

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, data, isEnabled]);

  const clearDraft = () => {
    if (key) {
      localStorage.removeItem(key);
    }
  };

  const getDraft = () => {
    if (!key) return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (err) {
      return null;
    }
  };

  return { clearDraft, getDraft };
}
