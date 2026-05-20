import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { CartItem, TimeSlot } from '../types';
import { ProductImageDisplay } from './ProductImageDisplay';

type CartPageProps = {
  cart: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onPlaceOrder: (timeSlot: TimeSlot) => Promise<void>;
  onBack: () => void;
  availableVouchers?: number;
  activeOffers?: Array<{ id: string; discount: number; productIds?: string[] }>;
};

const availableTimeSlots: TimeSlot[] = [
  { id: '3', time: '11:45', available: 8 },
  { id: '4', time: '12:00', available: 8 },
  { id: '5', time: '12:15', available: 12 },
  { id: '6', time: '12:30', available: 12 },
  { id: '7', time: '12:45', available: 15 },
  { id: '8', time: '13:00', available: 15 },
  { id: '9', time: '13:15', available: 10 },
  { id: '10', time: '13:30', available: 10 },
  { id: '11', time: '13:45', available: 12 },
  { id: '12', time: '14:00', available: 12 },
  { id: '13', time: '14:15', available: 8 },
  { id: '14', time: '14:30', available: 8 },
  { id: '15', time: '14:45', available: 10 },
  { id: '16', time: '15:00', available: 10 },
];

// Liste des suppléments disponibles pour les sandwiches
const sandwichSupplements = [
  { name: 'Légumes', price: 0.50 },
  { name: 'Œuf', price: 1.00 },
  { name: 'Dinde fumée', price: 1.00 },
  { name: 'Tortilla', price: 2.00 },
];

// Calculer le prix total d'un article du panier (incluant les suppléments et promotions)
const calculateItemPrice = (item: CartItem, activeOffers: Array<{ id: string; discount: number; productIds?: string[] }> = []): number => {
  // Si c'est une offre combinée, calculer le prix total de tous les produits avec réduction
  if (item.isComboOffer && item.comboProducts && item.comboDiscount !== undefined) {
    const totalComboPrice = item.comboProducts.reduce((sum, product) => sum + product.price, 0);
    const discountAmount = (totalComboPrice * item.comboDiscount) / 100;
    return Math.max(0, totalComboPrice - discountAmount);
  }
  
  let price = item.product.price;
  
  // Vérifier si c'est un sandwich et si des suppléments sont présents
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
  
  return Math.max(0, price);
};

