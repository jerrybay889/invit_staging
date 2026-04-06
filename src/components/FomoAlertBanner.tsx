/**
 * FomoAlertBanner — FOMO 경보 배너 컴포넌트
 * Colors.warning(#DA7101) 배경으로 경보 메시지 표시
 * "확인" 버튼으로 seen_at 업데이트 후 배너 숨김
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/colors';
import type { FOMOAlert } from '../types/database';

interface FomoAlertBannerProps {
  alert: FOMOAlert;
  onDismiss: () => Promise<void>;
}

export default function FomoAlertBanner({ alert, onDismiss }: FomoAlertBannerProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    await onDismiss();
    setDismissing(false);
  };

  const directionLabel = alert.direction === 'surge' ? '📈 시장 급등 경보' : '📉 시장 급락 경보';

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{directionLabel}</Text>
        <Text style={styles.changePct}>
          {alert.kospi_change_pct > 0 ? '+' : ''}{alert.kospi_change_pct.toFixed(2)}%
        </Text>
      </View>

      <Text style={styles.message}>{alert.message}</Text>

      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={handleDismiss}
        disabled={dismissing}
      >
        {dismissing ? (
          <ActivityIndicator size="small" color={Colors.warning} />
        ) : (
          <Text style={styles.dismissBtnText}>확인했습니다</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.warning + '15',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.warning,
  },
  changePct: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.warning,
  },
  message: {
    fontSize: 13,
    color: '#7A3400',
    lineHeight: 20,
    marginBottom: 12,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.warning,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 80,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
