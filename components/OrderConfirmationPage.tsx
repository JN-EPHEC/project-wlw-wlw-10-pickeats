import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CartItem, TimeSlot } from '../types';
import { ProductImageDisplay } from './ProductImageDisplay';

type OrderConfirmationPageProps = {
  cart: CartItem[];
  timeSlot: TimeSlot;
  onNewOrder: () => void;
  total?: number; // Total final avec bon appliqué
};

// Liste des suppléments disponibles pour les sandwiches
const sandwichSupplements = [
  { name: 'Légumes', price: 0.50 },
  { name: 'Œuf', price: 1.00 },
  { name: 'Dinde fumée', price: 1.00 },
  { name: 'Tortilla', price: 2.00 },
];

// Calculer le prix total d'un article du panier (incluant les suppléments et offres combinées)
const calculateItemPrice = (item: CartItem): number => {
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
  
  return price;
};

export function OrderConfirmationPage({
  cart,
  timeSlot,
  onNewOrder,
  total: providedTotal,
}: OrderConfirmationPageProps) {
  // Utiliser le total fourni ou calculer le total si non fourni
  const subtotal = cart.reduce(
    (sum, item) => sum + calculateItemPrice(item) * item.quantity,
    0
  );
  const total = providedTotal !== undefined ? providedTotal : subtotal;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={72} color="#00BCD4" />
      </View>

      <Text style={styles.title}>Commande confirmée !</Text>
      <Text style={styles.subtitle}>
        Votre commande a été enregistrée avec succès
      </Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Heure de retrait</Text>
          <Text style={styles.infoValue}>{timeSlot.time}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total</Text>
          <Text style={styles.infoValueHighlight}>{total.toFixed(2)} €</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Récapitulatif de votre commande</Text>
        {cart.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            {item.isComboOffer && item.comboProducts ? (
              <>
                <View style={styles.comboIconContainer}>
                  <Ionicons name="gift-outline" size={24} color="#00BCD4" />
                </View>
                <View style={styles.itemDetails}>
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
                  <Text style={styles.itemQuantity}>Quantité: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  {(calculateItemPrice(item) * item.quantity).toFixed(2)} €
                </Text>
              </>
            ) : (
              <>
                <ProductImageDisplay imageUrl={item.product.image} size={40} />
                <View style={styles.itemDetails}>
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
                  <Text style={styles.itemQuantity}>Quantité: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  {(calculateItemPrice(item) * item.quantity).toFixed(2)} €
                </Text>
              </>
            )}
          </View>
        ))}
      </View>

      <View style={styles.instructions}>
        <View style={styles.instructionsHeader}>
          <Ionicons name="location-outline" size={16} color="#92400e" />
          <Text style={styles.instructionsTitle}>Instructions</Text>
        </View>
        <Text style={styles.instructionsText}>
          • Rendez-vous à la cafétéria{'\n'}
          • Présentez-vous au comptoir à {timeSlot.time}{'\n'}
          • Récupérez votre commande
        </Text>
      </View>

      <TouchableOpacity style={styles.newOrderButton} onPress={onNewOrder} activeOpacity={0.85}>
        <Text style={styles.newOrderButtonText}>Nouvelle commande</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
    alignItems: 'center',
  },
  successIcon: {
    marginVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 4,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: '#0e7490',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0e7490',
  },
  infoValueHighlight: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0891b2',
  },
  divider: {
    height: 1,
    backgroundColor: '#a5f3fc',
    marginVertical: 16,
  },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  itemIcon: {
    fontSize: 32,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  customizationsContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  customizationText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ACC1',
  },
  instructions: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 4,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  instructionsText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 22,
  },
  newOrderButton: {
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
  newOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Styles pour les offres combinées
  comboIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comboIcon: {
    fontSize: 24,
  },
  comboTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  comboDiscountBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comboDiscountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  comboProductsList: {
    marginVertical: 4,
    gap: 2,
  },
  comboProductItem: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 14,
  },
});
