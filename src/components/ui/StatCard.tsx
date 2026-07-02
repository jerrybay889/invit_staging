import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius, Shadow } from '../../constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  subtext?: string;
  style?: ViewStyle;
}

export default function StatCard({ label, value, unit, color = Colors.primary, subtext, style }: StatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit ? <Text style={[styles.unit, { color }]}>{unit}</Text> : null}
      </View>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontSize: 36, fontWeight: '800' },
  unit: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  subtext: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
});
