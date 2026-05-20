import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateDoc, addDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Product } from '../types';
import { ProductImagePicker } from './ProductImagePicker';
import { useCategories } from '../hooks/use-categories';

type EditProductPageProps = {
  product?: Product | null;
  onBack: () => void;
  onSaveComplete: () => void;
};

export function EditProductPage({ product, onBack, onSaveComplete }: EditProductPageProps) {
  const { categories: dynamicCategories } = useCategories();
  const categories = dynamicCategories.map((c) => ({ label: c.name, value: c.key }));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>('sandwich-chaud');
  const [image, setImage] = useState('');
  const [available, setAvailable] = useState(true);
  const [customizable, setCustomizable] = useState(false);

  const handlePriceChange = (text: string) => {
    // Remplacer le point par une virgule et ne garder que les chiffres et la virgule
    const sanitized = text.replace('.', ',').replace(/[^0-9,]/g, '');
    
    // S'assurer qu'il n'y a qu'une seule virgule
    const parts = sanitized.split(',');
    if (parts.length > 2) {
      setPrice(parts[0] + ',' + parts.slice(1).join(''));
    } else if (parts.length === 2) {
      // Limiter à 2 décimales
      setPrice(parts[0] + ',' + parts[1].substring(0, 2));
    } else {
      setPrice(sanitized);
    }
  };

  const handlePriceBlur = () => {
    if (!price) return;
    
    // Formater automatiquement avec 2 décimales
    const priceNum = parseFloat(price.replace(',', '.'));
    if (!isNaN(priceNum)) {
      setPrice(priceNum.toFixed(2).replace('.', ','));
    }
  };

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setPrice(product.price.toFixed(2).replace('.', ','));
      setCategory(product.category);
      setImage(product.image);
      setAvailable(product.available !== false);
      setCustomizable(product.customizable || false);
    }
  }, [product]);

  useEffect(() => {
    if (!product && categories.length > 0 && !categories.some((c) => c.value === category)) {
      setCategory(categories[0].value);
    }
  }, [categories, product, category]);

  const handleSave = async () => {
    if (!name.trim() || !price) {
      Alert.alert('Erreur', 'Veuillez remplir le nom et le prix du produit.');
      return;
    }

    if (!image.trim()) {
      Alert.alert('Erreur', 'Veuillez ajouter une image (photo ou emoji).');
      return;
    }

    const priceNum = parseFloat(price.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre positif.');
      return;
    }

    try {
      const productData = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        category,
        image: image.trim(),
        available,
        customizable,
      };

      if (product) {
        // Update existing product
        await updateDoc(doc(db, 'products', product.id), productData);
        Alert.alert('Succès', 'Produit mis à jour avec succès.');
      } else {
        // Add new product
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        Alert.alert('Succès', 'Produit ajouté avec succès.');
      }

      onSaveComplete();
      onBack();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le produit.');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {product ? 'Modifier le produit' : 'Ajouter un produit'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom du produit</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Sandwich Jambon-Fromage"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description du produit"
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prix (€)</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                value={price}
                onChangeText={handlePriceChange}
                onBlur={handlePriceBlur}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.categoryContainer}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryButton,
                      category === cat.value && styles.categoryButtonActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        category === cat.value && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Image du produit</Text>
              <ProductImagePicker
                currentImage={image}
                onImageSelected={setImage}
              />
              <TextInput
                style={styles.input}
                placeholder="https://... ou laisser vide pour uploader une photo"
                placeholderTextColor="#9ca3af"
                value={image}
                onChangeText={setImage}
              />
            </View>

            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.availabilityToggle}
                onPress={() => setAvailable(!available)}
              >
                <View style={[styles.checkbox, available && styles.checkboxChecked]}>
                  {available && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.availabilityText}>Produit disponible</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.availabilityToggle}
                onPress={() => setCustomizable(!customizable)}
              >
                <View style={[styles.checkbox, customizable && styles.checkboxChecked]}>
                  {customizable && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.availabilityText}>Produit personnalisable</Text>
              </TouchableOpacity>
              {customizable && (
                <Text style={styles.customizableHint}>
                  Les clients pourront ajouter des commentaires ou demandes spéciales
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onBack}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>
              {product ? 'Modifier' : 'Ajouter'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    borderBottomColor: '#e2e8f0',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: Platform.select({ ios: -12, android: -1, default: -15 }) }],
  },
  backIcon: {
    fontSize: 32,
    color: '#2cbefb',
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
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryButtonActive: {
    backgroundColor: '#ecfeff',
    borderColor: '#2cbefb',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#2cbefb',
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  previewImage: {
    fontSize: 32,
  },
  availabilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
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
  availabilityText: {
    fontSize: 16,
    color: '#475569',
  },
  customizableHint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    marginLeft: 36,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
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
});
