import React from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ProductImageDisplayProps = {
  imageUrl: string;
  size?: number;
  style?: any;
};

export function ProductImageDisplay({ imageUrl, size = 40, style }: ProductImageDisplayProps) {
  const isValidUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  if (imageUrl && isValidUrl(imageUrl)) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[{ width: size, height: size, borderRadius: size / 8 }, style]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 8,
          backgroundColor: '#F0FDFF',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name="restaurant-outline" size={Math.round(size * 0.5)} color="#00BCD4" />
    </View>
  );
}
