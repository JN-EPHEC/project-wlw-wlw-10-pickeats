import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React from "react";
import { Alert, Button, StyleSheet, View } from "react-native";
import { storage } from "../firebaseConfig";

export default function StorageComponent() {
  const testUpload = async () => {
    console.log("Test upload", "Début du test d'upload...");

    // In production, always verify if user is authenticated

    try {
      const storageRef = ref(storage, `images/ImageTest_${Date.now()}.txt`);
      const data = new Uint8Array([84, 101, 115, 116]); // 'Test' bytes
      console.log("testUpload: uploading small Uint8Array...", data);
      const snap = await uploadBytes(storageRef, data);
      console.log("testUpload success:", snap);
      const url = await getDownloadURL(snap.ref);
      Alert.alert("Test upload — succès", url);
    } catch (err: any) {
      console.error("testUpload error:", err);
      Alert.alert("Test upload — erreur", err?.message ?? String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Send file" onPress={testUpload} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  button: { backgroundColor: "#007AFF", padding: 14, borderRadius: 8 },
  buttonText: { color: "white", fontWeight: "700" },
});