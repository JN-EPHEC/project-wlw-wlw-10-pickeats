import type { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';

type ForgotPasswordPageProps = {
  onBack: () => void;
  onSuccess?: () => void;
};

export function ForgotPasswordPage({ onBack, onSuccess }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Veuillez entrer votre adresse e-mail.');
      return;
    }

    if (!email.includes('@')) {
      setError('Veuillez entrer une adresse e-mail valide.');
      return;
    }

    setIsSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEmailSent(true);
      Alert.alert(
        'Email envoyé',
        'Vérifiez votre boîte de réception pour les instructions de réinitialisation du mot de passe.',
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              setEmailSent(false);
              onSuccess?.();
            },
          },
        ]
      );
    } catch (err) {
      const firebaseError = err as FirebaseError;
      if (firebaseError.code === 'auth/user-not-found') {
        setError('Aucun compte trouvé avec cette adresse e-mail.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('Adresse e-mail invalide.');
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setError('Trop de demandes. Réessayez plus tard.');
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
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
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/pickeat-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Réinitialiser le mot de passe</Text>
            <Text style={styles.subtitle}>
              Entrez votre adresse e-mail pour recevoir les instructions de réinitialisation.
            </Text>
          </View>

          <View style={styles.form}>
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
                editable={!isSubmitting && !emailSent}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {emailSent && (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text style={styles.successText}>Email envoyé avec succès</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isSubmitting || emailSent}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Envoyer les instructions</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onBack} disabled={isSubmitting}>
              <Text style={styles.backText}>Retour à la connexion</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoTitleRow}>
              <Ionicons name="bulb-outline" size={14} color="#92400e" />
              <Text style={styles.infoTitle}>Conseil</Text>
            </View>
            <Text style={styles.infoText}>
              Vérifiez votre dossier spam ou indésirables si vous ne recevez pas l'email dans les 5 minutes.
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
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: -8,
    top: -8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#2cbefb',
    fontWeight: '500',
  },
  logoContainer: {
    marginBottom: 12,
    marginTop: 20,
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
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
    lineHeight: 20,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '500',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
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
  backText: {
    fontSize: 14,
    color: '#2cbefb',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    padding: 12,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
});
