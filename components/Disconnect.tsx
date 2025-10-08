import { Button, StyleSheet, Text, View } from 'react-native';

export default function Disconnect({ onDisconnect }: { onDisconnect?: () => void }) {
  const handleDisconnect = () => {
    // Placeholder: Add your disconnect logic here (e.g., clear tokens, call API, etc.)
    if (onDisconnect) {
      onDisconnect();
    } else {
      alert('Disconnected!');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>You are connected.</Text>
      <Button title="Disconnect" onPress={handleDisconnect} color="#d9534f" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    marginBottom: 12,
    fontSize: 16,
  },
});
