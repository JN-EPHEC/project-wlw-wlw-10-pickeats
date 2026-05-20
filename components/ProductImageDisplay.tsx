import React from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type ProductImageDisplayProps = {
  imageUrl: string;
  size?: number;
  style?: any;
  category?: string;
};

const categoryIcons: Record<string, IoniconName> = {
  'sandwich-chaud': 'flame-outline',
  'sandwich-froid': 'fast-food-outline',
  pasta: 'restaurant-outline',
  drink: 'cafe-outline',
  snack: 'nutrition-outline',
  salade: 'leaf-outline',
};

export function ProductImageDisplay({ imageUrl, size = 40, style, category }: ProductImageDisplayProps) {
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
        style={[{ width: size, height: size, borderRadius: 8 }, style]}
        resizeMode="cover"
      />
    );
  }

  const iconName: IoniconName = (category && categoryIcons[category]) || 'restaurant-outline';

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 8,
          backgroundColor: '#F0FDFF',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={iconName} size={Math.round(size * 0.5)} color="#00BCD4" />
    </View>
  );
}
