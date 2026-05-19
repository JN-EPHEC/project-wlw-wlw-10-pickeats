import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { HomePage } from '@/components/HomePage';
import { ProductsPage } from '@/components/ProductsPage';
import { CartPage } from '@/components/CartPage';
import { OrderConfirmationPage } from '@/components/OrderConfirmationPage';
import { ProfilePage } from '@/components/ProfilePage';
import { SignInPage } from '@/components/SignInPage';
import { SignUpPage } from '@/components/SignUpPage';
import { ForgotPasswordPage } from '@/components/ForgotPasswordPage';
import { AdminPage } from '@/components/AdminPage';
import { OrdersManagementPage } from '@/components/OrdersManagementPage';
import { DashboardPage } from '@/components/DashboardPage';
import { EditProductPage } from '@/components/EditProductPage';
import { auth, db, functions } from '@/firebaseConfig';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  increment,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { Product, CartItem, TimeSlot, OrderHistoryEntry } from '@/types';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'products' | 'cart' | 'confirmation' | 'profile' | 'admin' | 'ordersManagement' | 'dashboard' | 'forecast' | 'addProduct' | 'editProduct'>('home');
  const [selectedCategory, setSelectedCategory] = useState<'sandwich-chaud' | 'sandwich-froid' | 'pasta' | 'drink' | 'snack' | 'salade' | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authScreen, setAuthScreen] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [orders, setOrders] = useState<OrderHistoryEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [showCartMessage, setShowCartMessage] = useState(false);
  const [lastOrderCart, setLastOrderCart] = useState<CartItem[]>([]);
  const [lastOrderTotal, setLastOrderTotal] = useState<number>(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [availableVouchers, setAvailableVouchers] = useState<number>(0);
  const [lastDashboardTab, setLastDashboardTab] = useState<'revenue' | 'forecast' | 'orders' | 'products' | 'offers'>('orders');
  const [activeOffers, setActiveOffers] = useState<Array<{ id: string; discount: number; productIds?: string[] }>>([]);

  const loadUserRole = async (currentUser: FirebaseUser) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role || 'user');
        setLoyaltyPoints(userData.loyaltyPoints || 0);
        // Calculer les vouchers disponibles
        const points = userData.loyaltyPoints || 0;
        setAvailableVouchers(Math.floor(points / 10));
      }
    } catch (error) {
      console.error('Erreur lors du chargement du rôle utilisateur:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser);
      setAuthReady(true);

      if (currentUser) {
        await loadUserRole(currentUser);
      } else {
        setUserRole('user');
      }
    });

    return () => unsubscribe();
  }, []);

  // Charger les promotions actives (seulement si l'utilisateur est authentifié)
  useEffect(() => {
    if (!user) {
      setActiveOffers([]);
      return;
    }

    const loadActiveOffers = async () => {
      try {
        const offersRef = doc(db, 'settings', 'promotions');
        const offersDoc = await getDoc(offersRef);
        if (offersDoc.exists()) {
          const data = offersDoc.data();
          const allOffers = data.offers || [];
          // Filtrer seulement les offres actives
          const active = allOffers.filter((offer: any) => offer.active === true);
          setActiveOffers(active);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des promotions:', error);
        setActiveOffers([]);
      }
    };
    loadActiveOffers();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    // Charger les commandes seulement si on est sur la page profil
    if (currentPage !== 'profile') {
      return;
    }

    setOrdersLoading(true);

    const ordersQuery = query(
      collection(db, 'users', user.uid, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      snapshot => {
        const parsedOrders: OrderHistoryEntry[] = snapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          const createdAt = (data.createdAt as Timestamp | undefined)?.toDate?.() ?? null;
          const items = Array.isArray(data.items)
            ? data.items.map((item: any) => ({
                name: item.name ?? 'Article',
                quantity: item.quantity ?? 1,
                customizations: item.customizations || [],
              }))
            : [];

          return {
            id: docSnapshot.id,
            total: Number(data.total ?? 0),
            status: data.status ?? 'En préparation',
            pickupTime: data.pickupTime,
            createdAt,
            items,
          };
        });

        setOrders(parsedOrders);
        setOrdersLoading(false);
      },
      error => {
        console.error('Erreur Firestore', error);
        Alert.alert('Erreur', 'Impossible de charger vos commandes.');
        setOrdersLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, currentPage]);

  // Charger les points de fidélité et les bons de l'utilisateur (seulement sur la page profil)
  useEffect(() => {
    if (!user || currentPage !== 'profile') {
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          setLoyaltyPoints(userData.loyaltyPoints || 0);
          setAvailableVouchers(Math.floor((userData.loyaltyPoints || 0) / 10));
        }
      },
      (error) => {
        console.error('Erreur lors du chargement des points:', error);
      }
    );

    return () => unsubscribe();
  }, [user, currentPage]);

  const redeemLoyaltyCard = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté.');
      return;
    }

    if (loyaltyPoints < 10) {
      Alert.alert('Insuffisant', 'Vous avez besoin de 10 points pour obtenir un bon de 5€.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        loyaltyPoints: increment(-10),
        availableVouchers: increment(1),
      });
      Alert.alert('Félicitations !', 'Vous avez obtenu un bon de 5€ ! Il sera automatiquement appliqué à votre prochaine commande.');
    } catch (error) {
      console.error('Erreur lors de l\'échange:', error);
      Alert.alert('Erreur', 'Impossible d\'échanger vos points.');
    }
  };

  // Fonction pour générer un ID unique pour un article du panier
  const generateCartItemId = (productId: string, customizations?: string[]): string => {
    if (!customizations || customizations.length === 0) {
      return productId;
    }
    
    // Normaliser les customizations en triant les suppléments dans "Suppléments: ..."
    const normalizedCustomizations = customizations.map(custom => {
      if (custom.startsWith('Suppléments: ')) {
        // Extraire et trier les suppléments
        const supplementsText = custom.replace('Suppléments: ', '');
        const supplements = supplementsText.split(', ').map(s => s.trim()).sort();
        return `Suppléments: ${supplements.join(', ')}`;
      }
      return custom;
    }).sort().join('|');
    
    return `${productId}_${normalizedCustomizations}`;
  };

  const addToCart = (
    product: Product, 
    customizations?: string[],
    comboData?: {
      isComboOffer: boolean;
      comboProducts: Product[];
      comboTitle: string;
      comboDiscount: number;
    }
  ) => {
    setCart(prev => {
      const itemId = generateCartItemId(product.id, customizations);
      const existingItem = prev.find(item => item.id === itemId);
      
      if (existingItem) {
        return prev.map(item =>
          item.id === itemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      // Si c'est une offre combinée, ajouter les métadonnées
      if (comboData) {
        return [...prev, { 
          id: itemId, 
          product, 
          quantity: 1, 
          customizations,
          isComboOffer: comboData.isComboOffer,
          comboProducts: comboData.comboProducts,
          comboTitle: comboData.comboTitle,
          comboDiscount: comboData.comboDiscount,
        }];
      }
      
      return [...prev, { id: itemId, product, quantity: 1, customizations }];
    });
    
    // Afficher le message pendant 5 secondes
    setShowCartMessage(true);
    setTimeout(() => {
      setShowCartMessage(false);
    }, 5000);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(itemId);
    } else {
      setCart(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        )
      );
    }
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const navigateToProducts = (category: 'sandwich-chaud' | 'sandwich-froid' | 'pasta' | 'drink' | 'snack' | 'salade') => {
    setSelectedCategory(category);
    setCurrentPage('products');
  };

  const placeOrder = async (timeSlot: TimeSlot) => {
    if (!user) {
      Alert.alert('Erreur', 'Connectez-vous pour passer une commande.');
      throw new Error('User not authenticated');
    }

    if (cart.length === 0) {
      Alert.alert('Erreur', 'Votre panier est vide.');
      throw new Error('Cart is empty');
    }

    // Calculer le prix total en incluant les suppléments
    const sandwichSupplements = [
      { name: 'Légumes', price: 0.50 },
      { name: 'Œuf', price: 1.00 },
      { name: 'Dinde fumée', price: 1.00 },
      { name: 'Tortilla', price: 2.00 },
    ];

    const calculateItemPrice = (item: CartItem): number => {
      // Si c'est une offre combinée, calculer le prix total de tous les produits avec réduction
      if (item.isComboOffer && item.comboProducts && item.comboDiscount !== undefined) {
        const totalComboPrice = item.comboProducts.reduce((sum, product) => sum + product.price, 0);
        const discountAmount = (totalComboPrice * item.comboDiscount) / 100;
        return Math.max(0, totalComboPrice - discountAmount);
      }
      
      let price = item.product.price;
      
      if ((item.product.category === 'sandwich-chaud' || item.product.category === 'sandwich-froid') && item.customizations) {
        const supplementsCustomization = item.customizations.find(c => c.startsWith('Suppléments: '));
        if (supplementsCustomization) {
          const supplementsText = supplementsCustomization.replace('Suppléments: ', '');
          const selectedSupplements = supplementsText.split(', ').map(s => s.trim());
          
          selectedSupplements.forEach(supplementName => {
            const supplement = sandwichSupplements.find(s => s.name === supplementName);
            if (supplement) {
              price += supplement.price;
            }
          });
        }
      }
      
      // Appliquer les réductions de promotion si le produit est en promotion
      const productPromotion = activeOffers.find(offer => 
        offer.productIds && offer.productIds.includes(item.product.id)
      );
      if (productPromotion) {
        const discountAmount = (price * productPromotion.discount) / 100;
        price = price - discountAmount;
      }
      
      return Math.max(0, price); // S'assurer que le prix n'est pas négatif
    };

    const orderItems = cart.map(item => {
      const orderItem: any = {
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: calculateItemPrice(item),
        customizations: item.customizations ?? [],
        isComboOffer: item.isComboOffer || false,
      };

      // N'ajouter les champs combo que s'ils existent (éviter les undefined)
      if (item.isComboOffer) {
        if (item.comboTitle) orderItem.comboTitle = item.comboTitle;
        if (item.comboDiscount !== undefined) orderItem.comboDiscount = item.comboDiscount;
        if (item.comboProducts) {
          orderItem.comboProducts = item.comboProducts.map(p => ({ 
            id: p.id, 
            name: p.name, 
            price: p.price 
          }));
        }
      }

      return orderItem;
    });

    const total = cart.reduce(
      (sum, item) => sum + calculateItemPrice(item) * item.quantity,
      0
    );

    // Appliquer les bons de réduction automatiquement (seulement si commande ≥ 5€)
    let discount = 0;
    let vouchersUsed = 0;
    if (availableVouchers > 0 && total >= 5) {
      vouchersUsed = 1;
      discount = 5;
    }
    
    const finalTotal = Math.max(0, total - discount);

    try {
      // Sur le web, on sauvegarde la commande directement sans paiement Stripe
      // Sur mobile, le paiement Stripe sera implémenté dans une version future
      
      // Générer un numéro de commande unique (timestamp + 4 derniers caractères aléatoires)
      const orderNumber = `CMD-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-4).toUpperCase()}`;
      
      await addDoc(collection(db, 'users', user.uid, 'orders'), {
        orderNumber,
        items: orderItems,
        total: Number(finalTotal.toFixed(2)),
        originalTotal: Number(total.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        vouchersUsed,
        status: 'En préparation',
        pickupTime: timeSlot.time,
        createdAt: serverTimestamp(),
        userEmail: user.email || '',
      });

      // Mise à jour des points et bons
      const userRef = doc(db, 'users', user.uid);
      const updates: any = {};
      
      // Ajouter 1 point de fidélité si la commande est >= 5€ ET qu'aucun bon n'a été utilisé
      if (finalTotal >= 5 && vouchersUsed === 0) {
        updates.loyaltyPoints = increment(1);
      }
      
      // Déduire le bon utilisé
      if (vouchersUsed > 0) {
        updates.availableVouchers = increment(-vouchersUsed);
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
      }

      // Afficher un message si un bon a été utilisé
      if (vouchersUsed > 0) {
        Alert.alert('Bon appliqué !', `Vous avez économisé ${discount.toFixed(2)}€ grâce à votre bon de fidélité !`);
      }

      setSelectedTimeSlot(timeSlot);
      setLastOrderCart([...cart]); // Sauvegarder le panier avant de le vider
      setLastOrderTotal(finalTotal); // Sauvegarder le total final avec le bon appliqué
      setCart([]); // Vider le panier après la confirmation
      setCurrentPage('confirmation');
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde de la commande', error);
      const errorMessage = error?.code === 'permission-denied' 
        ? 'Permission refusée. Vérifiez que vous êtes connecté et que les règles Firestore sont publiées.'
        : error?.message || 'Impossible d\'enregistrer la commande.';
      Alert.alert('Erreur', errorMessage);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentPage('home');
      setCart([]);
      setSelectedCategory(null);
    } catch (error) {
      console.error('Erreur de déconnexion', error);
      Alert.alert('Erreur', 'Impossible de se déconnecter.');
    }
  };

  const resetOrder = () => {
    setCart([]);
    setSelectedTimeSlot(null);
    setCurrentPage('home');
  };

  if (!authReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initialisation de l'application...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <>
        {authScreen === 'signIn' ? (
          <SignInPage 
            onSwitchToSignUp={() => setAuthScreen('signUp')}
            onForgotPassword={() => setAuthScreen('forgotPassword')}
          />
        ) : authScreen === 'signUp' ? (
          <SignUpPage onSwitchToSignIn={() => setAuthScreen('signIn')} />
        ) : (
          <ForgotPasswordPage 
            onBack={() => setAuthScreen('signIn')}
            onSuccess={() => setAuthScreen('signIn')}
          />
        )}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/Logo PickEat.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {currentPage === 'home' && (
          <HomePage onCategorySelect={navigateToProducts} user={user} onAddToCart={addToCart} />
        )}
        {currentPage === 'products' && selectedCategory && (
          <ProductsPage
            category={selectedCategory}
            onAddToCart={addToCart}
            onBack={() => setCurrentPage('home')}
          />
        )}
        {currentPage === 'cart' && (
          <CartPage
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onPlaceOrder={placeOrder}
            onBack={() => setCurrentPage('home')}
            availableVouchers={availableVouchers}
            activeOffers={activeOffers}
          />
        )}
        {currentPage === 'confirmation' && selectedTimeSlot && (
          <OrderConfirmationPage
            cart={lastOrderCart}
            timeSlot={selectedTimeSlot}
            onNewOrder={resetOrder}
            total={lastOrderTotal}
          />
        )}
        {currentPage === 'admin' && (
          <AdminPage
            onBack={() => setCurrentPage('dashboard')}
            userRole={userRole}
            userId={user?.uid}
          />
        )}
        {currentPage === 'ordersManagement' && (
          <OrdersManagementPage
            onBack={() => setCurrentPage('dashboard')}
          />
        )}
        {currentPage === 'dashboard' && (
          <DashboardPage
            onBack={() => setCurrentPage('profile')}
            onOpenOrdersManagement={() => setCurrentPage('ordersManagement')}
            onOpenProductsManagement={() => setCurrentPage('admin')}
            onAddNewProduct={() => setCurrentPage('addProduct')}
            onEditProduct={(product) => {
              setEditingProduct(product);
              setCurrentPage('editProduct');
            }}
            initialTab={lastDashboardTab}
            onTabChange={(tab) => setLastDashboardTab(tab as 'revenue' | 'forecast' | 'orders' | 'products' | 'offers')}
          />
        )}
        {currentPage === 'addProduct' && (
          <EditProductPage
            product={null}
            onBack={() => setCurrentPage('dashboard')}
            onSaveComplete={() => setCurrentPage('dashboard')}
          />
        )}
        {currentPage === 'editProduct' && (
          <EditProductPage
            product={editingProduct}
            onBack={() => {
              setEditingProduct(null);
              setCurrentPage('dashboard');
            }}
            onSaveComplete={() => {
              setEditingProduct(null);
              setCurrentPage('dashboard');
            }}
          />
        )}
        {currentPage === 'profile' && (
          <ProfilePage
            onBack={() => setCurrentPage('home')}
            onSignOut={handleSignOut}
            onOpenAdmin={() => setCurrentPage('dashboard')}
            onOpenOrdersManagement={() => setCurrentPage('ordersManagement')}
            onReloadUser={() => user && loadUserRole(user)}
            user={user}
            userRole={userRole}
            orders={orders}
            ordersLoading={ordersLoading}
            loyaltyPoints={loyaltyPoints}
            availableVouchers={availableVouchers}
            onRedeemLoyaltyCard={redeemLoyaltyCard}
          />
        )}
      </View>

      {/* Message ajout au panier */}
      {showCartMessage && (
        <View style={styles.cartMessage}>
          <Text style={styles.cartMessageText}>✓ Ajouté au panier</Text>
        </View>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          onPress={() => setCurrentPage('home')}
          style={styles.navButton}
        >
          <Text style={currentPage === 'home' ? styles.navIconActive : styles.navIcon}>🏠</Text>
          <Text style={currentPage === 'home' ? styles.navTextActive : styles.navText}>Accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentPage('cart')}
          style={styles.navButton}
        >
          <View style={styles.navIconContainer}>
            <Text style={currentPage === 'cart' ? styles.navIconActive : styles.navIcon}>🛒</Text>
            {getTotalItems() > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{getTotalItems()}</Text>
              </View>
            )}
          </View>
          <Text style={currentPage === 'cart' ? styles.navTextActive : styles.navText}>Panier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentPage('profile')}
          style={styles.navButton}
        >
          <Text style={currentPage === 'profile' ? styles.navIconActive : styles.navIcon}>👤</Text>
          <Text style={currentPage === 'profile' ? styles.navTextActive : styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 50,
    paddingBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 160,
    height: 55,
  },
  main: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  navIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
  navIconActive: {
    fontSize: 24,
  },
  navText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  navTextActive: {
    fontSize: 12,
    color: '#2cbefb',
    fontWeight: '600',
    marginTop: 4,
  },
  navIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: Platform.select({ ios: -4, android: -6, default: -4 }),
    right: Platform.select({ ios: -10, android: -12, default: -10 }),
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  navBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cartMessage: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    transform: [{ translateX: -75 }],
    backgroundColor: 'rgba(44, 190, 251, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#2cbefb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  cartMessageText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
