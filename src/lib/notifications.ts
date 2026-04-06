/**
 * notifications.ts — Expo Push 알림 권한 요청 + 토큰 등록
 * Lock 1: Push 발송은 EF 내부에서만. 이 모듈은 토큰 획득 + Supabase 저장만 담당.
 * Phase 3: FOMO 경보 전용 Push 알림
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// 알림 수신 핸들러 설정 (앱 포그라운드 상태에서도 알림 표시)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Push 알림 권한 요청 + Expo Push Token 획득
 * 실기기에서만 동작 (시뮬레이터 미지원)
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // 실기기 여부 확인
  if (!Device.isDevice) {
    console.log('[notifications] Push notifications require a physical device');
    return null;
  }

  // Android 알림 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('fomo-alerts', {
      name: 'FOMO 경보',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DA7101',
    });
  }

  // 현재 권한 상태 확인
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 미결정 상태이면 권한 요청
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Push notification permission denied');
    return null;
  }

  // Expo Push Token 획득
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'a77e22ea-aca6-4700-852d-c77c8170b41a',
    });
    return tokenData.data;
  } catch (err) {
    console.error('[notifications] Failed to get Expo push token:', err);
    return null;
  }
}

/**
 * Supabase users 테이블에 Push Token 저장
 * Lock 3: users 테이블 UPDATE = auth.uid() = user_id 본인만 허용
 */
export async function savePushTokenToSupabase(
  userId: string,
  token: string,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('[notifications] Failed to save push token:', error.message);
  } else {
    console.log('[notifications] Push token saved successfully');
  }
}

/**
 * 권한 요청 + 토큰 획득 + Supabase 저장 원스톱 함수
 */
export async function initPushNotifications(userId: string): Promise<void> {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushTokenToSupabase(userId, token);
  }
}
