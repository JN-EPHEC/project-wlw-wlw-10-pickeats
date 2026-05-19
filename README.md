# PickEat 🍽️

Application mobile de commande de repas pour une cafétéria, développée avec React Native et Expo.

## 🚀 Démarrage rapide

### Prérequis

- Node.js (v18 ou supérieur)
- npm ou yarn
- Expo CLI
- Compte Firebase configuré

### Installation

1. Cloner le projet et installer les dépendances :

```bash
npm install
```

2. Configurer Firebase :
   - Créer un projet Firebase
   - Activer Authentication, Firestore, Storage et Functions
   - Mettre à jour `firebase_env.js` avec vos identifiants

3. Déployer les règles Firestore :

```bash
firebase deploy --only firestore:rules
```

4. Déployer les Cloud Functions :

```bash
cd functions
npm install
npm run deploy
```

### Lancement de l'application

```bash
npx expo start
```

Options disponibles :
- Presser `w` pour ouvrir dans le navigateur web
- Presser `a` pour ouvrir sur Android
- Presser `i` pour ouvrir sur iOS
- Scanner le QR code avec Expo Go (mobile)

## 📁 Structure du projet

```
/
├── app/                    # Pages principales (routing)
├── components/            # Composants React réutilisables
├── constants/             # Constantes (thème, Stripe)
├── functions/             # Cloud Functions Firebase
├── hooks/                 # Hooks personnalisés React
├── scripts/              # Scripts utilitaires
├── types/                # Définitions TypeScript
├── firebase_env.js       # Configuration Firebase
├── firebaseConfig.js     # Initialisation Firebase
└── firestore.rules       # Règles de sécurité Firestore
```

## 🔑 Fonctionnalités

### Utilisateur
- ✅ Inscription et connexion
- ✅ Navigation par catégories de produits
- ✅ Personnalisation des produits (sauces, suppléments)
- ✅ Panier avec gestion des quantités
- ✅ Système de fidélité (points et bons de réduction)
- ✅ Historique des commandes
- ✅ Profil utilisateur

### Admin
- ✅ Gestion des produits (CRUD)
- ✅ Gestion des promotions et offres combinées
- ✅ Gestion des commandes
- ✅ Dashboard avec statistiques
- ✅ Prévision des stocks
- ✅ Paramètres de la cafétéria

## 🛠️ Technologies utilisées

- **Frontend** : React Native, Expo
- **Backend** : Firebase (Authentication, Firestore, Storage, Functions)
- **Paiement** : Stripe (prévu pour web uniquement)
- **Langages** : TypeScript, JavaScript
- **Navigation** : Expo Router

## 📝 Scripts disponibles

- `npm start` - Lancer le serveur Expo
- `npm run android` - Lancer sur Android
- `npm run ios` - Lancer sur iOS
- `npm run web` - Lancer dans le navigateur
- `cd functions && npm run deploy` - Déployer les Cloud Functions

### Scripts utilitaires (dans `/scripts`)

- `node scripts/addProducts.js` - Ajouter des produits en masse
- `node scripts/makeAdmin.js` - Définir un utilisateur comme admin

## 🔐 Sécurité

Les règles de sécurité Firestore sont configurées dans `firestore.rules` :
- Authentification requise pour toutes les opérations
- Accès utilisateur limité à ses propres données
- Opérations admin protégées par vérification du rôle
- Cloud Functions pour les opérations sensibles

## 📦 Cloud Functions

Les Cloud Functions sont utilisées pour :
- Vérification de l'unicité des numéros de téléphone
- Récupération sécurisée de toutes les commandes (admin)
- Intégration Stripe (création de PaymentIntent)

## 🎨 Thème et Design

L'application utilise un thème personnalisé défini dans `constants/theme.ts` avec :
- Palette de couleurs cohérente
- Typographie adaptée
- Composants réutilisables stylisés

## 📄 License

Voir le fichier `LICENSE` pour plus de détails.

## 👥 Auteurs

Projet développé dans le cadre du cours de développement mobile à l'EPHEC.
