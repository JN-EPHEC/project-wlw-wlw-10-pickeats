import React from 'react';
import { Image, Text } from 'react-native';

type ProductImageDisplayProps = {
  imageUrl: string;
  size?: number;
  style?: any;
};

export function ProductImageDisplay({ imageUrl, size = 40, style }: ProductImageDisplayProps) {
  const isEmoji = (str: string) => {
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u;
    return emojiRegex.test(str);
  };

  const isValidUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  if (isEmoji(imageUrl)) {
    return <Text style={[{ fontSize: size }, style]}>{imageUrl}</Text>;
  }

  if (isValidUrl(imageUrl)) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[{ width: size, height: size, borderRadius: size / 8 }, style]}
        resizeMode="cover"
      />
    );
  }

  // Fallback si l'image n'est ni un emoji ni une URL valide
  return <Text style={[{ fontSize: size }, style]}>🍽️</Text>;
}
