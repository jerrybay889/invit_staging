/**
 * Supabase 클라이언트 초기화
 * anon key만 사용. service_role은 Edge Function 전용.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 빌드에 EXPO_PUBLIC_SUPABASE_* 환경변수가 주입됐는지 여부.
 * standalone(EAS) 빌드에서 EAS 환경변수가 비어 있으면 false가 되며,
 * 이 경우 createClient가 undefined로 호출돼 모듈 로드 시 throw → 네이티브 침묵 크래시가 발생한다.
 * 아래 placeholder fallback으로 import-time throw를 막고, App에서 isSupabaseConfigured로 안내한다.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 누락 — ' +
      'EAS 빌드 환경변수가 주입되지 않았습니다. `eas env:push` 또는 EAS 대시보드에서 설정 필요.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.invalid.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
