/**
 * PhonePreviewFrame — PC 브라우저에서 앱을 폰 규격으로 보여주는 래퍼
 * Platform.OS === 'web' 일 때만 프레임 적용. 네이티브는 children pass-through.
 *
 * 핵심 레이아웃 원리:
 *   frame: position: relative  →  내부 절대위치 요소의 기준점을 폰 프레임으로 고정
 *   inner: position: absolute; inset: 0  →  React Navigation 탭바 포지셔닝이
 *         브라우저 뷰포트가 아닌 420×860px 프레임을 기준으로 동작
 */

import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

// 현재 시각 (웹 미리보기 상태바)
function useCurrentTime() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function PhonePreviewFrame({ children }: Props) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <WebFrame>{children}</WebFrame>
  );
}

function WebFrame({ children }: { children: React.ReactNode }) {
  const time = useCurrentTime();

  return (
    <View style={styles.outer}>
      {/* 폰 프레임 */}
      <View style={styles.frame}>

        {/* 상단 상태바 (장식 — 포인터 이벤트 없음) */}
        <View style={styles.statusBar} pointerEvents="none">
          <Text style={styles.statusTime}>{time}</Text>
          {/* Dynamic Island */}
          <View style={styles.dynamicIsland} />
          <Text style={styles.statusIcons}>▲▲▲  ■■■■</Text>
        </View>

        {/* ★ 핵심 수정: position absolute inner wrapper
            React Navigation 탭바·화면이 이 컨테이너 기준으로 포지셔닝됨
            → 탭바가 브라우저 바닥이 아닌 프레임 바닥에 위치 */}
        <View style={styles.inner}>
          {children}
        </View>
      </View>

      {/* 프레임 아래 레이블 */}
      <Text style={styles.frameLabel}>INVIT Preview · 웹 개발 모드</Text>
    </View>
  );
}

const FRAME_W = 390;
const FRAME_H = 844;
const STATUS_H = 50; // 상태바 영역 높이 (장식)

const styles = StyleSheet.create({
  outer: {
    minHeight: '100vh' as any,
    backgroundColor: '#1a1a1e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  } as any,

  frame: {
    width: FRAME_W,
    maxWidth: '100%' as any,
    height: FRAME_H,
    maxHeight: 'calc(100vh - 64px)' as any,
    backgroundColor: Colors.surfaceBg,
    borderRadius: Radius.full,
    overflow: 'hidden',
    // ★ 핵심: 내부 절대위치 요소의 기준점
    position: 'relative' as any,
    boxShadow: [
      '0 0 0 2px rgba(255,255,255,0.06)',
      '0 0 0 12px rgba(0,0,0,0.6)',
      '0 32px 96px rgba(0,0,0,0.7)',
      'inset 0 0 0 1px rgba(0,0,0,0.2)',
    ].join(', ') as any,
  } as any,

  // 장식용 상태바 (포인터 이벤트 없음, 콘텐츠 위에 오버레이)
  statusBar: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    height: STATUS_H,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 14,
  } as any,
  statusTime: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    width: 48,
  },
  dynamicIsland: {
    width: 120,
    height: 32,
    borderRadius: Radius.xl,
    backgroundColor: '#111',  // Dynamic Island — 의도적 칠흑 (디바이스 UI 재현)
    marginTop: -4,
  } as any,
  statusIcons: {
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: 1,
    width: 48,
    textAlign: 'right' as any,
  },

  // ★ 핵심: 폰 프레임 내부 콘텐츠 영역
  // position: absolute; inset: 0 → 모든 내부 요소가 프레임 기준으로 배치
  inner: {
    position: 'absolute' as any,
    top: STATUS_H,   // 상태바 높이만큼 내려서 상태바 장식과 겹치지 않게
    left: 0,
    right: 0,
    bottom: 0,
  } as any,

  frameLabel: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
  },
});
