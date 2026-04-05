/**
 * TodayPrincipleCard — 오늘의 투자 원칙 카드
 * Lock 3: SELECT only (클라이언트에서 읽기만)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  principles: { content: string; is_active: boolean }[];
}

export default function TodayPrincipleCard({ principles }: Props) {
  const activePrinciples = principles.filter((p) => p.is_active);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>나의 투자 원칙</Text>

      {activePrinciples.length === 0 ? (
        <Text style={styles.empty}>
          아직 원칙이 없습니다. 투자 원칙을 설정해보세요.
        </Text>
      ) : (
        <View style={styles.list}>
          {activePrinciples.map((p, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.bullet}>{i + 1}</Text>
              <Text style={styles.principleText}>{p.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  label: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', marginBottom: 12 },
  empty: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  bullet: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary + '15',
    color: Colors.primary, fontSize: 12, fontWeight: '700',
    textAlign: 'center', lineHeight: 22, marginRight: 10,
  },
  principleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, flex: 1 },
});
