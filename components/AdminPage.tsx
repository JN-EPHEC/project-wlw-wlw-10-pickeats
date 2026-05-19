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
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Product } from '../types';
import { EditProductPage } from './EditProductPage';
import { ProductImageDisplay } from './ProductImageDisplay';

type AdminPageProps = {
  onBack: () => void;
  userRole?: string;
  userId?: string;
};

export function AdminPage({ onBack, userRole, userId }: AdminPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditPage, setShowEditPage] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const loadedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(loadedProducts);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les produits.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowEditPage(true);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setShowEditPage(true);
  };

  const handleCloseEdit = () => {
    setShowEditPage(false);
    setEditingProduct(null);
  };

  const handleSaveComplete = () => {
    loadProducts();
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      Alert.alert('Succès', 'Produit supprimé avec succès.');
      setProductToDelete(null);
      loadProducts();
    } catch (error: any) {
      console.error('❌ Erreur de suppression:', error);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      Alert.alert(
        'Erreur de suppression',
        `${error.code || 'Erreur'}: ${error.message || 'Impossible de supprimer le produit.'}\n\nVérifiez les règles Firestore.`
      );
    }
  };

  const toggleAvailability = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'products', product.id), {
        available: !product.available,
      });
      loadProducts();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier la disponibilité.');
      console.error(error);
    }
  };

  const categories = [
    { value: 'sandwich-chaud', label: 'Sandwichs chauds' },
    { value: 'sandwich-froid', label: 'Sandwichs froids' },
    { value: 'pasta', label: 'Pâtes' },
    { value: 'salade', label: 'Salades' },
    { value: 'snack', label: 'Snacks' },
    { value: 'drink', label: 'Boissons' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2cbefb" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (showEditPage) {
    return (
      <EditProductPage
        product={editingProduct}
        onBack={handleCloseEdit}
        onSaveComplete={handleSaveComplete}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gestion des produits</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.productList}>
          <View style={styles.productListHeader}>
            <Text style={styles.sectionTitle}>
              Tous les produits ({products.length})
            </Text>
            <TouchableOpacity
              onPress={handleAddNew}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Nouveau</Text>
            </TouchableOpacity>
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Aucun produit pour le moment.
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Cliquez sur "+ Nouveau" pour ajouter votre premier produit.
              </Text>
            </View>
          ) : (
            categories.map((cat) => {
              const categoryProducts = products
                .filter(p => p.category === cat.value)
                .sort((a, b) => a.price - b.price);
              if (categoryProducts.length === 0) return null;

              return (
                <View key={cat.value} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>
                    {cat.label} ({categoryProducts.length})
                  </Text>
                  {categoryProducts.map((product) => (
                    <View key={product.id} style={styles.productCard}>
                      <View style={styles.productHeader}>
                        <View style={styles.productInfo}>
                          <ProductImageDisplay imageUrl={product.image} size={40} />
                          <View style={styles.productDetails}>
                            <Text style={styles.productName}>{product.name}</Text>
                            <Text style={styles.productCategory}>
                              {categories.find(c => c.value === product.category)?.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.productPrice}>{product.price.toFixed(2)}€</Text>
                      </View>

                      <Text style={styles.productDescription} numberOfLines={2}>
                        {product.description}
                      </Text>

                      <View style={styles.productActions}>
                        <TouchableOpacity
                          style={[
                            styles.availabilityButton,
                            !product.available && styles.unavailableButton,
                          ]}
                          onPress={() => toggleAvailability(product)}
                        >
                          <Text
                            style={[
                              styles.availabilityButtonText,
                              !product.available && styles.unavailableButtonText,
                            ]}
                          >
                            {product.available !== false ? '✓ Disponible' : '✕ Indisponible'}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => handleEdit(product)}
                          >
                            <Text style={styles.editButtonText}>✏️ Modifier</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDelete(product)}
                          >
                            <Text style={styles.deleteButtonText}>🗑️ Supprimer</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal de confirmation de suppression */}
      <Modal
        visible={productToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setProductToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            <Text style={styles.modalMessage}>
              Êtes-vous sûr de vouloir supprimer "{productToDelete?.name}" ?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setProductToDelete(null)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={confirmDelete}
              >
                <Text style={styles.modalDeleteText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  placeholder: {
    width: 90,
  },
  addButton: {
    backgroundColor: '#2cbefb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  productList: {
    padding: 16,
  },
  productListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2cbefb',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  productImage: {
    fontSize: 40,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2cbefb',
  },
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  productActions: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    gap: 8,
  },
  availabilityButton: {
    backgroundColor: '#ecfeff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2cbefb',
    alignItems: 'center',
  },
  unavailableButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  availabilityButtonText: {
    color: '#0891b2',
    fontSize: 14,
    fontWeight: '600',
  },
  unavailableButtonText: {
    color: '#dc2626',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2cbefb',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#2cbefb',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalDeleteText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
