export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  customizable?: boolean;
  available?: boolean;
  createdAt?: any;
};

export type CartItem = {
  id: string; // Identifiant unique : productId + hash des customizations
  product: Product;
  quantity: number;
  customizations?: string[];
  // Pour les offres combinées
  isComboOffer?: boolean;
  comboProducts?: Product[]; // Tous les produits de l'offre
  comboTitle?: string; // Titre de l'offre
  comboDiscount?: number; // Pourcentage de réduction
};

export type TimeSlot = {
  id: string;
  time: string;
  available: number;
};

export type OrderHistoryEntry = {
  id: string;
  total: number;
  status: string;
  pickupTime?: string;
  createdAt: Date | null;
  items: {
    name: string;
    quantity: number;
    customizations?: string[];
    isComboOffer?: boolean;
    comboTitle?: string;
    comboDiscount?: number;
    comboProducts?: Array<{ id: string; name: string; price: number }>;
  }[];
};
