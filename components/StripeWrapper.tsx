import React from 'react';

type StripeWrapperProps = {
  children: React.ReactNode;
};

// Ce fichier sert de base, mais sera remplacé par .native.tsx ou .web.tsx selon la plateforme
export function StripeWrapper({ children }: StripeWrapperProps) {
  // Version de base (sera surchargée par .native.tsx ou .web.tsx)
  return <>{children}</>;
}

