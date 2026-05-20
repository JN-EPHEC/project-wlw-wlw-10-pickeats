import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { Product } from '@/types';

type Offer = {
  id: string;
  title: string;
  description: string;
  discount: number;
  badge: 'Promo' | 'Nouveau';
  active: boolean;
  productIds?: string[]; // IDs des produits associés
};

type OffersManagementPageProps = {
  offers: Offer[];
  onOffersUpdate: () => void;
};

export function OffersManagementPage({ offers, onOffersUpdate }: OffersManagementPageProps) {
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('');
  const [badge, setBadge] = useState<'Promo' | 'Nouveau'>('Promo');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const q = query(collection(db, 'products'), orderBy('name'));
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
      setLoadingProducts(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const categoryNames: Record<string, string> = {
    'sandwich-chaud': 'Sandwichs chauds',
    'sandwich-froid': 'Sandwichs froids',
    'pasta': 'Pâtes',
    'drink': 'Boissons',
    'snack': 'Snacks',
    'salade': 'Salades',
  };

  const categories = [
    { value: null, label: 'Tous' },
    { value: 'sandwich-chaud', label: 'Sandwichs chauds' },
    { value: 'sandwich-froid', label: 'Sandwichs froids' },
    { value: 'pasta', label: 'Pâtes' },
    { value: 'salade', label: 'Salades' },
    { value: 'snack', label: 'Snacks' },
    { value: 'drink', label: 'Boissons' },
  ];

  const filteredProducts = selectedCategoryFilter
    ? products.filter(p => p.category === selectedCategoryFilter)
    : products;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDiscount('');
    setBadge('Promo');
    setSelectedProductIds([]);
    setEditingOffer(null);
    setShowOfferModal(false);
  };

  const handleSaveOffer = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le titre et la description.');
      return;
    }

    // Pour le badge "Nouveau", le pourcentage n'est pas obligatoire
    let discountValue = 0;
    if (badge === 'Promo') {
      if (!discount) {
        Alert.alert('Erreur', 'Veuillez remplir le pourcentage de réduction pour une promotion.');
        return;
      }
      discountValue = parseInt(discount);
      if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
        Alert.alert('Erreur', 'La réduction doit être entre 0 et 100.');
        return;
      }
    } else if (discount) {
      // Si un pourcentage est rempli pour "Nouveau", le valider quand même
      discountValue = parseInt(discount);
      if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
        Alert.alert('Erreur', 'La réduction doit être entre 0 et 100.');
        return;
      }
    }

    try {
      const offersRef = doc(db, 'settings', 'promotions');
      
      // Récupérer les offres existantes
      const offersDoc = await getDoc(offersRef);
      const currentOffers = offersDoc.exists() ? (offersDoc.data().offers || []) : [];
      
      if (editingOffer) {
        // Mise à jour d'une offre existante
        const updatedOffer: Offer = {
          ...editingOffer,
          title: title.trim(),
          description: description.trim(),
          discount: discountValue,
          badge,
          productIds: selectedProductIds,
        };

        // Remplacer l'ancienne offre par la nouvelle
        const updatedOffers = currentOffers.map((offer: Offer) => 
          offer.id === editingOffer.id ? updatedOffer : offer
        );

        await setDoc(offersRef, { offers: updatedOffers }, { merge: true });
      } else {
        // Ajout d'une nouvelle offre
        const newOffer: Offer = {
          id: Date.now().toString(),
          title: title.trim(),
          description: description.trim(),
          discount: discountValue,
          badge,
          active: true,
          productIds: selectedProductIds,
        };

        await setDoc(offersRef, { offers: [...currentOffers, newOffer] }, { merge: true });
      }

      Alert.alert('Succès', editingOffer ? 'Offre mise à jour.' : 'Offre ajoutée.');
      resetForm();
      onOffersUpdate();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'offre.');
    }
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setTitle(offer.title);
    setDescription(offer.description);
    setDiscount(offer.discount.toString());
    setBadge(offer.badge);
    setSelectedProductIds(offer.productIds || []);
    setShowOfferModal(true);
  };

  const handleToggleActive = async (offer: Offer) => {
    try {
      const offersRef = doc(db, 'settings', 'promotions');
      const offersDoc = await getDoc(offersRef);
      const currentOffers = offersDoc.exists() ? (offersDoc.data().offers || []) : [];
      
      const updatedOffers = currentOffers.map((o: Offer) => 
        o.id === offer.id ? { ...o, active: !o.active } : o
      );

      await setDoc(offersRef, { offers: updatedOffers }, { merge: true });
      onOffersUpdate();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'offre.');
    }
  };

  const handleDeleteOffer = async (offer: Offer) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Voulez-vous vraiment supprimer "${offer.title}" ?`);
      if (!confirmed) return;

      try {
        const offersRef = doc(db, 'settings', 'promotions');
        const offersDoc = await getDoc(offersRef);
        const currentOffers = offersDoc.exists() ? (offersDoc.data().offers || []) : [];
        
        const updatedOffers = currentOffers.filter((o: Offer) => o.id !== offer.id);
        
        await setDoc(offersRef, { offers: updatedOffers }, { merge: true });
        window.alert('Offre supprimée avec succès.');
        onOffersUpdate();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        window.alert('Impossible de supprimer l\'offre.');
      }
    } else {
      Alert.alert(
        'Confirmer la suppression',
        `Voulez-vous vraiment supprimer "${offer.title}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                const offersRef = doc(db, 'settings', 'promotions');
                const offersDoc = await getDoc(offersRef);
                const currentOffers = offersDoc.exists() ? (offersDoc.data().offers || []) : [];
                
                const updatedOffers = currentOffers.filter((o: Offer) => o.id !== offer.id);
                
                await setDoc(offersRef, { offers: updatedOffers }, { merge: true });
                Alert.alert('Succès', 'Offre supprimée.');
                onOffersUpdate();
              } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                Alert.alert('Erreur', 'Impossible de supprimer l\'offre.');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <>
      {/* Header with Add Button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Mes Offres</Text>
          <Text style={styles.headerSubtitle}>
            {offers.filter(o => o.badge === 'Promo').length} promo{offers.filter(o => o.badge === 'Promo').length > 1 ? 's' : ''} • {offers.filter(o => o.badge === 'Nouveau').length} nouveauté{offers.filter(o => o.badge === 'Nouveau').length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowOfferModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonIcon}>+</Text>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Offers List */}
        <View style={styles.offersList}>
          {offers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={48} color="#9CA3AF" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Aucune offre</Text>
              <Text style={styles.emptyText}>Créez votre première promotion ou nouveauté</Text>
            </View>
          ) : (
            offers.map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                {/* Badge */}
                <View style={[
                  styles.offerBadge,
                  offer.badge === 'Promo' ? styles.badgePromo : styles.badgeNew
                ]}>
                  <Text style={[
                    styles.offerBadgeText,
                    offer.badge === 'Promo' ? styles.badgePromoText : styles.badgeNewText
                  ]}>
                    {offer.badge}
                  </Text>
                </View>

                {/* Content */}
                <View style={styles.offerContent}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerDescription}>{offer.description}</Text>
                  {offer.discount > 0 && (
                    <Text style={styles.offerDiscount}>-{offer.discount}%</Text>
                  )}
                  {offer.productIds && offer.productIds.length > 0 && (
                    <Text style={styles.offerProductsInfo}>
                      {offer.productIds.length} produit{offer.productIds.length > 1 ? 's' : ''} associé{offer.productIds.length > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.offerActions}>
                  <TouchableOpacity
                    style={[
                      styles.activeToggle,
                      offer.active && styles.activeToggleActive
                    ]}
                    onPress={() => handleToggleActive(offer)}
                  >
                    <View style={[
                      styles.activeDot,
                      offer.active && styles.activeDotActive
                    ]} />
                    <Text style={[
                      styles.activeText,
                      offer.active && styles.activeTextActive
                    ]}>
                      {offer.active ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditOffer(offer)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#1A1A2E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteOffer(offer)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal pour ajouter/modifier une offre */}
      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={resetForm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingOffer ? 'Modifier l\'offre' : 'Nouvelle offre'}
              </Text>
              <TouchableOpacity
                onPress={resetForm}
                style={styles.modalCloseButton}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Titre</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex: Pack Midi -20%"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ex: Sandwich + Boisson + Snack"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Réduction (%)
                  {badge === 'Nouveau' && <Text style={styles.optionalLabel}> (optionnel)</Text>}
                </Text>
                <TextInput
                  style={styles.input}
                  value={discount}
                  onChangeText={setDiscount}
                  placeholder={badge === 'Nouveau' ? 'Ex: 0 (optionnel)' : 'Ex: 20'}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Produits associés</Text>
                <TouchableOpacity
                  style={styles.productPickerButton}
                  onPress={() => setShowProductPicker(true)}
                >
                  <Text style={styles.productPickerButtonText}>
                    {selectedProductIds.length === 0
                      ? 'Sélectionnez les produits'
                      : `${selectedProductIds.length} produit${selectedProductIds.length > 1 ? 's' : ''} sélectionné${selectedProductIds.length > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={styles.productPickerButtonArrow}>▶</Text>
                </TouchableOpacity>
                {selectedProductIds.length > 0 && (
                  <View style={styles.selectedProductsContainer}>
                    <Text style={styles.selectedProductsLabel}>Produits sélectionnés :</Text>
                    {selectedProductIds.map(productId => {
                      const product = products.find(p => p.id === productId);
                      return product ? (
                        <View key={productId} style={styles.selectedProductTag}>
                          <Text style={styles.selectedProductText}>{product.name}</Text>
                          <TouchableOpacity
                            onPress={() => toggleProductSelection(productId)}
                            style={styles.removeProductButton}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="close" size={12} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                      ) : null;
                    })}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Badge</Text>
                <View style={styles.badgeSelector}>
                  <TouchableOpacity
                    style={[styles.badgeOption, badge === 'Promo' && styles.badgeOptionActive]}
                    onPress={() => setBadge('Promo')}
                  >
                    <Text style={[styles.badgeOptionText, badge === 'Promo' && styles.badgeOptionTextActive]}>
                      Promo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.badgeOption, badge === 'Nouveau' && styles.badgeOptionActive]}
                    onPress={() => setBadge('Nouveau')}
                  >
                    <Text style={[styles.badgeOptionText, badge === 'Nouveau' && styles.badgeOptionTextActive]}>
                      Nouveau
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resetForm}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveOffer}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>
                  {editingOffer ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pour sélectionner les produits */}
      <Modal
        visible={showProductPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View style={styles.productPickerModalOverlay}>
          <View style={styles.productPickerModalContent}>
            <View style={styles.productPickerModalHeader}>
              <Text style={styles.productPickerModalTitle}>Sélectionner les produits</Text>
              <TouchableOpacity
                onPress={() => setShowProductPicker(false)}
                style={styles.productPickerModalClose}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Filtres par catégorie */}
            <View style={styles.categoryFilterContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilterScrollView}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value || 'all'}
                    style={[
                      styles.categoryFilterButton,
                      selectedCategoryFilter === cat.value && styles.categoryFilterButtonActive,
                    ]}
                    onPress={() => setSelectedCategoryFilter(cat.value)}
                  >
                    <Text
                      style={[
                        styles.categoryFilterButtonText,
                        selectedCategoryFilter === cat.value && styles.categoryFilterButtonTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.productPickerModalScrollView}>
              {loadingProducts ? (
                <Text style={styles.productPickerLoadingText}>Chargement des produits...</Text>
              ) : filteredProducts.length === 0 ? (
                <View style={styles.productPickerEmptyContainer}>
                  <Text style={styles.productPickerEmptyText}>
                    Aucun produit dans cette catégorie
                  </Text>
                </View>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id);
                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.productPickerItem,
                        isSelected && styles.productPickerItemSelected,
                      ]}
                      onPress={() => toggleProductSelection(product.id)}
                    >
                      <View style={styles.productPickerItemContent}>
                        <View style={styles.productPickerItemCheckbox}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                        </View>
                        <View style={styles.productPickerItemInfo}>
                          <Text style={styles.productPickerItemName}>{product.name}</Text>
                          <Text style={styles.productPickerItemPrice}>{product.price.toFixed(2)} €</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.productPickerModalFooter}>
              <TouchableOpacity
                style={styles.productPickerModalDoneButton}
                onPress={() => setShowProductPicker(false)}
              >
                <Text style={styles.productPickerModalDoneText}>Terminé</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
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
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BCD4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 0,
  },
  addButtonIcon: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  formCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  badgeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  badgeOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  badgeOptionActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#2cbefb',
  },
  badgeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  badgeOptionTextActive: {
    color: '#2cbefb',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#00BCD4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  offersList: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  offerCard: {
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
  offerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 1,
  },
  badgePromo: {
    backgroundColor: '#dbeafe',
  },
  badgeNew: {
    backgroundColor: '#d1fae5',
  },
  offerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgePromoText: {
    color: '#1e40af',
  },
  badgeNewText: {
    color: '#065f46',
  },
  offerContent: {
    padding: 16,
    paddingRight: 80,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  offerDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  offerDiscount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2cbefb',
    marginBottom: 4,
  },
  offerProductsInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  offerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fde68a',
    gap: 8,
  },
  activeToggleActive: {
    backgroundColor: '#bbf7d0',
    borderColor: '#86efac',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  activeDotActive: {
    backgroundColor: '#22c55e',
  },
  activeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  activeTextActive: {
    color: '#166534',
  },
  actionButtons: {
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
  productPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  productPickerButtonText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  productPickerButtonArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  selectedProductsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedProductsLabel: {
    width: '100%',
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  selectedProductTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2cbefb',
    gap: 6,
  },
  selectedProductText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
  },
  removeProductButton: {
    padding: 2,
  },
  removeProductText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: 'bold',
  },
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
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  productPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryFilterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  categoryFilterScrollView: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
  },
  categoryFilterButtonActive: {
    backgroundColor: '#2cbefb',
    borderColor: '#2cbefb',
  },
  categoryFilterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoryFilterButtonTextActive: {
    color: '#ffffff',
  },
  productPickerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  productPickerModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productPickerModalCloseText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  productPickerModalScrollView: {
    maxHeight: 400,
  },
  productPickerLoadingText: {
    padding: 20,
    textAlign: 'center',
    color: '#6b7280',
  },
  productPickerEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  productPickerEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  productPickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  productPickerItemSelected: {
    backgroundColor: '#eff6ff',
  },
  productPickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productPickerItemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productPickerItemCheckmark: {
    color: '#2cbefb',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productPickerItemInfo: {
    flex: 1,
  },
  productPickerItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productPickerItemPrice: {
    fontSize: 14,
    color: '#6b7280',
  },
  productPickerModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  productPickerModalDoneButton: {
    backgroundColor: '#2cbefb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  productPickerModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Styles pour le modal d'ajout/édition d'offre
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalScrollView: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
