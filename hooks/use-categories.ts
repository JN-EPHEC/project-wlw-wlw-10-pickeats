import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type CategoryEntry = {
  id: string;
  name: string;
  key: string;
  imageUrl?: string;
  isFallback?: boolean;
};

export const DEFAULT_CATEGORIES: CategoryEntry[] = [
  { id: 'default-sandwich-chaud', name: 'Sandwichs chauds', key: 'sandwich-chaud', isFallback: true },
  { id: 'default-sandwich-froid', name: 'Sandwichs froids', key: 'sandwich-froid', isFallback: true },
  { id: 'default-pasta', name: 'Pâtes', key: 'pasta', isFallback: true },
  { id: 'default-salade', name: 'Salades', key: 'salade', isFallback: true },
  { id: 'default-snack', name: 'Snacks', key: 'snack', isFallback: true },
  { id: 'default-drink', name: 'Boissons', key: 'drink', isFallback: true },
];

type FirestoreDoc = {
  id: string;
  name?: string;
  key?: string;
  imageUrl?: string;
  deleted?: boolean;
};

const mergeCategories = (firestoreDocs: FirestoreDoc[]): CategoryEntry[] => {
  const byKey = new Map<string, FirestoreDoc>();
  for (const doc of firestoreDocs) {
    if (doc.key) byKey.set(doc.key, doc);
  }

  const result: CategoryEntry[] = [];

  // 1) defaults qui ne sont pas tombstoned ET pas overridés
  for (const def of DEFAULT_CATEGORIES) {
    const fsDoc = byKey.get(def.key);
    if (!fsDoc) {
      result.push(def);
      continue;
    }
    if (fsDoc.deleted) continue; // tombstone : on masque le default
    // override par le doc Firestore
    result.push({
      id: fsDoc.id,
      name: fsDoc.name || def.name,
      key: fsDoc.key || def.key,
      imageUrl: fsDoc.imageUrl || undefined,
      isFallback: false,
    });
  }

  // 2) docs Firestore avec une key non-default (catégories ajoutées par admin)
  for (const fsDoc of firestoreDocs) {
    if (!fsDoc.key || fsDoc.deleted) continue;
    const isDefaultKey = DEFAULT_CATEGORIES.some((d) => d.key === fsDoc.key);
    if (isDefaultKey) continue;
    result.push({
      id: fsDoc.id,
      name: fsDoc.name || fsDoc.key,
      key: fsDoc.key,
      imageUrl: fsDoc.imageUrl || undefined,
      isFallback: false,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
};

export function useCategories(_refreshKey: number = 0) {
  const [categories, setCategories] = useState<CategoryEntry[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [rawDocs, setRawDocs] = useState<FirestoreDoc[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'categories'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: FirestoreDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRawDocs(docs);
        setCategories(mergeCategories(docs));
        setLoading(false);
      },
      (error) => {
        console.error('useCategories onSnapshot error:', error);
        setCategories(DEFAULT_CATEGORIES);
        setRawDocs([]);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return { categories, loading, rawDocs };
}
