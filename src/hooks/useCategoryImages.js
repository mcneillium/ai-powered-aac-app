// src/hooks/useCategoryImages.js
import { useState, useEffect } from 'react';
import { searchPictograms } from '../services/arasaacService';

const CATEGORIES = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];

/**
 * Loads a representative pictogram image for each category.
 * @returns {{ categories: string[], categoryImages: Object }}
 */
export function useCategoryImages() {
  const [categoryImages, setCategoryImages] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reps = {};
      for (const cat of CATEGORIES) {
        try {
          const data = await searchPictograms('en', cat);
          if (data?.length) reps[cat] = data[0];
        } catch (e) {
          console.warn(`Failed to load pictogram for category "${cat}":`, e.message);
        }
      }
      if (!cancelled) setCategoryImages(reps);
    })();
    return () => { cancelled = true; };
  }, []);

  return { categories: CATEGORIES, categoryImages };
}
