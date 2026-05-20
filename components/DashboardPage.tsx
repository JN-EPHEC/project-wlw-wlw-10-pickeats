import { db, functions } from '@/firebaseConfig';
import type { Product } from '@/types';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OffersManagementPage } from './OffersManagementPage';

type DashboardPageProps = {
  onBack: () => void;
  onOpenOrdersManagement: () => void;
  onOpenProductsManagement: () => void;
  onAddNewProduct: () => void;
  onEditProduct: (product: Product) => void;
  initialTab?: 'revenue' | 'forecast' | 'orders' | 'products' | 'offers' | 'settings';
  onTabChange?: (tab: 'revenue' | 'forecast' | 'orders' | 'products' | 'offers' | 'settings') => void;
};

type DailyStat = {
  date: string;
  revenue: number;
  orders: number;
};

type ChartPeriod = '7days' | '30days' | '3months' | '1year';

type ProductForecast = {
  productId: string;
  productName: string;
  totalSold: number;
  averagePerWeek: number;
  averagePerDay: number;
  suggestedStock: number;
};

type OrderItem = {
  name: string;
  quantity: number;
  id?: string;
  productId?: string;
  customizations?: string[];
  isComboOffer?: boolean;
  comboTitle?: string;
  comboDiscount?: number;
  comboProducts?: Array<{ id: string; name: string; price: number }>;
};

type Order = {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  orderNumber?: string;
  total: number;
  status: string;
  pickupTime?: string;
  createdAt: Date | null;
  items: OrderItem[];
};

type Offer = {
  id: string;
  title: string;
  description: string;
  discount: number;
  badge: 'Promo' | 'Nouveau';
  active: boolean;
  productIds?: string[]; // IDs des produits en promotion
};

