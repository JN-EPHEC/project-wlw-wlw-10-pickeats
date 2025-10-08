import React from 'react';

// Définition des produits du menu
const Sandwich = {
  nom: 'Sandwich Jambon-Fromage',
  description: 'Pain frais, jambon, fromage, salade',
  prix: 4.5,
};

const Boisson = {
  nom: 'Boisson Orange',
  description: 'Bouteille 33cl',
  prix: 2.0,
};

const Snacks = {
  nom: 'Barre Céréales',
  description: 'Barre énergétique aux fruits',
  prix: 1.5,
};

const produits = [Sandwich, Boisson, Snacks];

const Menu: React.FC = () => (
  <div>
    <h2>Menu</h2>
    <ul>
      {produits.map((produit, idx) => (
        <li key={idx}>
          <strong>{produit.nom}</strong> - {produit.description} : {produit.prix}€
        </li>
      ))}
    </ul>
  </div>
);

export default Menu;
