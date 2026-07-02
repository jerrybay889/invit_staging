import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/theme';

interface PillProps {
  label: string;
  color?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export default function Pill({ label, color = Colors.primary, style, size = 'md' }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '18' }, size === 'sm' && styles.sm, style]}>
      <Text style={[styles.label, { color }, size === 'sm' && styles.labelSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  label: { fontSize: 13, fontWeight: '600' },
  labelSm: { fontSize: 11 },
});
