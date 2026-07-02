/**
 * StockSearchInput — 종목 검색 자동완성 (마스터플랜 0617 Pillar 1)
 *
 * - stocks 테이블을 1회 로드해 모듈 캐시 → 클라이언트에서 초성/부분일치 검색(koreanSearch).
 * - asset_type 기반 필터 탭 (전체/주식/ETF/ETN).
 * - ETF/ETN 배지 표시.
 * - stocks 시드 전이거나 매칭이 없으면 '직접 입력' fallback 행을 제공(graceful degradation).
 *
 * 저장값(ticker)은 종목코드 문자열. 표시값은 "종목명 (코드)".
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { Radius, Spacing } from '../constants/theme';
import { searchStocks } from '../lib/koreanSearch';
import type { Stock, AssetType } from '../types/database';

// 모듈 레벨 캐시 (앱 세션 내 1회 로드)
let stockCache: Stock[] | null = null;
let stockCachePromise: Promise<Stock[]> | null = null;

async function loadStocks(): Promise<Stock[]> {
  if (stockCache) return stockCache;
  if (stockCachePromise) return stockCachePromise;
  stockCachePromise = (async () => {
    const { data, error } = await supabase
      .from('stocks')
      .select('code, name, market, type, asset_type, is_active, listing_status, updated_at')
      .eq('is_active', true)
      .eq('search_enabled', true);
    if (error) {
      console.warn('[StockSearchInput] stocks load failed:', error.message);
      return [];
    }
    stockCache = (data as Stock[]) ?? [];
    return stockCache;
  })();
  return stockCachePromise;
}

type FilterTab = 'all' | 'stock' | 'etf' | 'etn';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'stock', label: '주식' },
  { key: 'etf', label: 'ETF' },
  { key: 'etn', label: 'ETN' },
];

function getAssetTypeBadge(stock: Stock): string | null {
  const at = (stock.asset_type ?? stock.type ?? '').toUpperCase();
  if (at === 'ETF') return 'ETF';
  if (at === 'ETN') return 'ETN';
  if (at === 'ELW') return 'ELW';
  if (at === 'REITS') return 'REIT';
  return null;
}

function matchesFilter(stock: Stock, tab: FilterTab): boolean {
  if (tab === 'all') return true;
  const at = (stock.asset_type ?? stock.type ?? '').toUpperCase();
  if (tab === 'stock') return at === 'STOCK' || at === 'STOCK'.toLowerCase();
  if (tab === 'etf') return at === 'ETF';
  if (tab === 'etn') return at === 'ETN';
  return true;
}

interface Props {
  value: string;
  onSelect: (stock: Stock | null) => void;
  placeholder?: string;
}

export default function StockSearchInput({ value, onSelect, placeholder }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(stockCache ?? []);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    let mounted = true;
    loadStocks().then((list) => { if (mounted) setStocks(list); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!value) { setSelectedLabel(''); return; }
    const found = stocks.find((s) => s.code === value);
    setSelectedLabel(found ? `${found.name} (${found.code})` : value);
  }, [value, stocks]);

  const filteredStocks = useMemo(
    () => stocks.filter(s => matchesFilter(s, activeTab)),
    [stocks, activeTab],
  );

  const results = useMemo(() => {
    if (!focused || query.trim().length === 0) return [];
    return searchStocks(query, filteredStocks, 8);
  }, [focused, query, filteredStocks]);

  const handleSelect = useCallback(
    (stock: Stock) => {
      onSelect(stock);
      setSelectedLabel(`${stock.name} (${stock.code})`);
      setQuery('');
      setFocused(false);
    },
    [onSelect],
  );

  const handleManualSelect = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const synthetic: Stock = {
      code: trimmed, name: trimmed,
      market: 'UNKNOWN', type: 'stock',
      is_active: true, updated_at: new Date().toISOString(),
    };
    handleSelect(synthetic);
  }, [query, handleSelect]);

  const handleClear = useCallback(() => {
    onSelect(null);
    setSelectedLabel('');
    setQuery('');
    setFocused(true);
  }, [onSelect]);

  if (value && !focused) {
    return (
      <View style={styles.selectedRow}>
        <Text style={styles.selectedText} numberOfLines={1}>{selectedLabel}</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={8}>
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* 필터 탭 */}
      <View style={styles.tabRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        placeholder={placeholder ?? '종목명 또는 코드 검색 (예: 삼성전자, KODEX200)'}
        placeholderTextColor={Colors.textMuted}
        autoCorrect={false}
      />

      {focused && query.trim().length > 0 && (
        <View style={styles.dropdown}>
          {results.map((stock) => {
            const badge = getAssetTypeBadge(stock);
            return (
              <TouchableOpacity
                key={stock.code}
                style={styles.resultRow}
                onPress={() => handleSelect(stock)}
              >
                <View style={styles.resultLeft}>
                  <Text style={styles.resultName}>{stock.name}</Text>
                  <Text style={styles.resultMeta}>{stock.code} · {stock.market}</Text>
                </View>
                {badge && (
                  <View style={[styles.badge, badge === 'ETF' ? styles.badgeETF : badge === 'ETN' ? styles.badgeETN : styles.badgeOther]}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {results.length === 0 && (
            <TouchableOpacity style={styles.resultRow} onPress={handleManualSelect}>
              <Text style={styles.resultName}>'{query.trim()}' 직접 입력</Text>
              <Text style={styles.resultMeta}>검색 결과 없음 — 입력값으로 기록</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.smd,
    paddingVertical: Spacing.smd,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
  },
  dropdown: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.smd,
    paddingVertical: Spacing.smd,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  resultLeft: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  resultMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  badgeETF: {
    backgroundColor: '#E8F4F0',
  },
  badgeETN: {
    backgroundColor: '#FEF3E8',
  },
  badgeOther: {
    backgroundColor: Colors.surface,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.smd,
    paddingVertical: Spacing.smd,
    backgroundColor: Colors.primaryLight,
  },
  selectedText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: 6,
  },
  clearText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
