/**
 * showAlert — react-native-web에서 Alert.alert()가 무동작(UI 미표시)인 문제 대응.
 * 네이티브(iOS/Android)는 기존 Alert.alert 그대로, 웹은 window.alert + 주 버튼 콜백 실행으로 대체.
 */
import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  window.alert(message ? `${title}\n\n${message}` : title);

  // 웹은 버튼별 분기가 없으므로, cancel이 아닌 첫 버튼(주 액션)의 onPress만 실행
  const primary = buttons?.find((b) => b.style !== 'cancel') ?? buttons?.[0];
  primary?.onPress?.();
}
