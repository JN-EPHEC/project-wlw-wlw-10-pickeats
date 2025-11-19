import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { auth } from "../firebaseConfig"; // Import de notre config

const AuthComponent = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null); // Pour suivre l'utilisateur connecté

  // Écoute les changements d'état de l'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // L'utilisateur est connecté
        setUser(currentUser);
      } else {
        // L'utilisateur est déconnecté
        setUser(null);
      }
    });

    // Cleanup à la désinscription
    return () => unsubscribe();
  }, []);

  // Fonction d'inscription
  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Utilisateur créé !", userCredential.user);
    } catch (error: any) {
      Alert.alert("Erreur Inscription", error.message);
    }
  };

  // Fonction de connexion
  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Utilisateur connecté !", userCredential.user);
    } catch (error: any) {
      Alert.alert("Erreur Connexion", error.message);
    }
  };

  // Fonction de déconnexion
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("Utilisateur déconnecté !");
    } catch (error: any) {
      Alert.alert("Erreur Déconnexion", error.message);
    }
  };

  if (user) {
    // Si l'utilisateur est connecté
    return (
      <View style={styles.container}>
        <Text>Bienvenue, {user.email}</Text>
        <Button title="Se déconnecter" onPress={handleSignOut} />
      </View>
    );
  }

  // Si l'utilisateur n'est pas connecté
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentification</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <View style={styles.buttonContainer}>
        <Button title="Se connecter" onPress={handleSignIn} />
        <Button title="S'inscrire" onPress={handleSignUp} color="#841584" />
      </View>
    </View>
  );
};

// Styles (simplifiés)
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
});

export default AuthComponent;