export function DashboardPage({ 
  onBack, 
  onOpenOrdersManagement,
  onOpenProductsManagement,
  onAddNewProduct,
  onEditProduct,
  initialTab,
  onTabChange
}: DashboardPageProps) {
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [ordersInProgress, setOrdersInProgress] = useState(0);
  const [ordersReady, setOrdersReady] = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [revenueGrowth, setRevenueGrowth] = useState(0);
  const [ordersGrowth, setOrdersGrowth] = useState(0);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('7days');
  const [activeTab, setActiveTab] = useState<'revenue' | 'forecast' | 'orders' | 'products' | 'offers' | 'settings'>(initialTab || 'revenue');
  const [cafeteriaOpen, setCafeteriaOpen] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [forecasts, setForecasts] = useState<ProductForecast[]>([]);
  const [forecastPeriod, setForecastPeriod] = useState<'week' | 'month' | '3months'>('week');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'En préparation' | 'À récupérer' | 'Terminé'>('En préparation');
  const [viewMode, setViewMode] = useState<'orders' | 'products'>('orders');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const toggleCafeteriaStatus = async () => {
    try {
      setSavingStatus(true);
      const newStatus = !cafeteriaOpen;
      setCafeteriaOpen(newStatus);
      
      // Sauvegarder dans Firestore
      const settingsRef = doc(db, 'settings', 'cafeteria');
      await setDoc(settingsRef, { open: newStatus }, { merge: true });
      
      const message = newStatus ? 'Cafétéria ouverte' : 'Cafétéria fermée';
      Alert.alert('Succès', message);
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      Alert.alert('Erreur', 'Impossible de modifier le statut de la cafétéria');
    } finally {
      setSavingStatus(false);
    }
  };

  const loadCafeteriaStatus = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'cafeteria');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        setCafeteriaOpen(settingsDoc.data().open ?? true);
      } else {
        // Créer le document par défaut
        await setDoc(settingsRef, { open: true });
        setCafeteriaOpen(true);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du statut:', error);
    }
  };

  useEffect(() => {
    loadCafeteriaStatus();
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts();
    } else if (activeTab === 'offers') {
      loadOffers();
    }
  }, [activeTab]);

  useEffect(() => {
    calculateChartData(allOrders);
  }, [chartPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Afficher immédiatement les statistiques de base si elles existent déjà
      if (allOrders.length > 0) {
        setLoading(false);
      }
      
      // Récupérer toutes les commandes via Cloud Function
      const getAllOrdersFunction = httpsCallable(functions, 'getAllOrders');
      const result = await getAllOrdersFunction({});
      const data = result.data as { orders: any[] };
      
      const orders: Order[] = (data.orders || []).map((order: any) => ({
        id: order.id,
        userId: order.userId,
        userEmail: order.userEmail,
        userName: order.userName,
        orderNumber: order.orderNumber,
        total: Number(order.total ?? 0),
        status: order.status ?? 'En préparation',
        pickupTime: order.pickupTime,
        createdAt: order.createdAt ? new Date(order.createdAt) : null,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              name: item.name ?? 'Article',
              quantity: item.quantity ?? 1,
              id: item.id || item.productId,
              customizations: item.customizations || [],
            }))
          : [],
      }));

      setAllOrders(orders);

      // Calculer les statistiques
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // Revenus et commandes du mois en cours
      const currentMonthOrders = orders.filter(order => {
        const orderDate = order.createdAt;
        return orderDate && 
               orderDate.getMonth() === currentMonth && 
               orderDate.getFullYear() === currentYear;
      });

      const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const currentMonthOrdersCount = currentMonthOrders.length;

      // Revenus et commandes du mois dernier
      const lastMonthOrders = orders.filter(order => {
        const orderDate = order.createdAt;
        return orderDate && 
               orderDate.getMonth() === lastMonth && 
               orderDate.getFullYear() === lastMonthYear;
      });

      const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const lastMonthOrdersCount = lastMonthOrders.length;

      // Calculer la croissance
      const revGrowth = lastMonthRevenue > 0 
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : (currentMonthRevenue > 0 ? 100 : 0);
      const ordGrowth = lastMonthOrdersCount > 0 
        ? ((currentMonthOrdersCount - lastMonthOrdersCount) / lastMonthOrdersCount) * 100 
        : (currentMonthOrdersCount > 0 ? 100 : 0);

      setTotalRevenue(currentMonthRevenue);
      setTotalOrders(currentMonthOrdersCount);
      setRevenueGrowth(revGrowth);
      setOrdersGrowth(ordGrowth);

      // Commandes en cours et prêtes
      const inProgress = orders.filter(o => o.status === 'En préparation').length;
      const ready = orders.filter(o => o.status === 'À récupérer').length;
      
      setOrdersInProgress(inProgress);
      setOrdersReady(ready);

      // Calculer les statistiques selon la période
      calculateChartData(orders);
      
      setLoading(false);
      
      // Calculer les prévisions de manière asynchrone (non bloquante)
      calculateForecasts(orders).catch(error => {
        console.error('Erreur lors du calcul des prévisions:', error);
      });
    } catch (error: any) {
      console.error('Erreur lors du chargement du tableau de bord:', error);
      Alert.alert(
        'Erreur',
        error?.code === 'permission-denied'
          ? 'Accès refusé. Vérifiez que vous êtes admin.'
          : error?.message || 'Impossible de charger les commandes.'
      );
      setAllOrders([]);
      setLoading(false);
    }
  };

  const calculateChartData = (orders: Order[]) => {
    let stats: DailyStat[] = [];
    const now = new Date();

    switch (chartPeriod) {
      case '7days':
        // 7 derniers jours
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayOrders = orders.filter(order => {
            const orderDate = order.createdAt;
            return orderDate && orderDate >= date && orderDate < nextDate;
          });

          const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.total || 0), 0);

          stats.push({
            date: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            revenue: dayRevenue,
            orders: dayOrders.length,
          });
        }
        break;

      case '30days':
        // 30 derniers jours (groupés par semaine)
        for (let i = 4; i >= 0; i--) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() - (i * 6));
          endDate.setHours(23, 59, 59, 999);
          
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          const weekOrders = orders.filter(order => {
            const orderDate = order.createdAt;
            return orderDate && orderDate >= startDate && orderDate <= endDate;
          });

          const weekRevenue = weekOrders.reduce((sum, order) => sum + (order.total || 0), 0);

          stats.push({
            date: `${startDate.getDate()}/${startDate.getMonth() + 1}`,
            revenue: weekRevenue,
            orders: weekOrders.length,
          });
        }
        break;

      case '3months':
        // 3 derniers mois (12 semaines)
        for (let i = 11; i >= 0; i--) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() - (i * 7));
          endDate.setHours(23, 59, 59, 999);
          
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          const weekOrders = orders.filter(order => {
            const orderDate = order.createdAt;
            return orderDate && orderDate >= startDate && orderDate <= endDate;
          });

          const weekRevenue = weekOrders.reduce((sum, order) => sum + (order.total || 0), 0);

          stats.push({
            date: `S${Math.floor((endDate.getDate() - 1) / 7) + 1}`,
            revenue: weekRevenue,
            orders: weekOrders.length,
          });
        }
        break;

      case '1year':
        // 12 derniers mois
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          date.setDate(1);
          date.setHours(0, 0, 0, 0);
          
          const nextMonth = new Date(date);
          nextMonth.setMonth(nextMonth.getMonth() + 1);

          const monthOrders = orders.filter(order => {
            const orderDate = order.createdAt;
            return orderDate && orderDate >= date && orderDate < nextMonth;
          });

          const monthRevenue = monthOrders.reduce((sum, order) => sum + (order.total || 0), 0);

          stats.push({
            date: date.toLocaleDateString('fr-FR', { month: 'short' }),
            revenue: monthRevenue,
            orders: monthOrders.length,
          });
        }
        break;
    }

    setDailyStats(stats);
  };

  const calculateForecasts = async (orders: Order[]) => {
    try {
      // Charger toutes les offres une seule fois pour optimiser les performances
      const promotionsRef = doc(db, 'settings', 'promotions');
      const promotionsSnap = await getDoc(promotionsRef);
      const allOffers = promotionsSnap.exists() ? (promotionsSnap.data()?.offers || []) : [];
      
      // Créer un cache des offres par ID et par mots-clés
      const offerCache = new Map<string, any>();
      allOffers.forEach((offer: any) => {
        if (offer.id) {
          offerCache.set(offer.id.toString().toLowerCase(), offer);
        }
        // Ajouter aussi par titre normalisé
        if (offer.title) {
          const normalizedTitle = offer.title.toLowerCase().replace(/[\s\-_]/g, '');
          offerCache.set(normalizedTitle, offer);
        }
      });

      // Calculer les statistiques par produit
      const productStats = new Map<string, { name: string; quantities: number[]; dates: Date[] }>();

      // Traiter les commandes de manière asynchrone
      for (const order of orders) {
        if (order.items && Array.isArray(order.items)) {
          const orderDate = order.createdAt;
          
          for (const item of order.items) {
            const productId = (item.id || item.productId || '').toString();
            const productName = (item.name || '').toString();
            const quantity = item.quantity || 1;

            // Décomposer les offres combinées modernes en produits individuels
            if (item.isComboOffer === true && item.comboProducts && Array.isArray(item.comboProducts) && item.comboProducts.length > 0) {
              item.comboProducts.forEach((comboProduct: any) => {
                const comboProductId = comboProduct.id;
                const comboProductName = comboProduct.name;

                if (comboProductId && comboProductName) {
                  if (!productStats.has(comboProductId)) {
                    productStats.set(comboProductId, {
                      name: comboProductName,
                      quantities: [],
                      dates: [],
                    });
                  }

                  const stats = productStats.get(comboProductId)!;
                  stats.quantities.push(quantity);
                  if (orderDate) {
                    stats.dates.push(orderDate);
                  }
                }
              });
              continue;
            }

            // Ignorer les offres incomplètes (sans métadonnées de produits)
            if (item.isComboOffer === true) {
              continue;
            }

            // Traiter les anciennes offres en les décomposant via le cache Firestore
            if (!productId || !productName) {
              continue; // Pas d'ID ou de nom → ignorer
            }

            const offerKeywords = ['offre', 'promo', 'pack', 'menu', 'combo', 'lunch', 'deal', 'formule'];
            const productIdLower = productId.toLowerCase();
            const productNameLower = productName.toLowerCase();
            
            const isLikelyOffer = offerKeywords.some(keyword => 
              productIdLower.includes(keyword) || productNameLower.includes(keyword)
            );

            if (isLikelyOffer) {
              // Chercher l'offre dans le cache (par ID ou nom normalisé)
              const normalizedName = productName.toLowerCase().replace(/[\s\-_]/g, '');
              const matchingOffer = offerCache.get(productId.toLowerCase()) || 
                                   offerCache.get(normalizedName) ||
                                   allOffers.find((offer: any) => {
                                     const offerTitle = (offer.title || '').toLowerCase();
                                     return offerTitle.includes(productNameLower) || productNameLower.includes(offerTitle);
                                   });
              
              if (matchingOffer && matchingOffer.productIds && matchingOffer.productIds.length > 0) {
                // Charger les produits de l'offre depuis Firestore
                for (const prodId of matchingOffer.productIds) {
                  const productRef = doc(db, 'products', prodId);
                  const productSnap = await getDoc(productRef);
                  
                  if (productSnap.exists()) {
                    const realProductData = productSnap.data();
                    const realProductId = productSnap.id;
                    const realProductName = realProductData.name;

                    if (!productStats.has(realProductId)) {
                      productStats.set(realProductId, {
                        name: realProductName,
                        quantities: [],
                        dates: [],
                      });
                    }

                    const stats = productStats.get(realProductId)!;
                    stats.quantities.push(quantity);
                    if (orderDate) {
                      stats.dates.push(orderDate);
                    }
                  }
                }
                continue;
              } else {
                // Offre non trouvée ou sans produits → Ignorer
                continue;
              }
            }

            // Comptabiliser les produits normaux (non-offres)
            if (!productStats.has(productId)) {
              productStats.set(productId, {
                name: productName,
                quantities: [],
                dates: [],
              });
            }

            const stats = productStats.get(productId)!;
            stats.quantities.push(quantity);
            if (orderDate) {
              stats.dates.push(orderDate);
            }
          }
        }
      }

      // Calculer les prévisions
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const forecastList: ProductForecast[] = [];

      productStats.forEach((stats, productId) => {
        // Filtrer les commandes des 30 derniers jours
        const recentQuantities = stats.quantities.filter((_, index) => {
          const date = stats.dates[index];
          return date && date >= thirtyDaysAgo;
        });

        const totalSold = recentQuantities.reduce((sum, q) => sum + q, 0);
        const daysForAverage = 20; // Moyenne sur 20 jours
        const weeksWithData = Math.max(1, daysForAverage / 7);

        const averagePerDay = totalSold / daysForAverage;
        const averagePerWeek = totalSold / weeksWithData;

        forecastList.push({
          productId,
          productName: stats.name,
          totalSold,
          averagePerDay,
          averagePerWeek,
          suggestedStock: Math.ceil(averagePerWeek * 2),
        });
      });

      // Trier par quantité totale vendue
      forecastList.sort((a, b) => b.totalSold - a.totalSold);

      setForecasts(forecastList);
    } catch (error) {
      console.error('Erreur lors du calcul des prévisions:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const loadedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(loadedProducts);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      Alert.alert('Erreur', 'Impossible de charger les produits.');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadOffers = async () => {
    try {
      const offersRef = doc(db, 'settings', 'promotions');
      const offersDoc = await getDoc(offersRef);
      
      if (offersDoc.exists()) {
        const data = offersDoc.data();
        setOffers(data.offers || []);
      } else {
        // Créer le document s'il n'existe pas
        await setDoc(offersRef, { offers: [] });
        setOffers([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des offres:', error);
      setOffers([]);
    }
  };

  const handleToggleAvailability = async (productId: string, currentStatus: boolean) => {
    try {
      // Mise à jour optimiste
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId ? { ...p, available: !currentStatus } : p
        )
      );

      await updateDoc(doc(db, 'products', productId), {
        available: !currentStatus,
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le produit.');
      loadProducts();
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer "${productName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', productId));
              Alert.alert('Succès', 'Produit supprimé avec succès.');
              loadProducts();
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le produit.');
            }
          },
        },
      ]
    );
  };

  const updateOrderStatus = async (orderId: string, userId: string, newStatus: string) => {
    try {
      // Mise à jour optimiste
      setAllOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      // Mise à jour dans Firebase
      const orderRef = doc(db, 'users', userId, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut de la commande.');
      // Recharger les données en cas d'erreur
      loadDashboardData();
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'En préparation':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'À récupérer':
        return { backgroundColor: '#bbf7d0', color: '#14532d' };
      case 'Terminé':
        return { backgroundColor: '#e0e7ff', color: '#312e81' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#1f2937' };
    }
  };

  const formatUserName = (order: Order) => {
    if (order.userName) {
      const names = order.userName.split(' ').filter(n => n.trim());
      if (names.length >= 2) {
        const firstName = names[0];
        const lastNameInitial = names[names.length - 1][0].toUpperCase();
        return `${firstName} ${lastNameInitial}.`;
      }
      return names[0] || 'Client';
    }
    return order.userEmail?.split('@')[0] || 'Client';
  };

  const getFilteredOrders = () => {
    if (selectedFilter === 'all') return allOrders;
    return allOrders.filter(order => order.status === selectedFilter);
  };

  const getProductsSummary = () => {
    const products = new Map<string, { name: string; orders: Order[]; totalQuantity: number }>();
    
    getFilteredOrders().forEach(order => {
      order.items.forEach(item => {
        const productId = item.id || item.name;
        if (!products.has(productId)) {
          products.set(productId, {
            name: item.name,
            orders: [],
            totalQuantity: 0,
          });
        }
        const product = products.get(productId)!;
        if (!product.orders.find(o => o.id === order.id)) {
          product.orders.push(order);
        }
        product.totalQuantity += item.quantity;
      });
    });

    return Array.from(products.entries()).map(([id, data]) => ({
      id,
      ...data,
    })).sort((a, b) => b.totalQuantity - a.totalQuantity);
  };

  const maxRevenue = Math.max(...dailyStats.map(s => s.revenue), 1);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 80;
  const chartHeight = 180;

  const getPeriodLabel = () => {
    switch (chartPeriod) {
      case '7days': return 'Revenus des 7 derniers jours';
      case '30days': return 'Revenus des 30 derniers jours';
      case '3months': return 'Revenus des 3 derniers mois';
      case '1year': return 'Revenus de l\'année';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Tableau de bord</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2cbefb" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tableau de bord</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabs}
        >
          <TouchableOpacity 
            style={activeTab === 'revenue' ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab('revenue');
              onTabChange?.('revenue');
            }}
          >
            <Text style={activeTab === 'revenue' ? styles.tabTextActive : styles.tabText}>Revenu</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'forecast' ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab('forecast');
              onTabChange?.('forecast');
            }}
          >
            <Text style={activeTab === 'forecast' ? styles.tabTextActive : styles.tabText}>Prévisions</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'orders' ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab('orders');
              onTabChange?.('orders');
            }}
          >
            <Text style={activeTab === 'orders' ? styles.tabTextActive : styles.tabText}>Commandes</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'products' ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab('products');
              onTabChange?.('products');
            }}
          >
            <Text style={activeTab === 'products' ? styles.tabTextActive : styles.tabText}>Produits</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'offers' ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab('offers');
              onTabChange?.('offers');
            }}
          >
            <Text style={activeTab === 'offers' ? styles.tabTextActive : styles.tabText}>Offres</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'settings' ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab('settings');
              onTabChange?.('settings');
            }}
          >
            <Text style={activeTab === 'settings' ? styles.tabTextActive : styles.tabText}>Paramètres</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Revenue Tab Content */}
        {activeTab === 'revenue' && (
          <>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Revenu</Text>
                <Text style={styles.statValue}>{totalRevenue.toFixed(2)}€</Text>
                <Text style={[styles.statGrowth, revenueGrowth >= 0 && styles.statGrowthPositive]}>
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(0)}% month over month
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Ventes</Text>
                <Text style={styles.statValue}>{totalOrders}</Text>
                <Text style={[styles.statGrowth, ordersGrowth >= 0 && styles.statGrowthPositive]}>
                  {ordersGrowth >= 0 ? '+' : ''}{ordersGrowth.toFixed(0)}% month over month
                </Text>
              </View>
            </View>

            {/* Chart */}
            <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{getPeriodLabel()}</Text>
            <View style={styles.periodSelector}>
              <TouchableOpacity 
                style={[styles.periodButton, chartPeriod === '7days' && styles.periodButtonActive]}
                onPress={() => setChartPeriod('7days')}
              >
                <Text style={[styles.periodButtonText, chartPeriod === '7days' && styles.periodButtonTextActive]}>7j</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.periodButton, chartPeriod === '30days' && styles.periodButtonActive]}
                onPress={() => setChartPeriod('30days')}
              >
                <Text style={[styles.periodButtonText, chartPeriod === '30days' && styles.periodButtonTextActive]}>30j</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.periodButton, chartPeriod === '3months' && styles.periodButtonActive]}
                onPress={() => setChartPeriod('3months')}
              >
                <Text style={[styles.periodButtonText, chartPeriod === '3months' && styles.periodButtonTextActive]}>3m</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.periodButton, chartPeriod === '1year' && styles.periodButtonActive]}
                onPress={() => setChartPeriod('1year')}
              >
                <Text style={[styles.periodButtonText, chartPeriod === '1year' && styles.periodButtonTextActive]}>1a</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.chart}>
            <View style={styles.chartYAxis}>
              <Text style={styles.chartLabel}>€{(maxRevenue * 1.1).toFixed(0)}</Text>
              <Text style={styles.chartLabel}>€{(maxRevenue * 0.75).toFixed(0)}</Text>
              <Text style={styles.chartLabel}>€{(maxRevenue * 0.5).toFixed(0)}</Text>
              <Text style={styles.chartLabel}>€{(maxRevenue * 0.25).toFixed(0)}</Text>
              <Text style={styles.chartLabel}>€0</Text>
            </View>
            <View style={styles.chartArea}>
              <View style={styles.chartBars}>
                {dailyStats.map((stat, index) => {
                  const height = (stat.revenue / maxRevenue) * (chartHeight - 40);
                  return (
                    <View key={index} style={styles.barContainer}>
                      <View style={[styles.bar, { height: Math.max(height, 2) }]} />
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartXAxis}>
                {dailyStats.map((stat, index) => (
                  <Text key={index} style={styles.chartXLabel}>{stat.date}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={onOpenOrdersManagement}
          >
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{ordersInProgress}</Text>
            </View>
            <Text style={styles.actionTitle}>En préparation</Text>
            <Text style={styles.actionSubtitle}>Commandes à préparer</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={onOpenOrdersManagement}
          >
            <View style={[styles.actionBadge, styles.actionBadgeGreen]}>
              <Text style={styles.actionBadgeText}>{ordersReady}</Text>
            </View>
            <Text style={styles.actionTitle}>À récupérer</Text>
            <Text style={styles.actionSubtitle}>Prêtes pour le client</Text>
          </TouchableOpacity>
        </View>
          </>
        )}

        {/* Forecast Tab Content */}
        {activeTab === 'forecast' && (
          <>
            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Prévisions de stock</Text>
              <Text style={styles.infoText}>
                Basées sur les ventes des 30 derniers jours, ces prévisions vous aident à anticiper vos besoins en produits.
              </Text>
            </View>

            {/* Period Selector */}
            <View style={styles.periodCard}>
              <Text style={styles.sectionTitle}>Période de prévision</Text>
              <View style={styles.forecastPeriodButtons}>
                <TouchableOpacity
                  style={[styles.forecastPeriodButton, forecastPeriod === 'week' && styles.forecastPeriodButtonActive]}
                  onPress={() => setForecastPeriod('week')}
                >
                  <Text style={[styles.forecastPeriodButtonText, forecastPeriod === 'week' && styles.forecastPeriodButtonTextActive]}>
                    1 semaine
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.forecastPeriodButton, forecastPeriod === 'month' && styles.forecastPeriodButtonActive]}
                  onPress={() => setForecastPeriod('month')}
                >
                  <Text style={[styles.forecastPeriodButtonText, forecastPeriod === 'month' && styles.forecastPeriodButtonTextActive]}>
                    1 mois
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.forecastPeriodButton, forecastPeriod === '3months' && styles.forecastPeriodButtonActive]}
                  onPress={() => setForecastPeriod('3months')}
                >
                  <Text style={[styles.forecastPeriodButtonText, forecastPeriod === '3months' && styles.forecastPeriodButtonTextActive]}>
                    3 mois
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forecasts List */}
            <View style={styles.forecastsCard}>
              <Text style={styles.sectionTitle}>Quantités suggérées {
                forecastPeriod === 'week' ? 'pour 1 semaine' : 
                forecastPeriod === 'month' ? 'pour 1 mois' : 
                'pour 3 mois'
              }</Text>
              
              {forecasts.length === 0 ? (
                <Text style={styles.emptyText}>Aucune donnée de vente disponible</Text>
              ) : (
                forecasts.map((forecast) => {
                  const suggestedQuantity = forecastPeriod === 'week' ? Math.ceil(forecast.averagePerWeek) :
                                           forecastPeriod === 'month' ? Math.ceil(forecast.averagePerWeek * 4) :
                                           Math.ceil(forecast.averagePerWeek * 12);
                  
                  return (
                    <View key={forecast.productId} style={styles.forecastItem}>
                      <View style={styles.forecastHeader}>
                        <Text style={styles.forecastProductName}>{forecast.productName}</Text>
                        <View style={styles.suggestedBadge}>
                          <Text style={styles.suggestedQuantity}>{suggestedQuantity}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.statsRowForecast}>
                        <View style={styles.statItem}>
                          <Text style={styles.statLabelSmall}>Vendus (30j)</Text>
                          <Text style={styles.statValueSmall}>{forecast.totalSold}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statLabelSmall}>Moy/jour</Text>
                          <Text style={styles.statValueSmall}>{forecast.averagePerDay.toFixed(1)}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statLabelSmall}>Moy/semaine</Text>
                          <Text style={styles.statValueSmall}>{forecast.averagePerWeek.toFixed(1)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* Orders Tab Content */}
        {activeTab === 'orders' && (
          <>
            {/* Filter and View Mode */}
            <View style={styles.ordersHeader}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                <View style={styles.filters}>
                  <TouchableOpacity 
                    style={styles.manageOrdersButton}
                    onPress={onOpenOrdersManagement}
                  >
                    <Text style={styles.manageOrdersButtonText}>Gérer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
                    onPress={() => setSelectedFilter('all')}
                  >
                    <Text style={[styles.filterButtonText, selectedFilter === 'all' && styles.filterButtonTextActive]}>
                      Toutes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, selectedFilter === 'En préparation' && styles.filterButtonActive]}
                    onPress={() => setSelectedFilter('En préparation')}
                  >
                    <Text style={[styles.filterButtonText, selectedFilter === 'En préparation' && styles.filterButtonTextActive]}>
                      En préparation
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, selectedFilter === 'À récupérer' && styles.filterButtonActive]}
                    onPress={() => setSelectedFilter('À récupérer')}
                  >
                    <Text style={[styles.filterButtonText, selectedFilter === 'À récupérer' && styles.filterButtonTextActive]}>
                      À récupérer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, selectedFilter === 'Terminé' && styles.filterButtonActive]}
                    onPress={() => setSelectedFilter('Terminé')}
                  >
                    <Text style={[styles.filterButtonText, selectedFilter === 'Terminé' && styles.filterButtonTextActive]}>
                      Terminé
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            {/* Orders List */}
            <View style={styles.ordersContainer}>
              {getFilteredOrders().length === 0 ? (
                <Text style={styles.emptyText}>Aucune commande</Text>
              ) : (
                getFilteredOrders().map(order => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View>
                        <Text style={styles.orderUser}>{formatUserName(order)}</Text>
                        {order.orderNumber && (
                          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                        )}
                        {order.pickupTime && (
                          <View style={styles.orderPickupTimeRow}>
                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                            <Text style={styles.orderPickupTime}>{order.pickupTime}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.orderDate}>
                        {order.createdAt?.toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    
                    <View style={styles.orderItems}>
                      {order.items.map((item, idx) => (
                        <View key={idx} style={styles.orderItemContainer}>
                          {item.isComboOffer ? (
                            <>
                              <View style={styles.comboItemHeader}>
                                <Text style={styles.orderItemText}>
                                  {item.quantity}x {item.comboTitle || item.name}
                                </Text>
                                {item.comboDiscount && (
                                  <View style={styles.comboItemBadge}>
                                    <Text style={styles.comboItemBadgeText}>-{item.comboDiscount}%</Text>
                                  </View>
                                )}
                              </View>
                              {item.comboProducts && item.comboProducts.length > 0 && (
                                <View style={styles.comboItemProducts}>
                                  {item.comboProducts.map((product, pIdx) => (
                                    <Text key={pIdx} style={styles.comboItemProductText}>
                                      • {product.name}
                                    </Text>
                                  ))}
                                </View>
                              )}
                            </>
                          ) : (
                            <>
                              <Text style={styles.orderItemText}>
                                {item.quantity}x {item.name}
                              </Text>
                              {item.customizations && item.customizations.length > 0 && (
                                <View style={styles.customizationsContainer}>
                                  {item.customizations.map((customization, customIdx) => (
                                    <Text key={customIdx} style={styles.customizationText}>
                                      {customization}
                                    </Text>
                                  ))}
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      ))}
                    </View>

                    <View style={styles.orderFooter}>
                      <Text style={styles.orderTotal}>{order.total.toFixed(2)}€</Text>
                      <View style={styles.statusActions}>
                        <TouchableOpacity
                          style={[styles.statusBadge, { backgroundColor: getStatusStyle(order.status).backgroundColor }]}
                          onPress={() => {
                            const statuses = ['En préparation', 'À récupérer', 'Terminé'];
                            const currentIndex = statuses.indexOf(order.status);
                            const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                            updateOrderStatus(order.id, order.userId, nextStatus);
                          }}
                        >
                          <Text style={[styles.statusBadgeText, { color: getStatusStyle(order.status).color }]}>
                            {order.status}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* Products Tab Content */}
        {activeTab === 'products' && (
          <>
            {productsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2cbefb" />
              </View>
            ) : (
              <>
                {/* Products Header */}
                <View style={styles.productsHeader}>
                  <View style={styles.productsHeaderLeft}>
                    <Text style={styles.productsTitle}>Mes Produits</Text>
                    <Text style={styles.productsSubtitle}>{products.length} produit{products.length > 1 ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.addProductButton}
                    onPress={onAddNewProduct}
                  >
                    <Text style={styles.addProductButtonIcon}>+</Text>
                    <Text style={styles.addProductButtonText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>

                {/* Category Filter */}
                <View style={styles.categoryFilterContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryFilterScrollView}
                    contentContainerStyle={styles.categoryFilterContent}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'all' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('all')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'all' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Tous
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'sandwich-chaud' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('sandwich-chaud')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'sandwich-chaud' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Sandwichs chauds
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'sandwich-froid' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('sandwich-froid')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'sandwich-froid' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Sandwichs froids
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'pasta' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('pasta')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'pasta' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Pâtes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'salade' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('salade')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'salade' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Salades
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'snack' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('snack')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'snack' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Snacks
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryFilterButton,
                        selectedCategoryFilter === 'drink' && styles.categoryFilterButtonActive,
                      ]}
                      onPress={() => setSelectedCategoryFilter('drink')}
                    >
                      <Text style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === 'drink' && styles.categoryFilterButtonTextActive,
                      ]}>
                        Boissons
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* Products List */}
                <ScrollView style={styles.productsScrollContainer}>
                  <View style={styles.productsContainer}>
                    {(() => {
                      const filteredProducts = selectedCategoryFilter === 'all' 
                        ? products 
                        : products.filter(p => p.category === selectedCategoryFilter);
                      
                      if (filteredProducts.length === 0) {
                        return (
                          <View style={styles.emptyStateContainer}>
                            <Ionicons name="cube-outline" size={48} color="#9CA3AF" style={styles.emptyStateIcon} />
                            <Text style={styles.emptyStateText}>
                              {selectedCategoryFilter === 'all' ? 'Aucun produit' : 'Aucun produit dans cette catégorie'}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                              {selectedCategoryFilter === 'all' ? 'Ajoutez votre premier produit' : 'Essayez une autre catégorie'}
                            </Text>
                          </View>
                        );
                      }
                      
                      return filteredProducts.map(product => (
                        <View key={product.id} style={styles.productCard}>
                          {/* Category Badge */}
                          <View style={styles.productCategoryBadge}>
                            <Ionicons
                              name={
                                product.category === 'sandwich-chaud' ? 'flame-outline' :
                                product.category === 'sandwich-froid' ? 'fast-food-outline' :
                                product.category === 'pasta' ? 'restaurant-outline' :
                                product.category === 'drink' ? 'cafe-outline' :
                                product.category === 'salade' ? 'leaf-outline' :
                                'nutrition-outline'
                              }
                              size={20}
                              color="#00BCD4"
                            />
                          </View>

                          {/* Product Main Info */}
                          <View style={styles.productMainContent}>
                            <View style={styles.productHeader}>
                              <View style={styles.productTitleSection}>
                                <Text style={styles.productName}>{product.name}</Text>
                                <Text style={styles.productCategoryLabel}>
                                  {product.category === 'sandwich-chaud' ? 'Sandwichs chauds' :
                                   product.category === 'sandwich-froid' ? 'Sandwichs froids' :
                                   product.category === 'pasta' ? 'Pâtes' :
                                   product.category === 'drink' ? 'Boissons' :
                                   product.category === 'salade' ? 'Salades' :
                                   'Snacks'}
                                </Text>
                              </View>
                              <View style={styles.productPriceContainer}>
                                <Text style={styles.productPrice}>{product.price.toFixed(2)}€</Text>
                              </View>
                            </View>

                            <Text style={styles.productDescription} numberOfLines={2}>
                              {product.description}
                            </Text>

                            {/* Product Actions */}
                            <View style={styles.productActions}>
                              <TouchableOpacity
                                style={[
                                  styles.availabilityButton,
                                  product.available !== false && styles.availabilityButtonActive
                                ]}
                                onPress={() => handleToggleAvailability(product.id, product.available !== false)}
                              >
                                <View style={styles.availabilityIndicator}>
                                  <View style={[
                                    styles.availabilityDot,
                                    product.available !== false && styles.availabilityDotActive
                                  ]} />
                                  <Text style={[
                                    styles.availabilityButtonText,
                                    product.available !== false && styles.availabilityButtonTextActive
                                  ]}>
                                    {product.available !== false ? 'Disponible' : 'Indisponible'}
                                  </Text>
                                </View>
                              </TouchableOpacity>

                              <View style={styles.productActionButtons}>
                                <TouchableOpacity
                                  style={styles.editButton}
                                  onPress={() => onEditProduct(product)}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="pencil-outline" size={16} color="#1A1A2E" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.deleteButton}
                                  onPress={() => handleDeleteProduct(product.id, product.name)}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </View>
                      ));
                    })()}
                  </View>
                </ScrollView>
              </>
            )}
          </>
        )}

        {/* Offers Tab Content */}
        {activeTab === 'offers' && (
          <OffersManagementPage 
            offers={offers}
            onOffersUpdate={loadOffers}
          />
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <View style={styles.settingsContainer}>
            <View style={styles.settingsCard}>
              <View style={styles.settingsHeader}>
                <Text style={styles.settingsTitle}>Statut de la cafétéria</Text>
              </View>
              
              <View style={styles.settingsContent}>
                <View style={styles.statusBadgeContainer}>
                  <View style={[styles.statusBadge, cafeteriaOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
                    <Text style={styles.statusBadgeText}>
                      {cafeteriaOpen ? 'OUVERTE' : 'FERMÉE'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.settingsDescription}>
                  {cafeteriaOpen 
                    ? 'Les clients peuvent actuellement passer des commandes.' 
                    : 'Les clients ne peuvent pas passer de commandes.'}
                </Text>

                <TouchableOpacity 
                  style={[styles.toggleButton, !cafeteriaOpen && styles.toggleButtonActive, savingStatus && styles.toggleButtonDisabled]}
                  onPress={toggleCafeteriaStatus}
                  disabled={savingStatus}
                >
                  {savingStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.toggleButtonText}>
                      {cafeteriaOpen ? 'Fermer la cafétéria' : 'Ouvrir la cafétéria'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>ℹ️ Information</Text>
              <Text style={styles.infoBoxText}>
                Quand la cafétéria est fermée, les clients verront un message d'indisponibilité et ne pourront pas passer de commandes.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: Platform.select({ ios: -12, android: -1, default: -15 }) }],
  },
  backButtonText: {
    fontSize: 32,
    color: '#2cbefb',
    fontWeight: '500',
    lineHeight: 32,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
      },
    }),
  },
  title: {
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  tabsContainer: {
    flexGrow: 0,
    paddingTop: 16,
  },
  tabs: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#2cbefb',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabTextActive: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statGrowth: {
    fontSize: 12,
    color: '#dc2626',
  },
  statGrowthPositive: {
    color: '#16a34a',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    minWidth: 150,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  periodButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  periodButtonActive: {
    backgroundColor: '#2cbefb',
  },
  periodButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
  chart: {
    flexDirection: 'row',
    height: 200,
  },
  chartYAxis: {
    width: 40,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  chartLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: '#2cbefb',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartXAxis: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  chartXLabel: {
    flex: 1,
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBadgeGreen: {
    backgroundColor: '#bbf7d0',
  },
  actionBadgeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  managementButtons: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  managementButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  managementButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  // Forecast styles
  infoCard: {
    backgroundColor: '#e0f2fe',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#075985',
    lineHeight: 20,
  },
  periodCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  forecastPeriodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  forecastPeriodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastPeriodButtonActive: {
    backgroundColor: '#2cbefb',
  },
  forecastPeriodButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  forecastPeriodButtonTextActive: {
    color: '#ffffff',
  },
  forecastsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
  forecastItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  forecastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  forecastProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  suggestedBadge: {
    backgroundColor: '#2cbefb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  suggestedQuantity: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  statsRowForecast: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  statLabelSmall: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValueSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  comingSoonCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 48,
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  comingSoonSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  // Orders tab styles
  ordersHeader: {
    paddingVertical: 12,
  },
  manageOrdersButton: {
    backgroundColor: '#2cbefb',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  manageOrdersButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#2cbefb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  // Products tab styles
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productsHeaderLeft: {
    flex: 1,
  },
  productsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  productsSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2cbefb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#2cbefb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addProductButtonIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  addProductButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  categoryFilterContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryFilterScrollView: {
    maxHeight: 50,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  categoryFilterButtonActive: {
    backgroundColor: '#2cbefb',
    borderColor: '#2cbefb',
  },
  categoryFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  categoryFilterButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  productsScrollContainer: {
    flex: 1,
  },
  productsContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  productCard: {
    backgroundColor: '#ffffff',
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  productCategoryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  productCategoryIcon: {
    fontSize: 24,
  },
  productMainContent: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 50,
  },
  productTitleSection: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  productCategoryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productPriceContainer: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2cbefb',
  },
  productDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  availabilityButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fde68a',
  },
  availabilityButtonActive: {
    backgroundColor: '#bbf7d0',
    borderColor: '#86efac',
  },
  availabilityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  availabilityDotActive: {
    backgroundColor: '#22c55e',
  },
  availabilityButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  availabilityButtonTextActive: {
    color: '#166534',
  },
  productActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  editButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  deleteButtonText: {
    fontSize: 20,
  },
  ordersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2cbefb',
    marginTop: 2,
  },
  orderPickupTime: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  orderPickupTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  orderDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderItems: {
    marginBottom: 12,
  },
  orderItemContainer: {
    marginBottom: 4,
  },
  orderItemText: {
    fontSize: 14,
    color: '#4b5563',
  },
  customizationsContainer: {
    marginTop: 4,
    marginLeft: 16,
  },
  customizationText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  comboItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comboItemBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comboItemBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  comboItemProducts: {
    marginTop: 4,
    marginLeft: 16,
  },
  comboItemProductText: {
    fontSize: 11,
    color: '#6b7280',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingsContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  settingsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  settingsContent: {
    padding: 20,
  },
  statusBadgeContainer: {
    marginBottom: 16,
  },
  statusBadgeOpen: {
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusBadgeClosed: {
    backgroundColor: '#fecaca',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  toggleButton: {
    backgroundColor: '#2cbefb',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#ef4444',
  },
  toggleButtonDisabled: {
    opacity: 0.6,
  },
  toggleButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1e3a8a',
    lineHeight: 18,
  },
});

