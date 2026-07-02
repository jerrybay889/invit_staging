/**
 * ArchetypeResultCard — 아키타입 결과 표시 카드
 * ARCHETYPE_DEFINITIONS에서 아키타입 정보를 조회하여 표시
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Archetype, BiasFlags } from '../types/database';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import { Colors } from '../constants/colors';
import { Radius, Shadow } from '../constants/theme';

interface Props {
  archetype: Archetype;
  biasFlags: BiasFlags;
}

const BIAS_LABELS: Record<keyof BiasFlags, string> = {
  loss_aversion: '손실회피',
  fomo: 'FOMO',
  overconfidence: '과잉확신',
  disposition: '처분효과',
  herding: '군집행동',
  present_bias: '현재편향',
  confirmation: '확증편향',
};

export default function ArchetypeResultCard({ archetype, biasFlags }: Props) {
  const def = ARCHETYPE_DEFINITIONS.find((d) => d.key === archetype);
  if (!def) return null;

  const activeBiases = (Object.entries(biasFlags) as [keyof BiasFlags, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => BIAS_LABELS[k]);

  return (
    <View style={[styles.card, { borderLeftColor: def.color }]}>
      <Text style={[styles.archetypeName, { color: def.color }]}>{def.nameKo}</Text>
      <Text style={styles.description}>{def.description}</Text>

      {activeBiases.length > 0 && (
        <View style={styles.biasSection}>
          <Text style={styles.biasTitle}>감지된 편향</Text>
          <View style={styles.biasChips}>
            {activeBiases.map((label) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    padding: 20,
    marginVertical: 8,
    ...Shadow.card,
  },
  archetypeName: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  biasSection: { marginTop: 16 },
  biasTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  biasChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: Colors.error + '12',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: Colors.error, fontWeight: '600' },
});
