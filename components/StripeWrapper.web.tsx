import React from 'react';

type StripeWrapperProps = {
  children: React.ReactNode;
};

export function StripeWrapper({ children }: StripeWrapperProps) {
  // Sur le web, on retourne simplement les enfants sans wrapper Stripe
  return <>{children}</>;
}

