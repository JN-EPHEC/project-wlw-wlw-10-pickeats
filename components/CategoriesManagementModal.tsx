import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import {
  DEFAULT_CATEGORIES,
  useCategories,
  type CategoryEntry,
} from '../hooks/use-categories';

type CategoriesManagementModalProps = {
  visible: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
};

const slugify = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const confirmDelete = (
  title: string,
  message: string,
  onConfirm: () => void,
) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: onConfirm },
  ]);
};

export function CategoriesManagementModal({
  visible,
  onClose,
  onCategoriesChanged,
}: CategoriesManagementModalProps) {
  const { categories, loading, rawDocs } = useCategories();

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<CategoryEntry | null>(null);
  const [name, setName] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string>('');
  const [remoteImageUrl, setRemoteImageUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode('list');
      setEditing(null);
      setName('');
      setLocalImageUri('');
      setRemoteImageUrl('');
    }
  }, [visible]);

  const handleStartAdd = () => {
    console.log('[Categories] handleStartAdd');
    setEditing(null);
    setName('');
    setLocalImageUri('');
    setRemoteImageUrl('');
    setMode('form');
  };

  const handleStartEdit = (category: CategoryEntry) => {
    console.log('[Categories] handleStartEdit', category);
    setEditing(category);
    setName(category.name);
    setLocalImageUri('');
    setRemoteImageUrl(category.imageUrl ?? '');
    setMode('form');
  };

  const handleCancelForm = () => {
    setMode('list');
    setEditing(null);
    setName('');
    setLocalImageUri('');
    setRemoteImageUrl('');
  };

  const handlePickImage = async () => {
    try {
      console.log('[Categories] handlePickImage start');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Categories] permission status:', status);
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          "Autorisez l'accès aux photos pour choisir une image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('[Categories] picker result:', {
        canceled: result.canceled,
        hasAssets: !result.canceled && !!result.assets?.[0],
      });

      if (result.canceled || !result.assets?.[0]) return;

      const uri = result.assets[0].uri;
      console.log('[Categories] selected URI:', uri);
      setLocalImageUri(uri);
      // l'upload effectif est différé jusqu'au save
    } catch (error: any) {
      console.error('[Categories] handlePickImage error:', error);
      Alert.alert(
        'Erreur',
        error?.message || "Impossible de choisir l'image.",
      );
    }
  };

  const uploadLocalImage = async (uri: string): Promise<string> => {
    console.log('[Categories] uploadLocalImage:', uri);
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `category_images/${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.jpg`;
    const fileRef = storageRef(storage, filename);
    await uploadBytes(fileRef, blob);
    const downloadUrl = await getDownloadURL(fileRef);
    console.log('[Categories] uploaded:', downloadUrl);
    return downloadUrl;
  };

  const handleSave = async () => {
    console.log('[Categories] handleSave', { name, editing, localImageUri, remoteImageUrl });
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Erreur', 'Veuillez saisir un nom de catégorie.');
      return;
    }

    const key = slugify(trimmed);
    if (!key) {
      Alert.alert('Erreur', 'Le nom de la catégorie est invalide.');
      return;
    }

    // Détection de doublons : on ignore l'éditing en cours
    const duplicate = categories.find(
      (c) => c.key === key && c.id !== editing?.id,
    );
    if (duplicate) {
      Alert.alert(
        'Erreur',
        'Une catégorie avec un nom similaire existe déjà.',
      );
      return;
    }

    try {
      setSaving(true);

      // 1) Upload de l'image si une image locale a été sélectionnée
      let finalImageUrl = remoteImageUrl;
      if (localImageUri) {
        finalImageUrl = await uploadLocalImage(localImageUri);
      }

      // 2) Décider où écrire dans Firestore
      if (editing && !editing.isFallback) {
        // Édition d'une vraie entrée Firestore
        console.log('[Categories] updateDoc', editing.id);
        await updateDoc(doc(db, 'categories', editing.id), {
          name: trimmed,
          key,
          imageUrl: finalImageUrl || null,
        });
      } else if (editing && editing.isFallback) {
        // Édition d'un fallback : on crée un override Firestore
        console.log('[Categories] addDoc override pour fallback', editing.key);
        await addDoc(collection(db, 'categories'), {
          name: trimmed,
          key,
          imageUrl: finalImageUrl || null,
          createdAt: serverTimestamp(),
        });
      } else {
        // Création d'une nouvelle catégorie
        console.log('[Categories] addDoc nouvelle catégorie');
        const newRef = await addDoc(collection(db, 'categories'), {
          name: trimmed,
          key,
          imageUrl: finalImageUrl || null,
          createdAt: serverTimestamp(),
        });
        console.log('[Categories] new doc id:', newRef.id);
      }

      onCategoriesChanged?.();
      handleCancelForm();
    } catch (error: any) {
      console.error('[Categories] handleSave error:', error);
      const code = error?.code || '';
      let message = error?.message || 'Impossible d\'enregistrer la catégorie.';
      if (code === 'permission-denied') {
        message =
          'Permission refusée. Vérifiez que vous êtes admin et que les règles Firestore sont déployées.';
      }
      Alert.alert('Erreur', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (category: CategoryEntry) => {
    console.log('[Categories] handleDelete', category);
    confirmDelete(
      'Supprimer la catégorie',
      `Voulez-vous vraiment supprimer "${category.name}" ? Les produits existants ne seront pas supprimés.`,
      async () => {
        try {
          if (category.isFallback) {
            // Tombstone : un doc qui marque la suppression du fallback
            console.log('[Categories] tombstone fallback', category.key);
            await addDoc(collection(db, 'categories'), {
              key: category.key,
              name: category.name,
              deleted: true,
              createdAt: serverTimestamp(),
            });
          } else {
            console.log('[Categories] deleteDoc', category.id);
            await deleteDoc(doc(db, 'categories', category.id));
          }
          onCategoriesChanged?.();
        } catch (error: any) {
          console.error('[Categories] handleDelete error:', error);
          const code = error?.code || '';
          let message =
            error?.message || 'Impossible de supprimer la catégorie.';
          if (code === 'permission-denied') {
            message =
              'Permission refusée. Vérifiez que vous êtes admin et que les règles Firestore sont déployées.';
          }
          Alert.alert('Erreur', message);
        }
      },
    );
  };

  const previewUri = localImageUri || remoteImageUrl;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'form'
                ? editing
                  ? 'Modifier la catégorie'
                  : 'Nouvelle catégorie'
                : 'Gérer les catégories'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {mode === 'list' ? (
            <>
              {loading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color="#00BCD4" />
                </View>
              ) : (
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                >
                  {categories.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="pricetags-outline"
                        size={48}
                        color="#9CA3AF"
                      />
                      <Text style={styles.emptyText}>
                        Aucune catégorie pour le moment.
                      </Text>
                    </View>
                  ) : (
                    categories.map((category) => (
                      <View key={category.id} style={styles.row}>
                        {category.imageUrl ? (
                          <Image
                            source={{ uri: category.imageUrl }}
                            style={styles.rowImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.rowImagePlaceholder}>
                            <Ionicons
                              name="image-outline"
                              size={20}
                              color="#00BCD4"
                            />
                          </View>
                        )}
                        <View style={styles.rowInfo}>
                          <Text style={styles.rowName}>{category.name}</Text>
                          <Text style={styles.rowKey}>{category.key}</Text>
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => handleStartEdit(category)}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name="pencil-outline"
                              size={16}
                              color="#1A1A2E"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconButtonDanger}
                            onPress={() => handleDelete(category)}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#DC2626"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}

              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleStartAdd}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    Ajouter une catégorie
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.formContent}
              >
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nom de la catégorie</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: Sandwichs chauds"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="sentences"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Image (optionnel)</Text>
                  <View style={styles.imagePreviewContainer}>
                    {previewUri ? (
                      <Image
                        source={{ uri: previewUri }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePreviewPlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={32}
                          color="#00BCD4"
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.imageButtonsRow}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={handlePickImage}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="images-outline"
                        size={16}
                        color="#1A1A2E"
                      />
                      <Text style={styles.secondaryButtonText}>
                        {previewUri ? "Changer l'image" : 'Choisir une image'}
                      </Text>
                    </TouchableOpacity>
                    {previewUri ? (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => {
                          setLocalImageUri('');
                          setRemoteImageUrl('');
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="close" size={16} color="#DC2626" />
                        <Text style={styles.secondaryButtonText}>Retirer</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelForm}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {editing ? 'Enregistrer' : 'Ajouter'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  rowImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  rowImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0FDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  rowKey: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDanger: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F7F7F7',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F7F7F7',
  },
  primaryButton: {
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '600',
  },
  formContent: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A2E',
    backgroundColor: '#FFFFFF',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  imagePreviewPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F0FDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
