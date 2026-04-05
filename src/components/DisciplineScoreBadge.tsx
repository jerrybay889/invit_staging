/**
 * DisciplineScoreBadge — 규율 점수 배지
 * CLAUDE.md UI 표시 기준:
 *   0~39  Red   "오늘 원칙 점검이 필요합니다"
 *   40~69 Gold  "꾸준히 하고 있습니다"
 *   70~89 Green "훌륭합니다!"
 *   90~100 Teal "오늘의 원칙 마스터"
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  score: number;
  streak: number;
}

function getScoreDisplay(score: number) {
  if (score >= 90) return { color: Colors.disciplineTeal, message: '오늘의 원칙 마스터' };
  if (score >= 70) return { color: Colors.disciplineGreen, message: '훌륭합니다!' };
  if (score >= 40) return { color: Colors.disciplineGold, message: '꾸준히 하고 있습니다' };
  return { color: Colors.disciplineRed, message: '오늘 원칙 점검이 필요합니다' };
}

export default function DisciplineScoreBadge({ score, streak }: Props) {
  const { color, message } = getScoreDisplay(score);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>규율 점수</Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.unit}>/100</Text>
      </View>
      <Text style={[styles.message, { color }]}>{message}</Text>
      {streak > 0 && (
        <Text style={styles.streak}>{streak}일 연속 기록 중</Text>
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
  label: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  score: { fontSize: 48, fontWeight: '800' },
  unit: { fontSize: 18, color: Colors.textMuted, marginLeft: 4 },
  message: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  streak: {
    fontSize: 13, color: Colors.primary, fontWeight: '500',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
});
