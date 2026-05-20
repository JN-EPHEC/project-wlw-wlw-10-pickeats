import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

type SettingsPageProps = {
  onBack: () => void;
  user: FirebaseUser;
};

type UserSettings = {
  notifications: {
    orderUpdates: boolean;
    promotions: boolean;
    newsletter: boolean;
  };
  preferences: {
    darkMode: boolean;
    language: string;
  };
  dietary: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    lactoseFree: boolean;
  };
};

export function SettingsPage({ onBack, user }: SettingsPageProps) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      orderUpdates: true,
      promotions: true,
      newsletter: false,
    },
    preferences: {
      darkMode: false,
      language: 'fr',
    },
    dietary: {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      lactoseFree: false,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: UserSettings) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        settings: newSettings,
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les paramètres.');
    }
  };

  const toggleNotification = (key: keyof UserSettings['notifications']) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const toggleDietary = (key: keyof UserSettings['dietary']) => {
    const newSettings = {
      ...settings,
      dietary: {
        ...settings.dietary,
        [key]: !settings.dietary[key],
      },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const toggleDarkMode = () => {
    const newSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        darkMode: !settings.preferences.darkMode,
      },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    Alert.alert('Mode sombre', 'Cette fonctionnalité sera disponible prochainement.');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Info', 'Veuillez contacter le support pour supprimer votre compte.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Mises à jour de commande</Text>
              <Text style={styles.settingDescription}>Recevoir les notifications de statut</Text>
            </View>
            <Switch
              value={settings.notifications.orderUpdates}
              onValueChange={() => toggleNotification('orderUpdates')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.notifications.orderUpdates ? '#2cbefb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Promotions</Text>
              <Text style={styles.settingDescription}>Offres spéciales et nouveautés</Text>
            </View>
            <Switch
              value={settings.notifications.promotions}
              onValueChange={() => toggleNotification('promotions')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.notifications.promotions ? '#2cbefb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Newsletter</Text>
              <Text style={styles.settingDescription}>Actualités et conseils</Text>
            </View>
            <Switch
              value={settings.notifications.newsletter}
              onValueChange={() => toggleNotification('newsletter')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.notifications.newsletter ? '#2cbefb' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Préférences alimentaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences alimentaires</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Végétarien</Text>
              <Text style={styles.settingDescription}>Afficher les options végétariennes</Text>
            </View>
            <Switch
              value={settings.dietary.vegetarian}
              onValueChange={() => toggleDietary('vegetarian')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.dietary.vegetarian ? '#2cbefb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Végan</Text>
              <Text style={styles.settingDescription}>Afficher les options véganes</Text>
            </View>
            <Switch
              value={settings.dietary.vegan}
              onValueChange={() => toggleDietary('vegan')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.dietary.vegan ? '#2cbefb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sans gluten</Text>
              <Text style={styles.settingDescription}>Exclure les produits avec gluten</Text>
            </View>
            <Switch
              value={settings.dietary.glutenFree}
              onValueChange={() => toggleDietary('glutenFree')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.dietary.glutenFree ? '#2cbefb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sans lactose</Text>
              <Text style={styles.settingDescription}>Exclure les produits laitiers</Text>
            </View>
            <Switch
              value={settings.dietary.lactoseFree}
              onValueChange={() => toggleDietary('lactoseFree')}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.dietary.lactoseFree ? '#2cbefb' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Affichage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Affichage</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Mode sombre</Text>
              <Text style={styles.settingDescription}>Thème sombre pour l'application</Text>
            </View>
            <Switch
              value={settings.preferences.darkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={settings.preferences.darkMode ? '#2cbefb' : '#f3f4f6'}
            />
          </View>

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Langue</Text>
              <Text style={styles.settingDescription}>Français</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Zone dangereuse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zone dangereuse</Text>
          
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Text style={styles.dangerButtonText}>Supprimer mon compte</Text>
          </TouchableOpacity>
          <Text style={styles.dangerDescription}>
            Cette action est irréversible. Toutes vos données seront définitivement supprimées.
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
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  chevron: {
    fontSize: 18,
    color: '#2cbefb',
    fontWeight: '600',
  },
  dangerButton: {
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  dangerDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
});
