import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface SectionLabelProps {
  label: string;
  style?: ViewStyle;
}

export default function SectionLabel({ label, style }: SectionLabelProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
