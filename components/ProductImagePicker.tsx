import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

type ProductImagePickerProps = {
  currentImage?: string;
  onImageSelected: (imageUrl: string) => void;
};

export function ProductImagePicker({ currentImage, onImageSelected }: ProductImagePickerProps) {
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de votre permission pour accéder à vos photos.'
      );
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de votre permission pour accéder à votre caméra.'
      );
      return false;
    }
    return true;
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);

      // Convertir l'URI en blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Créer une référence unique pour l'image
      const filename = `products/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const storageRef = ref(storage, filename);

      // Upload vers Firebase Storage
      await uploadBytes(storageRef, blob);

      // Obtenir l'URL de téléchargement
      const downloadURL = await getDownloadURL(storageRef);

      onImageSelected(downloadURL);
      Alert.alert('Succès', 'Image uploadée avec succès !');
    } catch (error: any) {
      console.error('❌ Erreur upload:', error);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      Alert.alert(
        'Erreur d\'upload',
        `${error.code || 'Erreur'}: ${error.message || 'Impossible d\'uploader l\'image.'}\n\nVérifiez que Firebase Storage est activé dans la console Firebase.`
      );
    } finally {
      setUploading(false);
    }
  };

  const pickImageFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const isEmoji = (str: string) => {
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u;
    return emojiRegex.test(str);
  };

  const isValidUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <View style={styles.container}>
      {currentImage && (
        <View style={styles.previewContainer}>
          {isEmoji(currentImage) ? (
            <Text style={styles.emojiPreview}>{currentImage}</Text>
          ) : isValidUrl(currentImage) ? (
            <Image source={{ uri: currentImage }} style={styles.imagePreview} />
          ) : (
            <Text style={styles.invalidText}>Image invalide</Text>
          )}
        </View>
      )}

      {uploading ? (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#2cbefb" />
          <Text style={styles.uploadingText}>Upload en cours...</Text>
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={pickImageFromGallery} activeOpacity={0.85}>
            <Ionicons name="images-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={takePhoto} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Photo</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.helpText}>
        Vous pouvez aussi coller une URL d'image dans le champ ci-dessous
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 150,
  },
  emojiPreview: {
    fontSize: 80,
  },
  imagePreview: {
    width: 200,
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  invalidText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  uploadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#00BCD4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
