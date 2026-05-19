/**
 * Script pour ajouter les produits du menu à la base de données
 * Usage: node scripts/addProducts.js
 * 
 * IMPORTANT: Avant d'exécuter ce script, modifiez temporairement firestore.rules
 * pour permettre l'écriture dans la collection products:
 *   Ligne 30: allow write: if true;  // Temporaire
 * 
 * Après avoir ajouté les produits, remettez la règle originale:
 *   Ligne 30: allow write: if isAdmin();
 * 
 * Puis déployez les règles: firebase deploy --only firestore:rules
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

// Configuration Firebase (même config que votre app)
const firebaseConfig = {
  apiKey: "AIzaSyCKUMx2ujecefLlh3Sit1rEZVjoz8dGSFA",
  authDomain: "pickeat-84fc6.firebaseapp.com",
  projectId: "pickeat-84fc6",
  storageBucket: "pickeat-84fc6.firebasestorage.app",
  messagingSenderId: "189986557529",
  appId: "1:189986557529:web:94c3fc3b2dcdc78a6d2b48",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const products = [
  // CORNET DE PÂTES - Pasta
  {
    name: 'Cornet de pâtes - Petit',
    description: 'Petit cornet de pâtes avec poulet & fromage. Sauce au choix: Bolognaise, Chef (crème tomate), 4 Fromages, Pili Pili (piquant), Carbonara, Brocolis',
    price: 4.50,
    category: 'pasta',
    image: '🍝',
    customizable: true,
    available: true,
  },
  {
    name: 'Cornet de pâtes - Grand',
    description: 'Grand cornet de pâtes avec poulet & fromage. Sauce au choix: Bolognaise, Chef (crème tomate), 4 Fromages, Pili Pili (piquant), Carbonara, Brocolis',
    price: 6.50,
    category: 'pasta',
    image: '🍝',
    customizable: true,
    available: true,
  },

  // SANDWICHES FROIDS - Sandwich-froid
  {
    name: 'Thon piquant',
    description: 'Sandwich froid au thon piquant',
    price: 4.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Thon mayonnaise',
    description: 'Sandwich froid au thon mayonnaise',
    price: 4.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Poulet curry',
    description: 'Sandwich froid au poulet curry',
    price: 4.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Poulet andalouse',
    description: 'Sandwich froid au poulet andalouse',
    price: 4.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Mozzarella pesto',
    description: 'Sandwich froid mozzarella pesto',
    price: 4.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Club',
    description: 'Sandwich froid Club (jambon, fromage)',
    price: 5.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Américain',
    description: 'Sandwich froid Américain',
    price: 5.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },
  {
    name: 'Végétarien',
    description: 'Sandwich froid végétarien (tapenade tomate, poivron, aubergine, roquette)',
    price: 5.50,
    category: 'sandwich-froid',
    image: '🥪',
    available: true,
  },

  // SANDWICHES CHAUDS - Sandwich-chaud
  {
    name: 'Poulet pané',
    description: 'Sandwich chaud au poulet pané',
    price: 5.90,
    category: 'sandwich-chaud',
    image: '🥪',
    available: true,
  },
  {
    name: 'Tenders',
    description: 'Sandwich chaud aux tenders',
    price: 5.90,
    category: 'sandwich-chaud',
    image: '🥪',
    available: true,
  },
  {
    name: 'Cordon bleu',
    description: 'Sandwich chaud au cordon bleu',
    price: 5.90,
    category: 'sandwich-chaud',
    image: '🥪',
    available: true,
  },
  {
    name: 'Tortilla (chaud)',
    description: 'Sandwich chaud à la tortilla',
    price: 5.90,
    category: 'sandwich-chaud',
    image: '🥪',
    available: true,
  },

  // SALADE BAR - Salade
  {
    name: 'Salade végétarienne',
    description: 'Salade végétarienne du bar à salades',
    price: 5.20,
    category: 'salade',
    image: '🥗',
    available: true,
  },
  {
    name: 'Salade au poulet',
    description: 'Salade au poulet du bar à salades',
    price: 6.50,
    category: 'salade',
    image: '🥗',
    available: true,
  },

  // DESSERTS - Snack
  {
    name: 'Cake du jour',
    description: 'Cake du jour',
    price: 2.50,
    category: 'snack',
    image: '🍰',
    available: true,
  },
  {
    name: 'Tiramisu',
    description: 'Tiramisu',
    price: 3.50,
    category: 'snack',
    image: '🍰',
    available: true,
  },
  {
    name: 'Mousse au chocolat',
    description: 'Mousse au chocolat',
    price: 4.00,
    category: 'snack',
    image: '🍫',
    available: true,
  },
  {
    name: 'Dessert Kinder Bueno',
    description: 'Dessert Kinder Bueno',
    price: 4.00,
    category: 'snack',
    image: '🍫',
    available: true,
  },
  {
    name: 'Tarte Daim',
    description: 'Tarte Daim',
    price: 4.00,
    category: 'snack',
    image: '🍰',
    available: true,
  },
  {
    name: 'Tartelette',
    description: 'Tartelette',
    price: 4.00,
    category: 'snack',
    image: '🍰',
    available: true,
  },
  {
    name: 'Salade de fruits',
    description: 'Salade de fruits frais',
    price: 4.00,
    category: 'snack',
    image: '🍓',
    available: true,
  },
  {
    name: 'Fruit à la pièce',
    description: 'Fruit à la pièce',
    price: 0.50,
    category: 'snack',
    image: '🍎',
    available: true,
  },

  // BOISSONS - Drink
  {
    name: 'Eau minérale / gazeuse',
    description: 'Eau minérale ou gazeuse (bouteille)',
    price: 2.00,
    category: 'drink',
    image: '💧',
    available: true,
  },
  {
    name: 'Soft (canette)',
    description: 'Boisson gazeuse en canette',
    price: 1.50,
    category: 'drink',
    image: '🥤',
    available: true,
  },
  {
    name: 'Soft (bouteille)',
    description: 'Boisson gazeuse en bouteille',
    price: 2.30,
    category: 'drink',
    image: '🥤',
    available: true,
  },
  {
    name: 'Mojito sans alcool',
    description: 'Mojito sans alcool',
    price: 4.50,
    category: 'drink',
    image: '🧊',
    available: true,
  },
  {
    name: 'Smoothie',
    description: 'Smoothie aux fruits',
    price: 4.50,
    category: 'drink',
    image: '🥤',
    available: true,
  },
  {
    name: 'Milkshake',
    description: 'Milkshake (caramel, vanille, noisette +0,50€)',
    price: 4.50,
    category: 'drink',
    image: '🥛',
    customizable: true,
    available: true,
  },
  {
    name: 'Café noir',
    description: 'Café noir',
    price: 1.80,
    category: 'drink',
    image: '☕',
    available: true,
  },
  {
    name: 'Café au lait',
    description: 'Café au lait',
    price: 2.50,
    category: 'drink',
    image: '☕',
    available: true,
  },
  {
    name: 'Café frappée',
    description: 'Café frappé glacé',
    price: 3.00,
    category: 'drink',
    image: '🧊',
    available: true,
  },
  {
    name: 'Latte Macchiato',
    description: 'Latte Macchiato',
    price: 2.80,
    category: 'drink',
    image: '☕',
    available: true,
  },
  {
    name: 'Cappuccino',
    description: 'Cappuccino',
    price: 2.80,
    category: 'drink',
    image: '☕',
    available: true,
  },
  {
    name: 'Chocolat chaud',
    description: 'Chocolat chaud',
    price: 2.50,
    category: 'drink',
    image: '☕',
    available: true,
  },
  {
    name: 'Ice tea maison',
    description: 'Ice tea maison',
    price: 3.00,
    category: 'drink',
    image: '🧊',
    available: true,
  },
  {
    name: 'Thé à la menthe',
    description: 'Thé à la menthe',
    price: 2.00,
    category: 'drink',
    image: '🍵',
    available: true,
  },
  {
    name: 'Infusion',
    description: 'Infusion (thé aux herbes)',
    price: 1.50,
    category: 'drink',
    image: '🍵',
    available: true,
  },
];

async function addProducts() {
  try {
    console.log(`📦 Début de l'ajout de ${products.length} produits...\n`);
    
    // Récupérer tous les produits existants pour éviter les doublons
    console.log('🔍 Vérification des produits existants...\n');
    const productsRef = collection(db, 'products');
    const existingSnapshot = await getDocs(productsRef);
    const existingProductNames = new Set(
      existingSnapshot.docs.map(doc => doc.data().name)
    );
    
    console.log(`📋 ${existingProductNames.size} produit(s) existant(s) trouvé(s)\n`);
    
    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        // Vérifier si le produit existe déjà
        if (existingProductNames.has(product.name)) {
          skippedCount++;
          console.log(`⏭️  ${product.name} (${product.price}€) - ${product.category} - Déjà existant, ignoré`);
          continue;
        }
        
        // Ajouter le produit s'il n'existe pas
        await addDoc(productsRef, {
          ...product,
          createdAt: serverTimestamp(),
        });
        
        // Ajouter le nom à la liste des produits existants pour éviter les doublons dans le même batch
        existingProductNames.add(product.name);
        addedCount++;
        console.log(`✅ ${product.name} (${product.price}€) - ${product.category}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Erreur pour ${product.name}:`, error.message);
      }
    }

    console.log(`\n🎉 Ajout terminé !`);
    console.log(`✅ ${addedCount} produit(s) ajouté(s) avec succès`);
    console.log(`⏭️  ${skippedCount} produit(s) ignoré(s) (déjà existants)`);
    if (errorCount > 0) {
      console.log(`❌ ${errorCount} erreur(s)`);
    }
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    process.exit(1);
  }
}

addProducts();

