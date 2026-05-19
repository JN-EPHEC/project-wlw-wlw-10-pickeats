/**
 * Script pour promouvoir un utilisateur en admin
 * Usage: node scripts/makeAdmin.js <email>
 * Exemple: node scripts/makeAdmin.js prenom.nom@ephec.be
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

// Configuration Firebase (même config que votre app)
const firebaseConfig = {
  apiKey: "AIzaSyDNaOfpJ7gYLmIiD05bq1yvAe_P-WcSWDA",
  authDomain: "pickeat-b3a24.firebaseapp.com",
  projectId: "pickeat-b3a24",
  storageBucket: "pickeat-b3a24.firebasestorage.app",
  messagingSenderId: "1005735718774",
  appId: "1:1005735718774:web:a95e2e84f3c54d61f3ea7e",
  measurementId: "G-1PQRGPFZRM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function makeAdmin(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ Aucun utilisateur trouvé avec cet email.');
      console.log('💡 Créez d\'abord un compte via l\'application.');
      process.exit(1);
    }
    
    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log(`✅ Utilisateur trouvé: ${userData.fullName || 'Sans nom'}`);
    console.log(`📧 Email: ${userData.email}`);
    console.log(`👤 Rôle actuel: ${userData.role || 'user'}`);
    
    if (userData.role === 'admin') {
      console.log('✨ Cet utilisateur est déjà admin !');
      process.exit(0);
    }
    
    // Promouvoir en admin
    await updateDoc(doc(db, 'users', userId), {
      role: 'admin'
    });
    
    console.log('🎉 Utilisateur promu en admin avec succès !');
    console.log('🔧 Reconnectez-vous pour voir le bouton "Gestion des produits"');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Récupérer l'email depuis les arguments
const email = process.argv[2];

if (!email) {
  console.log('❌ Usage: node scripts/makeAdmin.js <email>');
  console.log('📧 Exemple: node scripts/makeAdmin.js prenom.nom@ephec.be');
  process.exit(1);
}

makeAdmin(email);
