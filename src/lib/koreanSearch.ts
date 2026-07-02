/**
 * koreanSearch — 한글 초성 + 부분일치 검색 유틸 (의존성 없음)
 * 마스터플랜 0617 — Pillar 1 종목 검색 자동완성에서 사용.
 *
 * 예: '삼전' → 삼성전자, 'LG화' → LG화학, '005930' → 삼성전자
 */

import type { Stock } from '../types/database';

// 한글 초성 19자
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const HANGUL_BASE = 0xac00; // '가'
const HANGUL_END = 0xd7a3;  // '힣'

/**
 * 문자열의 한글 음절을 초성으로 변환. 한글이 아닌 문자는 그대로 둔다.
 */
export function getChosung(text: string): string {
  let result = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_END) {
      result += CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)];
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 종목 1건에 대한 매칭 점수. 높을수록 우선. 비매칭은 -1.
 */
export function scoreStock(query: string, stock: Stock): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;

  const name = stock.name.toLowerCase();
  const code = stock.code.toLowerCase();

  if (code === q) return 100;
  if (name === q) return 95;
  if (code.startsWith(q)) return 90;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (code.includes(q)) return 50;

  // 초성 매칭 (예: '삼전' → 삼성전자)
  const queryCho = getChosung(q);
  const nameCho = getChosung(name);
  if (nameCho.startsWith(queryCho)) return 40;
  if (nameCho.includes(queryCho)) return 30;

  return -1;
}

/**
 * 종목 목록에서 검색어와 매칭되는 항목을 점수순으로 정렬해 반환.
 */
export function searchStocks(query: string, stocks: Stock[], limit = 10): Stock[] {
  const scored: { stock: Stock; score: number }[] = [];
  for (const stock of stocks) {
    const score = scoreStock(query, stock);
    if (score >= 0) scored.push({ stock, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.stock.name.localeCompare(b.stock.name, 'ko');
  });
  return scored.slice(0, limit).map((s) => s.stock);
}
