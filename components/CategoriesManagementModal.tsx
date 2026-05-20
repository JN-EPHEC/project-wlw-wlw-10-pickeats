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
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

export type Category = {
  id: string;
  name: string;
  key: string;
  imageUrl?: string;
};

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(
        query(collection(db, 'categories'), orderBy('name', 'asc')),
      );
      const loaded: Category[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: data.name ?? '',
          key: data.key ?? '',
          imageUrl: data.imageUrl,
        };
      });
      setCategories(loaded);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      Alert.alert('Erreur', 'Impossible de charger les catégories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setMode('list');
      setEditing(null);
      setName('');
      setImageUrl('');
      loadCategories();
    }
  }, [visible]);

  const handleStartAdd = () => {
    setEditing(null);
    setName('');
    setImageUrl('');
    setMode('form');
  };

  const handleStartEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setImageUrl(category.imageUrl ?? '');
    setMode('form');
  };

  const handleCancelForm = () => {
    setMode('list');
    setEditing(null);
    setName('');
    setImageUrl('');
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès aux photos pour choisir une image.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setUploadingImage(true);
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `category_images/${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.jpg`;
      const fileRef = storageRef(storage, filename);
      await uploadBytes(fileRef, blob);
      const downloadUrl = await getDownloadURL(fileRef);
      setImageUrl(downloadUrl);
    } catch (error: any) {
      console.error('Erreur upload image catégorie:', error);
      Alert.alert(
        'Erreur',
        error?.message || "Impossible d'uploader l'image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
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

    // Vérifier l'unicité de la clé (sauf si on édite la même)
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
      if (editing) {
        await updateDoc(doc(db, 'categories', editing.id), {
          name: trimmed,
          key,
          imageUrl: imageUrl || null,
        });
      } else {
        await addDoc(collection(db, 'categories'), {
          name: trimmed,
          key,
          imageUrl: imageUrl || null,
          createdAt: serverTimestamp(),
        });
      }
      await loadCategories();
      onCategoriesChanged?.();
      handleCancelForm();
    } catch (error: any) {
      console.error('Erreur sauvegarde catégorie:', error);
      Alert.alert(
        'Erreur',
        error?.message || 'Impossible d\'enregistrer la catégorie.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (category: Category) => {
    confirmDelete(
      'Supprimer la catégorie',
      `Voulez-vous vraiment supprimer "${category.name}" ? Les produits existants ne seront pas supprimés.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'categories', category.id));
          await loadCategories();
          onCategoriesChanged?.();
        } catch (error: any) {
          console.error('Erreur suppression catégorie:', error);
          Alert.alert(
            'Erreur',
            error?.message || 'Impossible de supprimer la catégorie.',
          );
        }
      },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
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
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Image (optionnel)</Text>
                  <View style={styles.imagePreviewContainer}>
                    {uploadingImage ? (
                      <View style={styles.imagePreviewPlaceholder}>
                        <ActivityIndicator color="#00BCD4" />
                      </View>
                    ) : imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
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
                      disabled={uploadingImage}
                    >
                      <Ionicons
                        name="images-outline"
                        size={16}
                        color="#1A1A2E"
                      />
                      <Text style={styles.secondaryButtonText}>
                        {imageUrl ? 'Changer l\'image' : 'Choisir une image'}
                      </Text>
                    </TouchableOpacity>
                    {imageUrl ? (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setImageUrl('')}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color="#DC2626"
                        />
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
                  disabled={saving || uploadingImage}
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
