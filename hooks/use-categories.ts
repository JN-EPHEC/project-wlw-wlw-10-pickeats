import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type CategoryEntry = {
  id: string;
  name: string;
  key: string;
  imageUrl?: string;
};

const DEFAULT_CATEGORIES: CategoryEntry[] = [
  { id: 'default-sandwich-chaud', name: 'Sandwichs chauds', key: 'sandwich-chaud' },
  { id: 'default-sandwich-froid', name: 'Sandwichs froids', key: 'sandwich-froid' },
  { id: 'default-pasta', name: 'Pâtes', key: 'pasta' },
  { id: 'default-salade', name: 'Salades', key: 'salade' },
  { id: 'default-snack', name: 'Snacks', key: 'snack' },
  { id: 'default-drink', name: 'Boissons', key: 'drink' },
];

export function useCategories(refreshKey: number = 0) {
  const [categories, setCategories] = useState<CategoryEntry[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(
          query(collection(db, 'categories'), orderBy('name', 'asc')),
        );
        if (cancelled) return;
        const fetched: CategoryEntry[] = snapshot.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? '',
            key: data.key ?? '',
            imageUrl: data.imageUrl ?? undefined,
          };
        });
        if (fetched.length > 0) {
          setCategories(fetched);
          setUsingFallback(false);
        } else {
          setCategories(DEFAULT_CATEGORIES);
          setUsingFallback(true);
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
        if (!cancelled) {
          setCategories(DEFAULT_CATEGORIES);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { categories, loading, usingFallback };
}
