import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Product } from '../types';
import { ProductImageDisplay } from './ProductImageDisplay';
import { useCategories } from '../hooks/use-categories';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const categoryPlaceholderIcons: Record<string, IoniconName> = {
  'sandwich-chaud': 'flame-outline',
  'sandwich-froid': 'fast-food-outline',
  pasta: 'restaurant-outline',
  drink: 'cafe-outline',
  snack: 'nutrition-outline',
  salade: 'leaf-outline',
};

type ProductsPageProps = {
  category: string;
  onAddToCart: (product: Product, customizations?: string[]) => void;
  onBack: () => void;
};

const fallbackCategoryNames: Record<string, string> = {
  'sandwich-chaud': 'Sandwichs chauds',
  'sandwich-froid': 'Sandwichs froids',
  pasta: 'Pâtes',
  drink: 'Boissons',
  snack: 'Snacks',
  salade: 'Salades',
};

// Liste des sauces disponibles pour les cornets de pâtes
const pastaSauces = [
  'Bolognaise',
  'Chef (crème tomate)',
  '4 Fromages',
  'Pili Pili (piquant)',
  'Carbonara',
  'Brocolis',
];

// Liste des crudités/suppléments disponibles pour les sandwiches
const sandwichSupplements = [
  { name: 'Légumes', price: 0.50 },
  { name: 'Œuf', price: 1.00 },
  { name: 'Dinde fumée', price: 1.00 },
  { name: 'Tortilla', price: 2.00 },
];