export function CartPage({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  onBack,
  availableVouchers = 0,
  activeOffers = [],
}: CartPageProps) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [cafeteriaOpen, setCafeteriaOpen] = useState(true);

  const subtotal = cart.reduce(
    (sum, item) => sum + calculateItemPrice(item, activeOffers) * item.quantity,
    0
  );

  // Appliquer le bon de réduction (seulement si commande >= 5€)
  const discount = (availableVouchers > 0 && subtotal >= 5) ? 5 : 0;
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
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

  const handlePlaceOrder = async () => {
    if (!cafeteriaOpen) {
      Alert.alert('Cafétéria fermée', 'Les commandes ne peuvent pas être passées en ce moment. Veuillez réessayer plus tard.');
      return;
    }

    if (!showTimeSlots) {
      // Première étape : afficher les créneaux
      setShowTimeSlots(true);
      return;
    }

    if (!selectedTimeSlot) {
      Alert.alert('Erreur', 'Veuillez sélectionner un créneau horaire');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Erreur', 'Votre panier est vide');
      return;
    }

    setIsSubmitting(true);
    try {
      await onPlaceOrder(selectedTimeSlot);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de passer la commande. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mon Panier</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#9CA3AF" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>Votre panier est vide</Text>
          <TouchableOpacity style={styles.shopButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.shopButtonText}>Commencer mes achats</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mon Panier</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Articles ({cart.length})</Text>
          {cart.map((item) => (
            <View key={item.id} style={styles.cartItem}>
              {item.isComboOffer && item.comboProducts ? (
                // Affichage pour les offres combinées
                <>
                  <View style={styles.comboIconContainer}>
                    <Ionicons name="gift-outline" size={28} color="#00BCD4" />
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.comboTitleContainer}>
                      <Text style={styles.itemName}>{item.comboTitle || item.product.name}</Text>
                      <View style={styles.comboDiscountBadge}>
                        <Text style={styles.comboDiscountText}>-{item.comboDiscount}%</Text>
                      </View>
                    </View>
                    <View style={styles.comboProductsList}>
                      {item.comboProducts.map((product, index) => (
                        <Text key={index} style={styles.comboProductItem}>
                          • {product.name}
                        </Text>
                      ))}
                    </View>
                    <Text style={styles.itemPrice}>{calculateItemPrice(item, activeOffers).toFixed(2)} €</Text>
                  </View>
                  <View style={styles.rightSection}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => onRemoveItem(item.id)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // Affichage pour les produits normaux
                <>
                  <ProductImageDisplay imageUrl={item.product.image} size={50} category={item.product.category} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    {item.customizations && item.customizations.length > 0 && (
                      <View style={styles.customizationsContainer}>
                        {item.customizations.map((customization, index) => (
                          <Text key={index} style={styles.customizationText}>
                            {customization}
                          </Text>
                        ))}
                      </View>
                    )}
                    <Text style={styles.itemPrice}>{calculateItemPrice(item, activeOffers).toFixed(2)} €</Text>
                  </View>
                  <View style={styles.rightSection}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => onRemoveItem(item.id)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>

        {!cafeteriaOpen && (
          <View style={styles.closedWarning}>
            <Ionicons name="lock-closed-outline" size={16} color="#DC2626" />
            <Text style={styles.closedWarningText}>
              La cafétéria est actuellement fermée. Les commandes sont désactivées.
            </Text>
          </View>
        )}

        <View style={styles.totalSection}>
          {discount > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Sous-total</Text>
                <Text style={styles.totalAmountSub}>{subtotal.toFixed(2)} €</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.discountLabel}>Bon de réduction (-5€)</Text>
                <Text style={styles.discountAmount}>-{discount.toFixed(2)} €</Text>
              </View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.orderButton, (isSubmitting || !cafeteriaOpen) && styles.orderButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={isSubmitting || !cafeteriaOpen}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.orderButtonText}>
              {showTimeSlots ? (selectedTimeSlot ? 'Procéder au paiement' : 'Sélectionner un créneau') : 'Valider la commande'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal pour les créneaux horaires */}
      <Modal
        visible={showTimeSlots}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeSlots(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTimeSlots(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={20} color="#1A1A2E" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Choisissez votre créneau</Text>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.timeSlotsGrid}>
                {availableTimeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.timeSlotButton,
                      selectedTimeSlot?.id === slot.id && styles.timeSlotSelected,
                    ]}
                    onPress={() => setSelectedTimeSlot(slot)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.timeSlotTime,
                        selectedTimeSlot?.id === slot.id && styles.timeSlotTextSelected,
                      ]}
                    >
                      {slot.time}
                    </Text>
                    <Text
                      style={[
                        styles.timeSlotAvailable,
                        selectedTimeSlot?.id === slot.id && styles.timeSlotTextSelected,
                      ]}
                    >
                      {slot.available} places
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmButton, !selectedTimeSlot && styles.modalConfirmButtonDisabled]}
              onPress={() => {
                if (selectedTimeSlot) {
                  setShowTimeSlots(false);
                  handlePlaceOrder();
                }
              }}
              disabled={!selectedTimeSlot}
              activeOpacity={0.85}
            >
              <Text style={styles.modalConfirmButtonText}>
                {selectedTimeSlot ? 'Confirmer' : 'Sélectionner un créneau'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    borderWidth: 0,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  itemIcon: {
    fontSize: 32,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 20,
  },
  itemPrice: {
    fontSize: 17,
    color: '#2cbefb',
    marginTop: 8,
    fontWeight: '700',
  },
  customizationsContainer: {
    marginTop: 4,
    marginBottom: 6,
  },
  customizationText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 16,
  },
  quantity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 18,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    width: '31%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeSlotSelected: {
    backgroundColor: '#2cbefb',
    borderColor: '#2cbefb',
    shadowColor: '#2cbefb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timeSlotTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  timeSlotAvailable: {
    fontSize: 12,
    color: '#6b7280',
  },
  timeSlotTextSelected: {
    color: '#ffffff',
  },
  totalSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  totalAmountSub: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  discountLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#059669',
  },
  discountAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2cbefb',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  orderButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    borderWidth: 0,
  },
  orderButtonDisabled: {
    backgroundColor: '#00BCD4',
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxHeight: '80%',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalConfirmButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    borderWidth: 0,
    marginTop: 16,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#00BCD4',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  closedWarningText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  // Styles pour les offres combinées
  comboIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comboIcon: {
    fontSize: 28,
  },
  comboTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  comboDiscountBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comboDiscountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  comboProductsList: {
    marginVertical: 4,
    gap: 2,
  },
  comboProductItem: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
});
