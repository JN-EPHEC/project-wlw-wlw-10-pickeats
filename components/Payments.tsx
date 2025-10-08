import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PaymentIcon } from 'react-native-payment-icons';

export default function PaymentIcons() {
  return (
    <View style={styles.row}>
      <PaymentIcon type="visa" />
      <PaymentIcon type="master" width={50} />
      <PaymentIcon type="paypal" height="30%" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});