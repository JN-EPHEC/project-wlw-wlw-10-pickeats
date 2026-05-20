import { db, functions } from '@/firebaseConfig';
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    updateDoc,
    type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type OrderItem = {
  name: string;
  quantity: number;
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

type OrdersManagementPageProps = {
  onBack: () => void;
};

export function OrdersManagementPage({ onBack }: OrdersManagementPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'En préparation' | 'À récupérer' | 'Terminé'>('En préparation');
  const [viewMode, setViewMode] = useState<'orders' | 'products'>('orders');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Charger toutes les commandes de tous les utilisateurs
    const loadAllOrders = async () => {
      try {
        setLoading(true);
        
        // Récupérer toutes les commandes via Cloud Function
        const getAllOrdersFunction = httpsCallable(functions, 'getAllOrders');
        const result = await getAllOrdersFunction({});
        const data = result.data as { orders: any[] };
        
        const fetchedOrders: Order[] = (data.orders || []).map((order: any) => ({
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
                customizations: item.customizations || [],
                isComboOffer: item.isComboOffer || false,
                comboTitle: item.comboTitle,
                comboDiscount: item.comboDiscount,
                comboProducts: item.comboProducts,
              }))
            : [],
        }));

        setOrders(fetchedOrders);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement des commandes:', error);
        Alert.alert('Erreur', 'Impossible de charger les commandes.');
        setLoading(false);
      }
    };

    loadAllOrders();
    
    // Actualiser toutes les 30 secondes
    const interval = setInterval(loadAllOrders, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = async (order: Order, newStatus: string) => {
    try {
      // Mise à jour optimiste locale immédiate
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id && o.userId === order.userId
            ? { ...o, status: newStatus }
            : o
        )
      );

      // Mise à jour dans Firebase
      const orderRef = doc(db, 'users', order.userId, 'orders', order.id);
      await updateDoc(orderRef, {
        status: newStatus,
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      
      // En cas d'erreur, annuler la mise à jour optimiste
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id && o.userId === order.userId
            ? { ...o, status: order.status }
            : o
        )
      );
      
      Alert.alert('Erreur', 'Impossible de mettre à jour la commande.');
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'En préparation':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'À récupérer':
        return { backgroundColor: '#bbf7d0', color: '#166534' };
      case 'Terminé':
        return { backgroundColor: '#e0e7ff', color: '#3730a3' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'En préparation':
        return '#fef3c7';
      case 'À récupérer':
        return '#bbf7d0';
      case 'Terminé':
        return '#e0e7ff';
      default:
        return '#f3f4f6';
    }
  };

  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  const ordersByStatus = {
    'En préparation': orders.filter(o => o.status === 'En préparation').length,
    'À récupérer': orders.filter(o => o.status === 'À récupérer').length,
    'Terminé': orders.filter(o => o.status === 'Terminé').length,
  };

  // Fonction pour regrouper les produits avec leurs commandes
  const getProductsSummary = () => {
    const productsMap = new Map<string, { quantity: number; orders: Order[] }>();
    
    const ordersToProcess = selectedFilter === 'all' 
      ? orders 
      : orders.filter(order => order.status === selectedFilter);

    ordersToProcess.forEach(order => {
      order.items.forEach(item => {
        const current = productsMap.get(item.name) || { quantity: 0, orders: [] };
        productsMap.set(item.name, {
          quantity: current.quantity + item.quantity,
          orders: [...current.orders, order],
        });
      });
    });

    return Array.from(productsMap.entries())
      .map(([name, data]) => ({ 
        name, 
        quantity: data.quantity,
        orders: data.orders.filter((order, index, self) => 
          self.findIndex(o => o.id === order.id && o.userId === order.userId) === index
        ),
      }))
      .sort((a, b) => b.quantity - a.quantity);
  };

  const toggleProductExpansion = (productName: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productName)) {
      newExpanded.delete(productName);
    } else {
      newExpanded.add(productName);
    }
    setExpandedProducts(newExpanded);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des commandes</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statNumber}>{ordersByStatus['En préparation']}</Text>
          <Text style={styles.statLabel}>En préparation</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#bbf7d0' }]}>
          <Text style={styles.statNumber}>{ordersByStatus['À récupérer']}</Text>
          <Text style={styles.statLabel}>À récupérer</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#e0e7ff' }]}>
          <Text style={styles.statNumber}>{ordersByStatus['Terminé']}</Text>
          <Text style={styles.statLabel}>Terminé</Text>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'orders' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('orders')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={viewMode === 'orders' ? '#FFFFFF' : '#1A1A2E'}
          />
          <Text style={[styles.viewModeText, viewMode === 'orders' && styles.viewModeTextActive]}>
            Par commande
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'products' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('products')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="restaurant-outline"
            size={16}
            color={viewMode === 'products' ? '#FFFFFF' : '#1A1A2E'}
          />
          <Text style={[styles.viewModeText, viewMode === 'products' && styles.viewModeTextActive]}>
            Par produit
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            Toutes ({orders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'En préparation' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('En préparation')}
        >
          <Text style={[styles.filterText, selectedFilter === 'En préparation' && styles.filterTextActive]}>
            En préparation ({ordersByStatus['En préparation']})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'À récupérer' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('À récupérer')}
        >
          <Text style={[styles.filterText, selectedFilter === 'À récupérer' && styles.filterTextActive]}>
            À récupérer ({ordersByStatus['À récupérer']})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'Terminé' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('Terminé')}
        >
          <Text style={[styles.filterText, selectedFilter === 'Terminé' && styles.filterTextActive]}>
            Terminé ({ordersByStatus['Terminé']})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2cbefb" />
        </View>
      ) : viewMode === 'products' ? (
        // Vue par produit
        <ScrollView style={styles.ordersList}>
          {(() => {
            const productsSummary = getProductsSummary();
            
            if (productsSummary.length === 0) {
              return (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Aucun produit pour ce filtre</Text>
                </View>
              );
            }

            return (
              <View style={styles.productsContainer}>
                <View style={styles.productsHeader}>
                  <Text style={styles.productsTitle}>Produits à préparer</Text>
                  <Text style={styles.productsSubtitle}>
                    {productsSummary.reduce((sum, p) => sum + p.quantity, 0)} articles au total
                  </Text>
                </View>
                {productsSummary.map((product, index) => {
                  const isExpanded = expandedProducts.has(product.name);
                  return (
                    <View key={index}>
                      <TouchableOpacity 
                        style={styles.productSummaryCard}
                        onPress={() => toggleProductExpansion(product.name)}
                      >
                        <View style={styles.productSummaryContent}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <Text style={styles.productOrdersCount}>
                            {product.orders.length} commande{product.orders.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={styles.productSummaryRight}>
                          <View style={styles.productQuantityBadge}>
                            <Text style={styles.productQuantityText}>×{product.quantity}</Text>
                          </View>
                          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Commandes associées */}
                      {isExpanded && (
                        <View style={styles.productOrdersList}>
                          {product.orders.map((order) => {
                            // Calculer la quantité de ce produit dans cette commande
                            const productQty = order.items
                              .filter(item => item.name === product.name)
                              .reduce((sum, item) => sum + item.quantity, 0);

                            return (
                              <View key={`${order.userId}-${order.id}`} style={styles.productOrderCard}>
                                <View style={styles.productOrderHeader}>
                                  <View style={styles.productOrderInfo}>
                                    <Text style={styles.productOrderDate}>{formatDate(order.createdAt)}</Text>
                                    {order.userEmail && (
                                      <Text style={styles.productOrderEmail}>{order.userEmail}</Text>
                                    )}
                                    {order.pickupTime && (
                                      <Text style={styles.productOrderTime}>⏰ {order.pickupTime}</Text>
                                    )}
                                  </View>
                                  <View style={styles.productOrderBadges}>
                                    <View style={styles.productOrderQty}>
                                      <Text style={styles.productOrderQtyText}>×{productQty}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                                      <Text style={styles.statusText}>{order.status}</Text>
                                    </View>
                                  </View>
                                </View>

                                {/* Tous les articles de cette commande */}
                                <View style={styles.productOrderItems}>
                                  <Text style={styles.productOrderItemsTitle}>Commande complète :</Text>
                                  {(() => {
                                    // Regrouper les articles par nom
                                    const groupedItems = order.items.reduce((acc, item) => {
                                      const existing = acc.find(i => i.name === item.name);
                                      if (existing) {
                                        existing.quantity += item.quantity;
                                      } else {
                                        acc.push({ ...item });
                                      }
                                      return acc;
                                    }, [] as OrderItem[]);

                                    return groupedItems.map((item, idx) => (
                                      <View key={idx} style={styles.productOrderItemContainer}>
                                        {item.isComboOffer ? (
                                          <>
                                            <View style={styles.comboItemHeaderRow}>
                                              <Text 
                                                style={[
                                                  styles.productOrderItem,
                                                  item.name === product.name && styles.productOrderItemHighlight
                                                ]}
                                              >
                                                {item.name === product.name && '→ '}• {item.comboTitle || item.name} x{item.quantity}
                                              </Text>
                                              {item.comboDiscount && (
                                                <View style={styles.comboItemBadgeSmall}>
                                                  <Text style={styles.comboItemBadgeTextSmall}>-{item.comboDiscount}%</Text>
                                                </View>
                                              )}
                                            </View>
                                            {item.comboProducts && item.comboProducts.length > 0 && (
                                              <View style={styles.comboItemProductsSmall}>
                                                {item.comboProducts.map((product, pIdx) => (
                                                  <Text key={pIdx} style={styles.comboItemProductTextSmall}>
                                                    • {product.name}
                                                  </Text>
                                                ))}
                                              </View>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <Text 
                                              style={[
                                                styles.productOrderItem,
                                                item.name === product.name && styles.productOrderItemHighlight
                                              ]}
                                            >
                                              {item.name === product.name && '→ '}• {item.name} x{item.quantity}
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
                                    ));
                                  })()}
                                  <Text style={styles.productOrderTotal}>Total : {order.total.toFixed(2)} €</Text>
                                </View>

                                {/* Boutons de changement de statut */}
                                <View style={styles.productOrderActions}>
                                  {order.status !== 'En préparation' && (
                                    <TouchableOpacity
                                      style={[styles.actionButton, styles.actionButtonPending]}
                                      onPress={() => updateOrderStatus(order, 'En préparation')}
                                    >
                                      <Text style={styles.actionButtonText}>En préparation</Text>
                                    </TouchableOpacity>
                                  )}
                                  {order.status !== 'À récupérer' && (
                                    <TouchableOpacity
                                      style={[styles.actionButton, styles.actionButtonReady]}
                                      onPress={() => updateOrderStatus(order, 'À récupérer')}
                                    >
                                      <Text style={styles.actionButtonText}>À récupérer</Text>
                                    </TouchableOpacity>
                                  )}
                                  {order.status !== 'Terminé' && (
                                    <TouchableOpacity
                                      style={[styles.actionButton, styles.actionButtonCompleted]}
                                      onPress={() => updateOrderStatus(order, 'Terminé')}
                                    >
                                      <Text style={styles.actionButtonText}>Terminé</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      ) : (
        // Vue par commande
        <ScrollView style={styles.ordersList}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune commande pour ce filtre</Text>
            </View>
          ) : (
            filteredOrders.map((order) => (
              <View key={`${order.userId}-${order.id}`} style={styles.orderCard}>
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
                  {(() => {
                    // Regrouper les articles par nom
                    const groupedItems = order.items.reduce((acc, item) => {
                      const existing = acc.find(i => i.name === item.name);
                      if (existing) {
                        existing.quantity += item.quantity;
                      } else {
                        acc.push({ ...item });
                      }
                      return acc;
                    }, [] as OrderItem[]);

                    return groupedItems.map((item, index) => (
                      <View key={index} style={styles.orderItemContainer}>
                        {item.isComboOffer ? (
                          <>
                            <View style={styles.comboItemHeaderRow}>
                              <Text style={styles.orderItemText}>
                                {item.quantity}x {item.comboTitle || item.name}
                              </Text>
                              {item.comboDiscount && (
                                <View style={styles.comboItemBadgeSmall}>
                                  <Text style={styles.comboItemBadgeTextSmall}>-{item.comboDiscount}%</Text>
                                </View>
                              )}
                            </View>
                            {item.comboProducts && item.comboProducts.length > 0 && (
                              <View style={styles.comboItemProductsSmall}>
                                {item.comboProducts.map((product, pIdx) => (
                                  <Text key={pIdx} style={styles.comboItemProductTextSmall}>
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
                    ));
                  })()}
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
                        updateOrderStatus(order, nextStatus);
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
        </ScrollView>
      )}
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
  backArrow: {
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
  headerTitle: {
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F0FDFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#00BCD4',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  filtersContainer: {
    maxHeight: 50,
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2cbefb',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
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
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  productsContainer: {
    padding: 16,
  },
  productsHeader: {
    marginBottom: 16,
  },
  productsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  productsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  productSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productSummaryContent: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productOrdersCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  productSummaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productQuantityBadge: {
    backgroundColor: '#2cbefb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  productQuantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  expandIcon: {
    fontSize: 14,
    color: '#6b7280',
  },
  productOrdersList: {
    backgroundColor: '#f9fafb',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  productOrderCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productOrderInfo: {
    flex: 1,
  },
  productOrderDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  productOrderEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  productOrderTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  productOrderBadges: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  productOrderQty: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  productOrderQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  productOrderItems: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  productOrderItemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  productOrderItemContainer: {
    marginBottom: 4,
  },
  productOrderItem: {
    fontSize: 14,
    color: '#374151',
    paddingLeft: 8,
  },
  customizationsContainer: {
    marginTop: 2,
    marginLeft: 24,
  },
  customizationText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  comboItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comboItemBadgeSmall: {
    backgroundColor: '#10b981',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  comboItemBadgeTextSmall: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  comboItemProductsSmall: {
    marginTop: 2,
    marginLeft: 24,
  },
  comboItemProductTextSmall: {
    fontSize: 11,
    color: '#6b7280',
  },
  productOrderItemHighlight: {
    fontWeight: '700',
    color: '#2cbefb',
  },
  productOrderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  productOrderActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonPending: {
    backgroundColor: '#fef3c7',
  },
  actionButtonReady: {
    backgroundColor: '#bbf7d0',
  },
  actionButtonCompleted: {
    backgroundColor: '#e0e7ff',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
});
