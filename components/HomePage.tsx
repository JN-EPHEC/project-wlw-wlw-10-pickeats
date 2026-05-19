import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '@/firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import type { Product } from '@/types';
import { ProductImageDisplay } from './ProductImageDisplay';

type HomePageProps = {
  onCategorySelect: (category: 'sandwich-chaud' | 'sandwich-froid' | 'pasta' | 'drink' | 'snack' | 'salade') => void;
  user?: FirebaseUser | null;
  onAddToCart?: (product: any, customizations?: string[], comboData?: {
    isComboOffer: boolean;
    comboProducts: any[];
    comboTitle: string;
    comboDiscount: number;
  }) => void;
};

type Offer = {
  id: string;
  title: string;
  description: string;
  discount: number;
  badge: 'Promo' | 'Nouveau';
  active: boolean;
  productIds?: string[];
};

const PROMOTIONS_CACHE_KEY = '@pickeats_promotions';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const categories = [
  {
    id: 'sandwich-chaud' as const,
    name: 'Sandwichs chauds',
    icon: '🥪',
    description: 'Chauds et savoureux',
    bgColor: '#fff4ed',
  },
  {
    id: 'sandwich-froid' as const,
    name: 'Sandwichs froids',
    icon: '🥪',
    description: 'Frais et personnalisables',
    bgColor: '#fff4ed',
  },
  {
    id: 'pasta' as const,
    name: 'Pâtes',
    icon: '🍝',
    description: 'Chauds et gourmands',
    bgColor: '#fee2e2',
  },
  {
    id: 'salade' as const,
    name: 'Salades',
    icon: '🥗',
    description: 'Fraîches et équilibrées',
    bgColor: '#dcfce7',
  },
  {
    id: 'snack' as const,
    name: 'Snacks',
    icon: '🍪',
    description: 'Pour les petites faims',
    bgColor: '#f3e8ff',
  },
  {
    id: 'drink' as const,
    name: 'Boissons',
    icon: '☕',
    description: 'Chaudes et froides',
    bgColor: '#dbeafe',
  },
];

