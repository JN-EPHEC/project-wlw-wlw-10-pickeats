import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';

type HelpSupportPageProps = {
  onBack: () => void;
};

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'Comment passer une commande ?',
    answer: 'Parcourez nos produits, ajoutez-les à votre panier, choisissez votre heure de retrait et validez votre commande. Vous recevrez une notification quand elle sera prête.',
  },
  {
    id: '2',
    question: 'Comment fonctionne la carte de fidélité ?',
    answer: 'Chaque commande de 5€ ou plus vous donne 1 point. Quand vous atteignez 10 points, vous recevez un bon de réduction de 5€ automatiquement appliqué sur votre prochaine commande.',
  },
  {
    id: '3',
    question: 'Puis-je annuler ma commande ?',
    answer: 'Vous pouvez annuler votre commande tant qu\'elle n\'est pas encore en préparation. Contactez-nous rapidement via l\'application ou par téléphone.',
  },
  {
    id: '4',
    question: 'Comment modifier mes informations personnelles ?',
    answer: 'Allez dans votre profil, puis "Informations personnelles" pour modifier votre nom, email ou mot de passe.',
  },
  {
    id: '5',
    question: 'Les produits sont-ils personnalisables ?',
    answer: 'Oui ! Certains produits peuvent être personnalisés. Vous verrez un champ de personnalisation lors de l\'ajout au panier si le produit le permet.',
  },
  {
    id: '6',
    question: 'Quels sont les moyens de paiement acceptés ?',
    answer: 'Nous acceptons les cartes bancaires (Visa, Mastercard) via notre système de paiement sécurisé. Le paiement sur place n\'est pas disponible.',
  },
  {
    id: '7',
    question: 'Combien de temps pour préparer ma commande ?',
    answer: 'Le délai de préparation varie selon les produits commandés. Vous choisissez votre heure de retrait lors de la commande, et nous vous notifions quand elle est prête.',
  },
  {
    id: '8',
    question: 'Que faire si mon produit ne me convient pas ?',
    answer: 'Si vous n\'êtes pas satisfait, contactez-nous immédiatement. Nous ferons notre possible pour trouver une solution adaptée.',
  },
];

export function HelpSupportPage({ onBack }: HelpSupportPageProps) {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleCall = () => {
    Linking.openURL('tel:+3224567890');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@pickeats.be?subject=Demande de support');
  };

  const handleReportProblem = () => {
    Alert.alert(
      'Signaler un problème',
      'Veuillez décrire votre problème par email à support@pickeats.be',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer un email', onPress: handleEmail },
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
        <Text style={styles.title}>Aide et support</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Contact rapide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 Contactez-nous</Text>
          
          <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
            <View style={styles.contactIcon}>
              <Text style={styles.contactEmoji}>📱</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Téléphone</Text>
              <Text style={styles.contactValue}>+32 2 456 78 90</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
            <View style={styles.contactIcon}>
              <Text style={styles.contactEmoji}>✉️</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>support@pickeats.be</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <View style={styles.contactCard}>
            <View style={styles.contactIcon}>
              <Text style={styles.contactEmoji}>🕒</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Horaires</Text>
              <Text style={styles.contactValue}>Lun-Ven: 8h-18h</Text>
              <Text style={styles.contactValueSmall}>Sam: 9h-14h</Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❓ Questions fréquentes</Text>
          
          {faqData.map((item) => (
            <View key={item.id} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleFAQ(item.id)}
              >
                <Text style={styles.faqQuestionText}>{item.question}</Text>
                <Text style={styles.faqToggle}>
                  {expandedFAQ === item.id ? '−' : '+'}
                </Text>
              </TouchableOpacity>
              
              {expandedFAQ === item.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{item.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠️ Autres actions</Text>
          
          <TouchableOpacity style={styles.actionItem} onPress={handleReportProblem}>
            <Text style={styles.actionIcon}>🐛</Text>
            <Text style={styles.actionText}>Signaler un problème</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert('Tutoriel', 'Le tutoriel sera disponible prochainement.')}
          >
            <Text style={styles.actionIcon}>📚</Text>
            <Text style={styles.actionText}>Tutoriel de l'application</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert('CGU', 'Les conditions d\'utilisation seront disponibles prochainement.')}
          >
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionText}>Conditions d'utilisation</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert('Confidentialité', 'La politique de confidentialité sera disponible prochainement.')}
          >
            <Text style={styles.actionIcon}>🔒</Text>
            <Text style={styles.actionText}>Politique de confidentialité</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoTitle}>Besoin d'aide ?</Text>
          <Text style={styles.infoText}>
            Notre équipe est disponible du lundi au vendredi de 8h à 18h et le samedi de 9h à 14h pour répondre à toutes vos questions.
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactEmoji: {
    fontSize: 24,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  contactValueSmall: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: '#2cbefb',
    fontWeight: '600',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
  },
  faqToggle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2cbefb',
    width: 30,
    textAlign: 'center',
  },
  faqAnswer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#f9fafb',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  infoCard: {
    backgroundColor: '#e0f2fe',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#075985',
    textAlign: 'center',
    lineHeight: 20,
  },
});
