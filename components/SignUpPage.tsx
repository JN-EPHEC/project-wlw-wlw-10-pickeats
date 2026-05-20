import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { FirebaseError } from 'firebase/app';
import { auth, db, functions } from '../firebaseConfig';

type SignUpPageProps = {
  onSwitchToSignIn: () => void;
};

export function SignUpPage({ onSwitchToSignIn }: SignUpPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    setError(null);

    if (!email.trim() || !password || !confirmPassword || !phoneNumber.trim()) {
      setError('Veuillez remplir tous les champs requis.');
      return;
    }

    // Validation du format du numéro de téléphone (international)
    const cleanedPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    
    // Vérifier que le numéro commence par + ou est un numéro local belge
    const internationalRegex = /^\+[1-9]\d{6,14}$/;
    const belgianLocalRegex = /^0\d{8,9}$/;
    
    if (!internationalRegex.test(cleanedPhone) && !belgianLocalRegex.test(cleanedPhone)) {
      setError('Veuillez entrer un numéro de téléphone valide (format international: +32495123456 ou local: 0495123456).');
      return;
    }
    
    // Vérifier que ce n'est pas un numéro israélien (+972)
    if (cleanedPhone.startsWith('+972')) {
      setError('Ce pays n\'est pas supporté.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Vérifier si le numéro de téléphone est déjà utilisé via Cloud Function
      const checkPhoneNumber = httpsCallable(functions, 'checkPhoneNumberAvailability');
      const result = await checkPhoneNumber({ phoneNumber: cleanedPhone });
      const data = result.data as { available: boolean };
      
      if (!data.available) {
        setError('Ce numéro de téléphone est déjà associé à un compte.');
        setIsSubmitting(false);
        return;
      }

      // Créer le compte utilisateur
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      if (fullName.trim()) {
        await updateProfile(credential.user, { displayName: fullName.trim() });
      }

      // Enregistrer les données utilisateur dans Firestore
      await setDoc(doc(db, 'users', credential.user.uid), {
        fullName: fullName.trim() || null,
        email: credential.user.email,
        phoneNumber: cleanedPhone,
        createdAt: serverTimestamp(),
        loyaltyPoints: 0,
        totalOrders: 0,
        role: 'user',
      });

      // Créer l'entrée dans l'index des numéros de téléphone
      await setDoc(doc(db, 'phoneIndex', cleanedPhone), {
        userId: credential.user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error('Erreur inscription:', firebaseError);
      
      if (firebaseError.code === 'auth/email-already-in-use') {
        setError('Cette adresse e-mail est déjà utilisée.');
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (firebaseError.code === 'permission-denied') {
        setError('Erreur de permission. Vérifiez les règles de sécurité.');
      } else {
        setError(`Erreur: ${firebaseError.message || 'Impossible de créer votre compte. Veuillez réessayer.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/pickeat-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Créer mon compte</Text>
            <Text style={styles.subtitle}>Rejoignez PickEat en quelques secondes.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom complet</Text>
              <TextInput
                style={styles.input}
                placeholder="Jean Dupont"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
                autoComplete="name"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse e-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="votre.email@exemple.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <TextInput
                style={styles.input}
                placeholder="+32 495 12 34 56"
                placeholderTextColor="#9ca3af"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmez le mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="password-new"
                editable={!isSubmitting}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Vous avez déjà un compte ?{' '}
              <Text style={styles.link} onPress={onSwitchToSignIn}>
                Connectez-vous
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecfeff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    marginBottom: 12,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  button: {
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
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#00BCD4',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#4b5563',
  },
  link: {
    color: '#2cbefb',
    fontWeight: '500',
  },
});
