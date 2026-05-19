import type { User as FirebaseUser } from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
    Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../firebaseConfig';
import type { OrderHistoryEntry } from '../types';
import { SettingsPage } from './SettingsPage';
import { HelpSupportPage } from './HelpSupportPage';
import { PersonalInfoPage } from './PersonalInfoPage';

const PROFILE_PHOTO_CACHE_KEY = '@pickeats_profile_photo_';

type ProfilePageProps = {
  onBack: () => void;
  onSignOut: () => void;
  onOpenAdmin?: () => void;
  onOpenOrdersManagement?: () => void;
  onReloadUser?: () => void;
  user: FirebaseUser;
  userRole?: string;
  orders: OrderHistoryEntry[];
  ordersLoading: boolean;
  loyaltyPoints?: number;
  availableVouchers?: number;
  onRedeemLoyaltyCard?: () => void;
};

export function ProfilePage({
  onBack,
  onSignOut,
  onOpenAdmin,
  onOpenOrdersManagement,
  onReloadUser,
  user,
  userRole,
  orders,
  ordersLoading,
  loyaltyPoints = 0,
  availableVouchers = 0,
  onRedeemLoyaltyCard,
}: ProfilePageProps) {
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [currentPage, setCurrentPage] = useState<'profile' | 'settings' | 'help' | 'personalInfo'>('profile');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Charger la photo de profil avec cache
  useEffect(() => {
    const loadProfilePhoto = async () => {
      try {
        const cacheKey = `${PROFILE_PHOTO_CACHE_KEY}${user.uid}`;
        
        // 1. Charger depuis le cache immédiatement
        const cachedPhotoURL = await AsyncStorage.getItem(cacheKey);
        if (cachedPhotoURL) {
          setPhotoURL(cachedPhotoURL);
        }
        
        // 2. Vérifier si la photo a changé dans Firestore (en arrière-plan)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const newPhotoURL = userDoc.data().photoURL;
          
          if (newPhotoURL && newPhotoURL !== cachedPhotoURL) {
            // Mettre à jour le cache et l'état
            setPhotoURL(newPhotoURL);
            await AsyncStorage.setItem(cacheKey, newPhotoURL);
          } else if (!newPhotoURL && cachedPhotoURL) {
            // La photo a été supprimée, nettoyer le cache
            setPhotoURL(null);
            await AsyncStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la photo:', error);
      }
    };
    loadProfilePhoto();
  }, [user.uid]);

  const handlePickImage = async () => {
    try {
      // Demander la permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder à vos photos.');
        return;
      }

      // Sélectionner l'image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPhoto(true);
        const uri = result.assets[0].uri;

        // Créer un blob depuis l'URI
        const response = await fetch(uri);
        const blob = await response.blob();

        // Upload vers Firebase Storage
        const storageRef = ref(storage, `profile_photos/${user.uid}`);
        await uploadBytes(storageRef, blob);

        // Obtenir l'URL de téléchargement
        const downloadURL = await getDownloadURL(storageRef);

        // Mettre à jour Firestore
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: downloadURL,
        });

        // Mettre à jour l'état et le cache
        setPhotoURL(downloadURL);
        const cacheKey = `${PROFILE_PHOTO_CACHE_KEY}${user.uid}`;
        await AsyncStorage.setItem(cacheKey, downloadURL);
        
        Alert.alert('Succès', 'Photo de profil mise à jour !');
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      Alert.alert('Erreur', 'Impossible de télécharger la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };
  
  const formatDate = (date: Date | null) => {
    if (!date) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Points de fidélité (1 point par commande >= 5€)
  const maxPoints = 10;

  const getInitials = () => {
    if (user.displayName) {
      const names = user.displayName.split(' ');
      return names.map(n => n.charAt(0).toUpperCase()).join('');
    }
    return user.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getRoleBadge = () => {
    switch (userRole) {
      case 'admin':
        return { 
          text: '👑 Administrateur', 
          badgeStyle: styles.badgeAdmin,
          textStyle: styles.badgeTextAdmin
        };
      case 'cafeteria':
        return { 
          text: '👨‍🍳 Employé Cafétéria', 
          badgeStyle: styles.badgeCafeteria,
          textStyle: styles.badgeTextCafeteria
        };
      default:
        return { 
          text: '👤 Utilisateur', 
          badgeStyle: styles.badgeUser,
          textStyle: styles.badgeTextUser
        };
    }
  };

  const roleBadge = getRoleBadge();

  // Afficher les différentes pages selon l'état
  if (currentPage === 'settings') {
    return <SettingsPage onBack={() => setCurrentPage('profile')} user={user} />;
  }

  if (currentPage === 'help') {
    return <HelpSupportPage onBack={() => setCurrentPage('profile')} />;
  }

  if (currentPage === 'personalInfo') {
    return <PersonalInfoPage onBack={() => setCurrentPage('profile')} user={user} onReloadUser={onReloadUser} />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploadingPhoto}
            activeOpacity={0.8}
          >
            {photoURL ? (
              <Image 
                source={{ uri: photoURL }} 
                style={styles.avatarImage}
                cachePolicy="disk"
                transition={200}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.editIndicator}>
              <Text style={styles.editIndicatorText}>✎</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user.displayName || 'Utilisateur'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={[styles.badge, roleBadge.badgeStyle]}>
              <Text style={[styles.badgeText, roleBadge.textStyle]}>{roleBadge.text}</Text>
            </View>
          </View>
        </View>

        {/* Loyalty Card */}
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <Text style={styles.loyaltyIcon}>🏅</Text>
            <Text style={styles.loyaltyTitle}>Carte de fidélité</Text>
          </View>
          
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Progression</Text>
            <Text style={styles.progressPoints}>{loyaltyPoints} / {maxPoints} points</Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${(loyaltyPoints / maxPoints) * 100}%` }]} />
          </View>
          
          {loyaltyPoints >= maxPoints ? (
            <TouchableOpacity 
              style={styles.redeemButton} 
              onPress={onRedeemLoyaltyCard}
            >
              <Text style={styles.redeemButtonIcon}>🎁</Text>
              <Text style={styles.redeemButtonText}>Échanger contre un bon de 5€</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardIcon}>🎁</Text>
              <Text style={styles.rewardText}>Plus que {maxPoints - loyaltyPoints} points pour un bon de 5€ !</Text>
            </View>
          )}
          
          {availableVouchers > 0 && (
            <View style={styles.vouchersSection}>
              <Text style={styles.vouchersLabel}>Bons disponibles</Text>
              <View style={styles.vouchersContainer}>
                {Array.from({ length: availableVouchers }).map((_, index) => (
                  <View key={index} style={styles.voucherBadge}>
                    <Text style={styles.voucherValue}>5€</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.vouchersHint}>Appliqués automatiquement à la prochaine commande</Text>
            </View>
          )}
          
          <View style={styles.rewardsUnlocked}>
            <Text style={styles.rewardsLabel}>Récompenses obtenues</Text>
            <Text style={styles.rewardsCount}>{Math.floor(loyaltyPoints / maxPoints) + availableVouchers}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>💳</Text>
            </View>
            <Text style={styles.actionText}>Moyens de paiement</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>🔔</Text>
            </View>
            <Text style={styles.actionText}>Notifications</Text>
          </TouchableOpacity>
        </View>

        {/* Order History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.historyIcon}>🕐</Text>
            <Text style={styles.sectionTitle}>Historique des commandes</Text>
          </View>

          {ordersLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2cbefb" />
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyOrdersText}>
                Vous n'avez pas encore de commande. Commencez dès maintenant !
              </Text>
            </View>
          ) : (
            <>
              {(showAllOrders ? orders : orders.slice(0, 3)).map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                    <View style={[styles.statusBadge, getStatusStyle(order.status)]}>
                      <Text style={styles.statusText}>{order.status}</Text>
                    </View>
                  </View>
                  <View style={styles.orderBody}>
                    {order.items.slice(0, 2).map((item, index) => (
                      <View key={index} style={styles.orderItemContainer}>
                        {item.isComboOffer ? (
                          <>
                            <View style={styles.comboItemHeaderRow}>
                              <Text style={styles.orderItem}>
                                • 🎁 {item.comboTitle || item.name} x{item.quantity}
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
                            <Text style={styles.orderItem}>
                              • {item.name} x{item.quantity}
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
                    {order.items.length > 2 && (
                      <Text style={styles.orderItem}>+ {order.items.length - 2} autre(s)</Text>
                    )}
                  </View>
                  <View style={styles.orderFooter}>
                    {order.pickupTime && (
                      <Text style={styles.pickupTime}>⏰ {order.pickupTime}</Text>
                    )}
                    <Text style={styles.orderTotal}>{order.total.toFixed(2)} €</Text>
                  </View>
                </View>
              ))}
              
              {orders.length > 3 && (
                <TouchableOpacity 
                  style={styles.showMoreButton}
                  onPress={() => setShowAllOrders(!showAllOrders)}
                >
                  <Text style={styles.showMoreButtonText}>
                    {showAllOrders ? '↑ Afficher moins' : `↓ Voir tout l'historique (${orders.length} commandes)`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Settings Options */}
        <View style={styles.settingsSection}>
          {userRole === 'admin' && onOpenAdmin && (
            <TouchableOpacity style={styles.adminItem} onPress={onOpenAdmin}>
              <Text style={styles.adminIcon}>📊</Text>
              <Text style={styles.adminText}>Tableau de bord admin</Text>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.settingItem} onPress={() => setCurrentPage('personalInfo')}>
            <Text style={styles.settingIcon}>👤</Text>
            <Text style={styles.settingText}>Informations personnelles</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => setCurrentPage('settings')}>
            <Text style={styles.settingIcon}>⚙️</Text>
            <Text style={styles.settingText}>Paramètres</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => setCurrentPage('help')}>
            <Text style={styles.settingIcon}>❓</Text>
            <Text style={styles.settingText}>Aide et support</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutItem} onPress={onSignOut}>
            <Text style={styles.signOutIcon}>↪️</Text>
            <Text style={styles.signOutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>PickEat v1.0.0</Text>
          <Text style={styles.footerCopyright}>© 2025 PickEat - Tous droits réservés</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'En préparation':
      return styles.statusPending;
    case 'À récupérer':
      return styles.statusReady;
    case 'Terminé':
      return styles.statusCompleted;
    default:
      return styles.statusPending;
  }
};

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
  headerTitle: {
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    margin: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(44, 190, 251, 0.2)',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  editIndicatorText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e40af',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: '#dbeafe',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
  },
  badgeUser: {
    backgroundColor: '#dbeafe',
  },
  badgeTextUser: {
    color: '#1e40af',
  },
  badgeAdmin: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  badgeTextAdmin: {
    color: '#b45309',
  },
  badgeCafeteria: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  badgeTextCafeteria: {
    color: '#047857',
  },
  loyaltyCard: {
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fde047',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loyaltyIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  loyaltyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  progressSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#374151',
  },
  progressPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#fef9c3',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#eab308',
    borderRadius: 4,
  },
  rewardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  rewardIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  rewardText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2cbefb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  redeemButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  redeemButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  vouchersSection: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  vouchersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  vouchersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  voucherBadge: {
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  voucherValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803d',
  },
  vouchersHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  rewardsUnlocked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#fde047',
    paddingTop: 12,
  },
  rewardsLabel: {
    fontSize: 14,
    color: '#374151',
  },
  rewardsCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 13,
    color: '#111827',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyOrders: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyOrdersText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  statusPending: {
    backgroundColor: '#fef3c7', // Jaune - En préparation
  },
  statusReady: {
    backgroundColor: '#bbf7d0', // Vert - À récupérer
  },
  statusCompleted: {
    backgroundColor: '#e0e7ff', // Bleu - Terminé
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  orderBody: {
    marginBottom: 8,
  },
  orderItemContainer: {
    marginBottom: 4,
  },
  orderItem: {
    fontSize: 13,
    color: '#374151',
  },
  customizationsContainer: {
    marginTop: 2,
    marginLeft: 16,
  },
  customizationText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pickupTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2cbefb',
  },
  showMoreButton: {
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginTop: 8,
  },
  showMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2cbefb',
  },
  settingsSection: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ecfeff',
    borderBottomWidth: 1,
    borderBottomColor: '#2cbefb',
  },
  adminIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
  },
  adminText: {
    flex: 1,
    fontSize: 15,
    color: '#0891b2',
    fontWeight: '600',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  chevron: {
    fontSize: 18,
    color: '#2cbefb',
  },
  signOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  signOutIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
  },
  signOutText: {
    flex: 1,
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  footerCopyright: {
    fontSize: 11,
    color: '#9ca3af',
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
    marginLeft: 16,
  },
  comboItemProductTextSmall: {
    fontSize: 11,
    color: '#6b7280',
  },
});
