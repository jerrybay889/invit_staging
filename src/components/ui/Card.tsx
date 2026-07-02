import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius, Shadow } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  accent?: string;
  padding?: number;
}

export default function Card({ children, style, elevated, accent, padding = 16 }: CardProps) {
  return (
    <View style={[
      styles.card,
      { padding },
      elevated && styles.elevated,
      accent ? { borderLeftWidth: 3, borderLeftColor: accent, borderColor: Colors.border } : undefined,
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  elevated: {
    ...Shadow.elevated,
    borderWidth: 0,
  },
});
