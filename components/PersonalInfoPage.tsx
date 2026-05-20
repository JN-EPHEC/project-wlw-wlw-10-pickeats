import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, functions } from '@/firebaseConfig';
import { doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  updateEmail, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  type User as FirebaseUser 
} from 'firebase/auth';

type PersonalInfoPageProps = {
  onBack: () => void;
  user: FirebaseUser;
  onReloadUser?: () => void;
};

export function PersonalInfoPage({ onBack, user, onReloadUser }: PersonalInfoPageProps) {
  const [editMode, setEditMode] = useState<'none' | 'name' | 'email' | 'password' | 'phone'>('none');
  const [loading, setLoading] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState('');

  // Champs du formulaire
  const [fullName, setFullName] = useState(user.displayName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Charger le numéro de téléphone au montage
  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserPhoneNumber(data.phoneNumber || '');
          setPhoneNumber(data.phoneNumber || '');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };
    loadUserData();
  }, [user.uid]);

  const handleUpdateName = async () => {
    if (!fullName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide.');
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: fullName.trim(),
      });
      
      Alert.alert('Succès', 'Votre nom a été mis à jour.');
      setEditMode('none');
      onReloadUser?.();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du nom:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour votre nom.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide.');
      return;
    }

    if (!currentPassword) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel pour confirmer.');
      return;
    }

    try {
      setLoading(true);

      // Ré-authentification requise pour changer l'email
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Mettre à jour l'email Firebase Auth
      await updateEmail(user, email.trim());

      // Mettre à jour l'email dans Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        email: email.trim(),
      });

      Alert.alert('Succès', 'Votre email a été mis à jour.');
      setEditMode('none');
      setCurrentPassword('');
      onReloadUser?.();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de l\'email:', error);
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Erreur', 'Mot de passe incorrect.');
      } else if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Erreur', 'Cet email est déjà utilisé.');
      } else if (error.code === 'auth/requires-recent-login') {
        Alert.alert('Erreur', 'Veuillez vous reconnecter puis réessayer.');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour votre email.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setLoading(true);

      // Ré-authentification requise pour changer le mot de passe
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Mettre à jour le mot de passe
      await updatePassword(user, newPassword);

      Alert.alert('Succès', 'Votre mot de passe a été mis à jour.');
      setEditMode('none');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Erreur', 'Mot de passe actuel incorrect.');
      } else if (error.code === 'auth/requires-recent-login') {
        Alert.alert('Erreur', 'Veuillez vous reconnecter puis réessayer.');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour votre mot de passe.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhoneNumber = async () => {
    const cleanedPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    
    if (!cleanedPhone.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone.');
      return;
    }
    
    // Vérifier que le numéro commence par + ou est un numéro local belge
    const internationalRegex = /^\+[1-9]\d{6,14}$/;
    const belgianLocalRegex = /^0\d{8,9}$/;
    
    if (!internationalRegex.test(cleanedPhone) && !belgianLocalRegex.test(cleanedPhone)) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide (format international: +33612345678 ou local belge: 0495123456).');
      return;
    }
    
    // Vérifier que ce n'est pas un numéro israélien (+972)
    if (cleanedPhone.startsWith('+972')) {
      Alert.alert('Erreur', 'Ce pays n\'est pas supporté.');
      return;
    }

    // Si le numéro a changé, vérifier qu'il n'est pas déjà utilisé
    if (cleanedPhone !== userPhoneNumber) {
      try {
        const checkPhoneNumber = httpsCallable(functions, 'checkPhoneNumberAvailability');
        const result = await checkPhoneNumber({ phoneNumber: cleanedPhone });
        const data = result.data as { available: boolean };
        
        if (!data.available) {
          Alert.alert('Erreur', 'Ce numéro de téléphone est déjà utilisé par un autre compte.');
          return;
        }
      } catch (error) {
        console.error('Erreur lors de la vérification:', error);
        Alert.alert('Erreur', 'Impossible de vérifier le numéro.');
        return;
      }
    }

    try {
      setLoading(true);
      
      // Mettre à jour le numéro dans le profil utilisateur
      await updateDoc(doc(db, 'users', user.uid), {
        phoneNumber: cleanedPhone,
      });

      // Si le numéro a changé, mettre à jour l'index
      if (cleanedPhone !== userPhoneNumber && userPhoneNumber) {
        // Supprimer l'ancien index
        await deleteDoc(doc(db, 'phoneIndex', userPhoneNumber));
      }
      
      // Créer le nouvel index
      if (cleanedPhone !== userPhoneNumber) {
        await setDoc(doc(db, 'phoneIndex', cleanedPhone), {
          userId: user.uid,
          createdAt: new Date(),
        });
      }
      
      setUserPhoneNumber(cleanedPhone);
      Alert.alert('Succès', 'Votre numéro de téléphone a été mis à jour.');
      setEditMode('none');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du téléphone:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour votre numéro.');
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditMode('none');
    setFullName(user.displayName || '');
    setEmail(user.email || '');
    setPhoneNumber(userPhoneNumber);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Informations personnelles</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Nom complet */}
        <View style={styles.section}>
          <View style={styles.fieldHeader}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="person-outline" size={16} color="#1A1A2E" />
              <Text style={styles.fieldLabel}>Nom complet</Text>
            </View>
            {editMode !== 'name' && (
              <TouchableOpacity onPress={() => setEditMode('name')}>
                <Text style={styles.editButton}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode === 'name' ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Prénom Nom"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                editable={!loading}
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdateName}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>{user.displayName || 'Non renseigné'}</Text>
          )}
        </View>

        {/* Email */}
        <View style={styles.section}>
          <View style={styles.fieldHeader}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="mail-outline" size={16} color="#1A1A2E" />
              <Text style={styles.fieldLabel}>Email</Text>
            </View>
            {editMode !== 'email' && (
              <TouchableOpacity onPress={() => setEditMode('email')}>
                <Text style={styles.editButton}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode === 'email' ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemple.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Mot de passe actuel (confirmation)"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                editable={!loading}
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdateEmail}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>{user.email}</Text>
          )}
        </View>

        {/* Mot de passe */}
        <View style={styles.section}>
          <View style={styles.fieldHeader}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="lock-closed-outline" size={16} color="#1A1A2E" />
              <Text style={styles.fieldLabel}>Mot de passe</Text>
            </View>
            {editMode !== 'password' && (
              <TouchableOpacity onPress={() => setEditMode('password')}>
                <Text style={styles.editButton}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode === 'password' ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Mot de passe actuel"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nouveau mot de passe (min. 6 caractères)"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmer le nouveau mot de passe"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                editable={!loading}
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdatePassword}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>••••••••</Text>
          )}
        </View>

        {/* Numéro de téléphone */}
        <View style={styles.section}>
          <View style={styles.fieldHeader}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="call-outline" size={16} color="#1A1A2E" />
              <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
            </View>
            {editMode !== 'phone' && (
              <TouchableOpacity onPress={() => setEditMode('phone')}>
                <Text style={styles.editButton}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode === 'phone' ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+33612345678, +32495123456, 0495123456..."
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                editable={!loading}
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdatePhoneNumber}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>{userPhoneNumber || 'Non renseigné'}</Text>
          )}
        </View>

        {/* Info de sécurité */}
        <View style={styles.infoCard}>
          <Ionicons name="lock-closed-outline" size={32} color="#92400e" style={styles.infoIcon} />
          <Text style={styles.infoTitle}>Sécurité de votre compte</Text>
          <Text style={styles.infoText}>
            Pour votre sécurité, nous vous demanderons votre mot de passe actuel lors de la modification de votre email ou mot de passe.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2cbefb',
  },
  fieldValue: {
    fontSize: 16,
    color: '#4b5563',
  },
  editContainer: {
    gap: 12,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 15,
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
    minHeight: 48,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fef3c7',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  infoIcon: {
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 20,
  },
});
