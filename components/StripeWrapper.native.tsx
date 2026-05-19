import React from 'react';

type StripeWrapperProps = {
  children: React.ReactNode;
};

// Stripe désactivé sur mobile natif car il nécessite une configuration native complexe
// (prebuild + merchantIdentifier Apple Developer)
// Pour activer Stripe, il faut :
// 1. Configurer un merchantIdentifier dans app.json
// 2. Exécuter npx expo prebuild
// 3. Reconstruire l'application
export function StripeWrapper({ children }: StripeWrapperProps) {
  // Pour l'instant, on retourne simplement les enfants sans StripeProvider
  // Le paiement fonctionnera uniquement sur web où Stripe n'est pas utilisé
  return <>{children}</>;
}

