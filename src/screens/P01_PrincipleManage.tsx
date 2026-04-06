/**
 * P01_PrincipleManage — 투자 원칙 관리 화면
 * Lock 3: principles는 User-owned — client SELECT/INSERT/UPDATE/DELETE 허용
 *          archetype_templates는 Admin-managed — client SELECT만 허용 (is_active=true)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import type { Principle } from '../types/database';

interface ArchetypeTemplate {
  id: string;
  archetype: string;
  category: string;
  content: string;
}

export default function P01_PrincipleManage() {
  const { user } = useAuth();
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [templates, setTemplates] = useState<ArchetypeTemplate[]>([]);
  const [userArchetype, setUserArchetype] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;

    // 병렬 조회: 내 원칙 + 내 아키타입
    const [principlesRes, profileRes] = await Promise.all([
      supabase
        .from('principles')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('users')
        .select('coaching_archetype')
        .eq('id', user.id)
        .single(),
    ]);

    setPrinciples((principlesRes.data as Principle[]) ?? []);

    const archetype = (profileRes.data as any)?.coaching_archetype ?? null;
    setUserArchetype(archetype);

    // 아키타입이 있으면 추천 원칙 조회
    if (archetype) {
      const { data: tplData } = await supabase
        .from('archetype_templates')
        .select('id, archetype, category, content')
        .eq('archetype', archetype);
      setTemplates((tplData as ArchetypeTemplate[]) ?? []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 이미 추가된 원칙 내용 Set (중복 체크용)
  const addedContents = new Set(principles.map(p => p.content));

  const addPrinciple = async (content: string) => {
    if (!content.trim() || !user) return;
    const maxOrder = principles.length > 0
      ? Math.max(...principles.map(p => p.sort_order)) + 1
      : 1;
    const { data, error } = await supabase
      .from('principles')
      .insert({ user_id: user.id, content: content.trim(), is_active: true, sort_order: maxOrder })
      .select()
      .single();
    if (error) {
      Alert.alert('오류', '원칙을 추가하지 못했습니다.');
      return false;
    }
    setPrinciples(prev => [...prev, data as Principle]);
    return true;
  };

  const handleAddManual = async () => {
    setSaving(true);
    const ok = await addPrinciple(newContent);
    if (ok) setNewContent('');
    setSaving(false);
  };

  const handleAddTemplate = async (template: ArchetypeTemplate) => {
    setAddingTemplateId(template.id);
    await addPrinciple(template.content);
    setAddingTemplateId(null);
  };

  const toggleActive = async (principle: Principle) => {
    if (!user) return;
    const updated = !principle.is_active;
    setPrinciples(prev =>
      prev.map(p => p.id === principle.id ? { ...p, is_active: updated } : p)
    );
    const { error } = await supabase
      .from('principles')
      .update({ is_active: updated, updated_at: new Date().toISOString() })
      .eq('id', principle.id)
      .eq('user_id', user.id);
    if (error) {
      setPrinciples(prev =>
        prev.map(p => p.id === principle.id ? { ...p, is_active: principle.is_active } : p)
      );
      Alert.alert('오류', '변경하지 못했습니다.');
    }
  };

  const deletePrinciple = (principle: Principle) => {
    Alert.alert('원칙 삭제', `"${principle.content}"를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          if (!user) return;
          setPrinciples(prev => prev.filter(p => p.id !== principle.id));
          const { error } = await supabase
            .from('principles')
            .delete()
            .eq('id', principle.id)
            .eq('user_id', user.id);
          if (error) {
            await fetchAll();
            Alert.alert('오류', '삭제하지 못했습니다.');
          }
        },
      },
    ]);
  };

  const archetypeDef = userArchetype
    ? ARCHETYPE_DEFINITIONS.find(a => a.key === userArchetype)
    : null;

  const categoryLabel: Record<string, string> = {
    principle_reminder: '원칙 리마인더',
    daily_nudge: '일일 넛지',
    fomo_response: 'FOMO 대응',
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>원칙 관리</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
        {/* 새 원칙 직접 입력 */}
        <View style={styles.addSection}>
          <TextInput
            style={styles.input}
            value={newContent}
            onChangeText={setNewContent}
            placeholder="새 투자 원칙을 직접 입력하세요"
            placeholderTextColor={Colors.textMuted}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={handleAddManual}
          />
          <TouchableOpacity
            style={[styles.addBtn, (!newContent.trim() || saving) && styles.addBtnDisabled]}
            onPress={handleAddManual}
            disabled={!newContent.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.addBtnText}>추가</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 아키타입 추천 원칙 */}
        {templates.length > 0 && (
          <View style={styles.suggestSection}>
            <TouchableOpacity
              style={styles.suggestHeader}
              onPress={() => setSuggestionsExpanded(prev => !prev)}
            >
              <View style={styles.suggestHeaderLeft}>
                <Text style={styles.suggestTitle}>
                  {archetypeDef?.nameKo ?? userArchetype} 추천 원칙
                </Text>
                <Text style={styles.suggestSubtitle}>
                  당신의 투자 성향에 맞게 선별된 원칙입니다
                </Text>
              </View>
              <Text style={styles.chevron}>
                {suggestionsExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {suggestionsExpanded && (
              <View style={styles.suggestList}>
                {templates.map(tpl => {
                  const alreadyAdded = addedContents.has(tpl.content);
                  const isAdding = addingTemplateId === tpl.id;
                  return (
                    <View key={tpl.id} style={styles.suggestCard}>
                      <View style={styles.suggestCardHeader}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>
                            {categoryLabel[tpl.category] ?? tpl.category}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.addTplBtn,
                            alreadyAdded && styles.addTplBtnAdded,
                          ]}
                          onPress={() => !alreadyAdded && handleAddTemplate(tpl)}
                          disabled={alreadyAdded || isAdding}
                        >
                          {isAdding ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <Text style={[
                              styles.addTplBtnText,
                              alreadyAdded && styles.addTplBtnTextAdded,
                            ]}>
                              {alreadyAdded ? '✓ 추가됨' : '+ 추가'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.suggestContent}>{tpl.content}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 내 원칙 목록 */}
        <View style={styles.myPrinciplesSection}>
          <Text style={styles.sectionLabel}>
            내 원칙 {principles.length > 0 ? `(${principles.length})` : ''}
          </Text>
          {principles.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>원칙이 없습니다</Text>
              <Text style={styles.emptyText}>
                위 추천 원칙을 추가하거나{'\n'}직접 입력해 나만의 원칙을 만들어보세요.
              </Text>
            </View>
          ) : (
            principles.map(item => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowText, !item.is_active && styles.rowTextInactive]}>
                    {item.content}
                  </Text>
                </View>
                <Switch
                  value={item.is_active}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
                <TouchableOpacity onPress={() => deletePrinciple(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scrollContent: { paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceBg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.surfaceBg,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  // 직접 입력
  addSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  // 추천 원칙
  suggestSection: {
    margin: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    overflow: 'hidden',
  },
  suggestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.primary + '08',
  },
  suggestHeaderLeft: { flex: 1 },
  suggestTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  suggestSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 13, color: Colors.primary, marginLeft: 8 },
  suggestList: { paddingHorizontal: 12, paddingBottom: 12 },
  suggestCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: Colors.surfaceBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  addTplBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: 'center',
  },
  addTplBtnAdded: { borderColor: Colors.border, backgroundColor: Colors.border + '40' },
  addTplBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  addTplBtnTextAdded: { color: Colors.textMuted },
  suggestContent: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  // 내 원칙
  myPrinciplesSection: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 14, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: 10, marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: 8,
  },
  rowContent: { flex: 1 },
  rowText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  rowTextInactive: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '500' },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