export function HomePage({ onCategorySelect, user, onAddToCart }: HomePageProps) {
  const [promotions, setPromotions] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [cafeteriaOpen, setCafeteriaOpen] = useState(true);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [promoProducts, setPromoProducts] = useState<Product[]>([]);
  const [currentPromo, setCurrentPromo] = useState<Offer | null>(null);

  useEffect(() => {
    loadPromotions();
    loadCafeteriaStatus();
  }, []);

  const loadCafeteriaStatus = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'cafeteria');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        setCafeteriaOpen(settingsDoc.data().open ?? true);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du statut de la cafétéria:', error);
    }
  };

  const loadPromotions = async () => {
    try {
      // 1. Charger depuis le cache immédiatement
      const cachedData = await AsyncStorage.getItem(PROMOTIONS_CACHE_KEY);
      if (cachedData) {
        const { promotions: cachedPromotions, timestamp } = JSON.parse(cachedData);
        const cacheAge = Date.now() - timestamp;
        
        // Afficher le cache immédiatement
        setPromotions(cachedPromotions);
        setLoading(false);
        
        // Si le cache est encore valide, ne pas recharger
        if (cacheAge < CACHE_DURATION) {
          return;
        }
      }
      
      // 2. Charger depuis Firestore en arrière-plan
      const offersRef = doc(db, 'settings', 'promotions');
      const offersDoc = await getDoc(offersRef);
      
      if (offersDoc.exists()) {
        const data = offersDoc.data();
        const activeOffers = (data.offers || []).filter((offer: Offer) => offer.active);
        
        // Mettre à jour l'état
        setPromotions(activeOffers);
        
        // Sauvegarder dans le cache
        await AsyncStorage.setItem(
          PROMOTIONS_CACHE_KEY,
          JSON.stringify({
            promotions: activeOffers,
            timestamp: Date.now(),
          })
        );
      }
    } catch (error) {
      console.error('Erreur lors du chargement des promotions:', error);
      // En cas d'erreur, garder les promotions du cache si disponibles
    } finally {
      setLoading(false);
    }
  };
  const getUserName = () => {
    if (user?.displayName) {
      return user.displayName.split(' ')[0]; // Prénom seulement
    }
    if (user?.email) {
      return user.email.split('@')[0]; // Partie avant @
    }
    return '';
  };

  const greeting = user ? `Bonjour ${getUserName()} ! 👋` : 'Bonjour ! 👋';

  const handlePromoClick = async (promo: Offer) => {
    if (!onAddToCart) {
      // Si pas de fonction onAddToCart, afficher l'info
      const discountText = promo.discount > 0 ? `\n\n🎉 Profitez de -${promo.discount}% de réduction !` : '';
      const message = `${promo.title}\n\n${promo.description}${discountText}`;
      
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(promo.title, `${promo.description}${discountText}`);
      }
      return;
    }

    // Si la promotion a des produits associés, afficher le modal de sélection
    if (promo.productIds && promo.productIds.length > 0) {
      try {
        // Récupérer chaque produit individuellement par son ID
        const productPromises = promo.productIds.map(productId => 
          getDoc(doc(db, 'products', productId))
        );
        const productSnapshots = await Promise.all(productPromises);
        
        const products = productSnapshots
          .filter(snapshot => snapshot.exists())
          .map(snapshot => ({
            id: snapshot.id,
            ...snapshot.data(),
          })) as Product[];

        // Filtrer les produits disponibles
        const availableProducts = products.filter(p => p.available !== false);

        if (availableProducts.length === 0) {
          Alert.alert('Information', 'Aucun produit disponible dans cette promotion.');
          return;
        }

        // Afficher le modal informatif de l'offre combinée
        setCurrentPromo(promo);
        setPromoProducts(availableProducts);
        setShowProductPicker(true);
      } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        Alert.alert('Erreur', 'Impossible de charger les produits de la promotion.');
      }
    } else {
      // Si pas de produits associés, afficher l'info
      const discountText = promo.discount > 0 ? `\n\n🎉 Profitez de -${promo.discount}% de réduction !` : '';
      const message = `${promo.title}\n\n${promo.description}${discountText}`;
      
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(promo.title, `${promo.description}${discountText}`);
      }
    }
  };

  const handleAddComboOffer = () => {
    if (!onAddToCart || promoProducts.length === 0 || !currentPromo) {
      return;
    }

    // Créer un "produit virtuel" qui représente l'offre combinée
    // On utilise le premier produit comme base
    const comboProduct = {
      ...promoProducts[0],
      id: `combo-${currentPromo.id}`,
      name: currentPromo.title,
      description: currentPromo.description,
    };

    // Ajouter l'offre combinée comme UN SEUL item au panier
    onAddToCart(comboProduct, undefined, {
      isComboOffer: true,
      comboProducts: promoProducts,
      comboTitle: currentPromo.title,
      comboDiscount: currentPromo.discount,
    });

    // Fermer le modal et réinitialiser
    setShowProductPicker(false);
    setPromoProducts([]);
    setCurrentPromo(null);

    Alert.alert(
      '🎉 Offre ajoutée !',
      `L'offre "${currentPromo.title}" a été ajoutée à votre panier.`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Closed Banner */}
      {!cafeteriaOpen && (
        <View style={styles.closedBanner}>
          <Text style={styles.closedBannerIcon}>🔒</Text>
          <Text style={styles.closedBannerTitle}>Cafétéria actuellement fermée</Text>
          <Text style={styles.closedBannerText}>Les commandes sont désactivées. Veuillez réessayer plus tard.</Text>
        </View>
      )}

      {/* Welcome Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{greeting}</Text>
        <Text style={styles.bannerSubtitle}>
          {cafeteriaOpen 
            ? 'Commandez maintenant et évitez la file d\'attente'
            : 'La cafétéria est actuellement fermée'}
        </Text>
        <View style={styles.pickupBadge}>
          <Text style={styles.pickupIcon}>🕐</Text>
          <Text style={styles.pickupText}>Retrait disponible dès 11h45</Text>
        </View>
      </View>

      {/* À la une Section */}
      {!loading && promotions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⭐</Text>
            <Text style={styles.sectionTitle}>À la une</Text>
          </View>

          {promotions.map((promo) => (
            <TouchableOpacity 
              key={promo.id} 
              style={styles.promoCard} 
              activeOpacity={0.7}
              onPress={() => handlePromoClick(promo)}
            >
              <View style={styles.promoContent}>
                <View style={styles.promoHeader}>
                  <Text style={styles.promoTitle}>{promo.title}</Text>
                  <View style={[styles.promoBadge, promo.badge === 'Nouveau' ? styles.newBadge : styles.discountBadge]}>
                    <Text style={styles.promoBadgeText}>{promo.badge}</Text>
                  </View>
                </View>
                <Text style={styles.promoDescription}>{promo.description}</Text>
                {promo.discount > 0 && (
                  <Text style={styles.promoDiscount}>-{promo.discount}%</Text>
                )}
              </View>
              <Text style={styles.promoArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.loadingPromo}>
          <Text style={styles.loadingText}>Chargement des offres...</Text>
        </View>
      )}

      {/* Categories Section */}
      <View style={styles.section}>
        <Text style={cafeteriaOpen ? styles.questionText : styles.disabledText}>
          {cafeteriaOpen ? 'Que souhaitez-vous commander ?' : 'Commandes indisponibles'}
        </Text>

        <View style={styles.grid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, !cafeteriaOpen && styles.categoryCardDisabled]}
              onPress={() => cafeteriaOpen && onCategorySelect(category.id)}
              activeOpacity={cafeteriaOpen ? 0.7 : 1}
              disabled={!cafeteriaOpen}
            >
              <View style={[styles.categoryIconContainer, { backgroundColor: category.bgColor }]}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
              </View>
              <Text style={[styles.categoryName, !cafeteriaOpen && styles.categoryNameDisabled]}>
                {category.name}
              </Text>
              <Text style={[styles.categoryDescription, !cafeteriaOpen && styles.categoryDescriptionDisabled]}>
                {category.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Modal de sélection de produits pour la promotion */}
      <Modal
        visible={showProductPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowProductPicker(false);
          setPromoProducts([]);
          setCurrentPromo(null);
        }}
      >
        <TouchableOpacity 
          style={styles.productPickerModalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowProductPicker(false);
            setPromoProducts([]);
            setCurrentPromo(null);
          }}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.productPickerModalContent}
          >
            <View style={styles.productPickerModalHeader}>
              <View style={styles.productPickerHeaderContent}>
                <Text style={styles.productPickerModalTitle}>
                  {currentPromo?.title || 'Offre combinée'}
                </Text>
                <Text style={styles.productPickerModalSubtitle}>
                  Cette offre comprend les produits suivants :
                </Text>
              </View>
              <TouchableOpacity
                style={styles.productPickerModalClose}
                onPress={() => {
                  setShowProductPicker(false);
                  setPromoProducts([]);
                  setCurrentPromo(null);
                }}
              >
                <Text style={styles.productPickerModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.productPickerModalScrollView}>
              {promoProducts.length === 0 ? (
                <View style={styles.productPickerLoading}>
                  <ActivityIndicator size="large" color="#2cbefb" />
                  <Text style={styles.productPickerLoadingText}>Chargement de l'offre...</Text>
                </View>
              ) : (
                promoProducts.map(product => (
                  <View
                    key={product.id}
                    style={styles.comboProductItem}
                  >
                    <View style={styles.comboCheckIcon}>
                      <Text style={styles.comboCheckmark}>✓</Text>
                    </View>
                    <ProductImageDisplay imageUrl={product.image} size={60} />
                    <View style={styles.comboProductContent}>
                      <Text style={styles.comboProductName}>{product.name}</Text>
                      {product.description && (
                        <Text style={styles.comboProductDescription} numberOfLines={2}>
                          {product.description}
                        </Text>
                      )}
                      <Text style={styles.comboProductPrice}>{product.price.toFixed(2)} €</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.productPickerModalFooter}>
              <View style={styles.comboPricingContainer}>
                <View style={styles.comboPricingRow}>
                  <Text style={styles.comboPricingLabel}>Total</Text>
                  <Text style={styles.comboPricingOriginal}>
                    {promoProducts.reduce((sum, p) => sum + p.price, 0).toFixed(2)} €
                  </Text>
                </View>
                {currentPromo && currentPromo.discount > 0 && (
                  <View style={styles.comboPricingRow}>
                    <Text style={styles.comboPricingDiscountLabel}>
                      Réduction -{currentPromo.discount}%
                    </Text>
                    <Text style={styles.comboPricingDiscount}>
                      -{(promoProducts.reduce((sum, p) => sum + p.price, 0) * currentPromo.discount / 100).toFixed(2)} €
                    </Text>
                  </View>
                )}
                <View style={[styles.comboPricingRow, styles.comboPricingTotalRow]}>
                  <Text style={styles.comboPricingTotalLabel}>Prix de l'offre</Text>
                  <Text style={styles.comboPricingTotal}>
                    {currentPromo 
                      ? (promoProducts.reduce((sum, p) => sum + p.price, 0) * (1 - currentPromo.discount / 100)).toFixed(2)
                      : promoProducts.reduce((sum, p) => sum + p.price, 0).toFixed(2)
                    } €
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.comboAddButton}
                onPress={handleAddComboOffer}
              >
                <Text style={styles.comboAddButtonText}>
                  🎉 Ajouter l'offre au panier
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    paddingBottom: 100,
  },
  banner: {
    backgroundColor: '#0891b2',
    padding: 24,
    margin: 16,
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  bannerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 18,
    opacity: 0.95,
    lineHeight: 22,
  },
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pickupIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  pickupText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.3,
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  promoContent: {
    flex: 1,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  promoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadge: {
    backgroundColor: '#dbeafe',
  },
  newBadge: {
    backgroundColor: '#dcfce7',
  },
  promoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  promoDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  promoDiscount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 8,
  },
  promoArrow: {
    fontSize: 20,
    color: '#2cbefb',
    marginLeft: 12,
  },
  questionText: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  categoryDescription: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  loadingPromo: {
    padding: 16,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  closedBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#fecaca',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  closedBannerIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  closedBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 4,
  },
  closedBannerText: {
    fontSize: 13,
    color: '#991b1b',
    textAlign: 'center',
  },
  disabledText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  categoryCardDisabled: {
    opacity: 0.5,
  },
  categoryNameDisabled: {
    color: '#d1d5db',
  },
  categoryDescriptionDisabled: {
    color: '#d1d5db',
  },
  // Styles pour le modal de sélection de produits
  productPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  productPickerModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  productPickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productPickerHeaderContent: {
    flex: 1,
    marginRight: 12,
  },
  productPickerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  productPickerModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  productPickerModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productPickerModalCloseText: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: '600',
  },
  productPickerModalScrollView: {
    maxHeight: '100%',
  },
  productPickerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  productPickerLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  comboProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  comboCheckIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comboCheckmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  comboProductContent: {
    flex: 1,
  },
  comboProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  comboProductDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  comboProductPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2cbefb',
  },
  productPickerModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  comboPricingContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  comboPricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comboPricingLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  comboPricingOriginal: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  comboPricingDiscountLabel: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  comboPricingDiscount: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  comboPricingTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    marginBottom: 0,
  },
  comboPricingTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  comboPricingTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2cbefb',
  },
  comboAddButton: {
    backgroundColor: '#2cbefb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2cbefb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  comboAddButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});