export function ProductsPage({ category, onAddToCart, onBack }: ProductsPageProps) {
  const { categories: dynamicCategories } = useCategories();
  const categoryLabel =
    dynamicCategories.find((c) => c.key === category)?.name ||
    fallbackCategoryNames[category] ||
    category;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customizationText, setCustomizationText] = useState('');
  const [selectedSauce, setSelectedSauce] = useState<string>('');
  const [showSaucePicker, setShowSaucePicker] = useState(false);
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [showSupplementsPicker, setShowSupplementsPicker] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [category]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'products'),
        where('category', '==', category)
      );
      const snapshot = await getDocs(q);
      const loadedProducts = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
      
      // Filtrer les produits disponibles côté client
      const availableProducts = loadedProducts.filter(p => p.available !== false);
      
      // Trier par prix (croissant)
      availableProducts.sort((a, b) => {
        return a.price - b.price;
      });
      
      setProducts(availableProducts);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      Alert.alert('Erreur', 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    const customizations: string[] = [];
    
    // Si c'est un cornet de pâtes, ajouter la sauce sélectionnée
    if (product.category === 'pasta' && selectedSauce) {
      customizations.push(`Sauce: ${selectedSauce}`);
    }
    
    // Si c'est un sandwich, ajouter les suppléments sélectionnés
    if ((product.category === 'sandwich-chaud' || product.category === 'sandwich-froid') && selectedSupplements.length > 0) {
      const supplementsText = selectedSupplements.join(', ');
      customizations.push(`Suppléments: ${supplementsText}`);
    }
    
    // Ajouter les autres personnalisations si présentes
    if (customizationText) {
      customizations.push(customizationText);
    }
    
    onAddToCart(product, customizations.length > 0 ? customizations : undefined);
    
    // Réinitialiser après ajout
    setCustomizationText('');
    setSelectedSauce('');
    setSelectedSupplements([]);
  };

  const handleAddFromModal = () => {
    if (selectedProduct) {
      handleAddToCart(selectedProduct);
      // Fermer la modal automatiquement après un court délai
      setTimeout(() => {
        setSelectedProduct(null);
        setSelectedSauce('');
        setSelectedSupplements([]);
        setCustomizationText('');
        setShowSaucePicker(false);
        setShowSupplementsPicker(false);
      }, 200);
    }
  };

  // Fonction pour réinitialiser les sélections quand le modal se ferme
  const resetModalState = () => {
    setSelectedSauce('');
    setSelectedSupplements([]);
    setCustomizationText('');
    setShowSaucePicker(false);
    setShowSupplementsPicker(false);
  };

  // Calculer le prix total avec suppléments
  const calculateTotalPrice = (product: Product | null): number => {
    if (!product) return 0;
    let total = product.price;
    
    if ((product.category === 'sandwich-chaud' || product.category === 'sandwich-froid') && selectedSupplements.length > 0) {
      selectedSupplements.forEach(supplementName => {
        const supplement = sandwichSupplements.find(s => s.name === supplementName);
        if (supplement) {
          total += supplement.price;
        }
      });
    }
    
    return total;
  };

  // Toggle sélection d'un supplément
  const toggleSupplement = (supplementName: string) => {
    setSelectedSupplements(prev => {
      if (prev.includes(supplementName)) {
        return prev.filter(name => name !== supplementName);
      } else {
        return [...prev, supplementName];
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{categoryLabel}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2cbefb" />
          <Text style={styles.loadingText}>Chargement des produits...</Text>
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
        <Text style={styles.title}>{categoryLabel}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Aucun produit disponible dans cette catégorie.
            </Text>
          </View>
        ) : (
          products.map((product, index) => {
            const isValidUrl = (() => {
              try { new URL(product.image); return true; } catch { return false; }
            })();
            return (
              <TouchableOpacity
                key={product.id}
                style={[styles.productCard, index !== products.length - 1 && styles.productCardSeparator]}
                onPress={() => setSelectedProduct(product)}
                activeOpacity={0.85}
              >
                {isValidUrl ? (
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons
                      name={categoryPlaceholderIcons[product.category] || 'restaurant-outline'}
                      size={28}
                      color="#00BCD4"
                    />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {product.description ? (
                    <Text style={styles.productDescription} numberOfLines={2}>
                      {product.description}
                    </Text>
                  ) : null}
                  <View style={styles.productFooter}>
                    <Text style={styles.productPrice}>{product.price.toFixed(2)} €</Text>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (product.customizable) {
                          setSelectedProduct(product);
                        } else {
                          handleAddToCart(product);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de détails du produit */}
      <Modal
        visible={selectedProduct !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          resetModalState();
          setSelectedProduct(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedProduct && (
              <>
                {/* Header compact */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <ProductImageDisplay imageUrl={selectedProduct.image} size={60} category={selectedProduct.category} />
                    <View style={styles.modalHeaderInfo}>
                      <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                      <Text style={styles.modalProductPrice}>
                        {calculateTotalPrice(selectedProduct).toFixed(2)} €
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                      resetModalState();
                      setSelectedProduct(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Contenu scrollable */}
                <ScrollView 
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  {selectedProduct.description && (
                    <Text style={styles.modalProductDescription}>
                      {selectedProduct.description}
                    </Text>
                  )}

                  {selectedProduct.customizable && (
                    <View style={styles.customizationContainer}>
                      {/* Sélecteur de sauce pour les cornets de pâtes */}
                      {selectedProduct.category === 'pasta' && (
                        <View style={styles.customizationSection}>
                          <Text style={styles.customizationLabel}>
                            Sauce * <Text style={styles.requiredText}>(requis)</Text>
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.optionButton,
                              selectedSauce && styles.optionButtonSelected
                            ]}
                            onPress={() => setShowSaucePicker(true)}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.optionButtonText,
                              selectedSauce && styles.optionButtonTextSelected
                            ]}>
                              {selectedSauce || 'Sélectionnez une sauce'}
                            </Text>
                            <Text style={[
                              styles.optionButtonArrow,
                              selectedSauce && styles.optionButtonArrowSelected
                            ]}>▼</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      {/* Sélecteur de suppléments pour les sandwiches */}
                      {(selectedProduct.category === 'sandwich-chaud' || selectedProduct.category === 'sandwich-froid') && (
                        <View style={styles.customizationSection}>
                          <Text style={styles.customizationLabel}>
                            Suppléments (optionnel)
                          </Text>
                          <TouchableOpacity
                            style={styles.optionButton}
                            onPress={() => setShowSupplementsPicker(true)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.optionButtonText}>
                              {selectedSupplements.length === 0 
                                ? 'Ajouter des suppléments' 
                                : `${selectedSupplements.length} sélectionné${selectedSupplements.length > 1 ? 's' : ''}`}
                            </Text>
                            <Text style={styles.optionButtonArrow}>▼</Text>
                          </TouchableOpacity>
                          {selectedSupplements.length > 0 && (
                            <View style={styles.selectedSupplementsList}>
                              {selectedSupplements.map(supplementName => {
                                const supplement = sandwichSupplements.find(s => s.name === supplementName);
                                return (
                                  <View key={supplementName} style={styles.selectedSupplementItem}>
                                    <Text style={styles.selectedSupplementItemText}>
                                      {supplementName}
                                    </Text>
                                    <Text style={styles.selectedSupplementItemPrice}>
                                      +{supplement?.price.toFixed(2)}€
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => toggleSupplement(supplementName)}
                                      style={styles.selectedSupplementRemoveButton}
                                      activeOpacity={0.85}
                                    >
                                      <Ionicons name="close" size={14} color="#6B7280" />
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      )}
                      
                      {/* Champ de personnalisation supplémentaire */}
                      <View style={styles.customizationSection}>
                        <Text style={styles.customizationLabel}>
                          Notes (optionnel)
                        </Text>
                        <TextInput
                          style={styles.customizationInput}
                          placeholder="Ex: Sans fromage, extra piquant..."
                          placeholderTextColor="#9ca3af"
                          value={customizationText}
                          onChangeText={setCustomizationText}
                          multiline
                          numberOfLines={3}
                          maxLength={200}
                        />
                        <Text style={styles.customizationHint}>
                          {customizationText.length}/200 caractères
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Footer fixe */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.modalAddButton,
                      selectedProduct.category === 'pasta' && !selectedSauce && styles.modalAddButtonDisabled,
                    ]}
                    onPress={handleAddFromModal}
                    activeOpacity={0.85}
                    disabled={selectedProduct.category === 'pasta' && !selectedSauce}
                  >
                    <Text style={styles.modalAddButtonText}>
                      {selectedProduct.category === 'pasta' && !selectedSauce
                        ? 'Sélectionnez une sauce'
                        : `Ajouter • ${calculateTotalPrice(selectedProduct).toFixed(2)}€`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal pour le sélecteur de sauce */}
      <Modal
        visible={showSaucePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaucePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSaucePicker(false)}
        >
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Choisissez votre sauce</Text>
            <ScrollView style={styles.pickerModalScrollView}>
              {pastaSauces.map((sauce) => (
                <TouchableOpacity
                  key={sauce}
                  style={styles.pickerOption}
                  onPress={() => {
                    setSelectedSauce(sauce);
                    setShowSaucePicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerOptionText}>{sauce}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerModalCancel}
              onPress={() => setShowSaucePicker(false)}
            >
              <Text style={styles.pickerModalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal pour le sélecteur de suppléments */}
      <Modal
        visible={showSupplementsPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupplementsPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSupplementsPicker(false)}
        >
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Sélectionnez vos suppléments</Text>
            <Text style={styles.pickerModalSubtitle}>Vous pouvez en choisir plusieurs</Text>
            <ScrollView style={styles.pickerModalScrollView}>
              {sandwichSupplements.map((supplement) => (
                <TouchableOpacity
                  key={supplement.name}
                  style={[
                    styles.pickerOption,
                    selectedSupplements.includes(supplement.name) && styles.pickerOptionSelected,
                  ]}
                  onPress={() => toggleSupplement(supplement.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pickerOptionContent}>
                    <View style={[
                      styles.checkbox,
                      selectedSupplements.includes(supplement.name) && styles.checkboxChecked,
                    ]}>
                      {selectedSupplements.includes(supplement.name) && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={styles.pickerOptionTextContainer}>
                      <Text style={[
                        styles.pickerOptionText,
                        selectedSupplements.includes(supplement.name) && styles.pickerOptionTextSelected,
                      ]}>
                        {supplement.name}
                      </Text>
                      <Text style={styles.pickerOptionPrice}>
                        {supplement.price.toFixed(2)} €
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerModalDone}
              onPress={() => setShowSupplementsPicker(false)}
            >
              <Text style={styles.pickerModalDoneText}>Terminé</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 16,
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
    paddingHorizontal: 4,
    paddingVertical: 8,
    paddingBottom: 100,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  productCardSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F0FDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  productDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: '#00ACC1',
    letterSpacing: 0.3,
  },
  addButton: {
    backgroundColor: '#00BCD4',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '95%',
    maxWidth: 500,
    height: '90%',
    maxHeight: '90%',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalProductName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalProductPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00ACC1',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  modalProductDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  customizationContainer: {
    width: '100%',
  },
  customizationSection: {
    marginBottom: 24,
  },
  customizationLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  requiredText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ef4444',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  optionButtonSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2cbefb',
  },
  optionButtonText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  optionButtonTextSelected: {
    color: '#1e40af',
    fontWeight: '600',
  },
  optionButtonArrow: {
    fontSize: 10,
    color: '#9ca3af',
    marginLeft: 8,
  },
  optionButtonArrowSelected: {
    color: '#2cbefb',
  },
  selectedSupplementsList: {
    marginTop: 12,
    gap: 8,
  },
  selectedSupplementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedSupplementItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  selectedSupplementItemPrice: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginRight: 10,
  },
  selectedSupplementRemoveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSupplementRemoveText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  customizationInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  customizationHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'right',
  },
  modalFooter: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  modalAddButton: {
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
  modalAddButtonDisabled: {
    backgroundColor: '#00BCD4',
  },
  modalAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    width: '85%',
    maxWidth: 400,
    maxHeight: '70%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  pickerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerModalScrollView: {
    maxHeight: 300,
  },
  pickerOption: {
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
  },
  pickerOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2cbefb',
    borderColor: '#2cbefb',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerOptionTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  pickerOptionTextSelected: {
    color: '#1e40af',
    fontWeight: '600',
  },
  pickerOptionPrice: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  pickerModalCancel: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  pickerModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  pickerModalDone: {
    borderRadius: 16,
    shadowColor: '#2cbefb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#2cbefb',
    alignItems: 'center',
  },
  pickerModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  pickerModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
});
