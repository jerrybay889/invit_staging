/**
 * P01_PrincipleManage — 투자 원칙 관리 화면
 * Lock 3: principles는 User-owned — client SELECT/INSERT/UPDATE/DELETE 허용
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
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import type { Principle } from '../types/database';

export default function P01_PrincipleManage() {
  const { user } = useAuth();
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState('');

  const fetchPrinciples = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('principles')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    setPrinciples((data as Principle[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPrinciples();
  }, [fetchPrinciples]);

  const addPrinciple = async () => {
    const trimmed = newContent.trim();
    if (!trimmed || !user) return;
    setSaving(true);
    const maxOrder = principles.length > 0
      ? Math.max(...principles.map(p => p.sort_order)) + 1
      : 1;
    const { data, error } = await supabase
      .from('principles')
      .insert({ user_id: user.id, content: trimmed, is_active: true, sort_order: maxOrder })
      .select()
      .single();
    if (error) {
      Alert.alert('오류', '원칙을 추가하지 못했습니다.');
    } else {
      setPrinciples(prev => [...prev, data as Principle]);
      setNewContent('');
    }
    setSaving(false);
  };

  const toggleActive = async (principle: Principle) => {
    if (!user) return;
    const updated = !principle.is_active;
    // optimistic update
    setPrinciples(prev =>
      prev.map(p => p.id === principle.id ? { ...p, is_active: updated } : p)
    );
    const { error } = await supabase
      .from('principles')
      .update({ is_active: updated, updated_at: new Date().toISOString() })
      .eq('id', principle.id)
      .eq('user_id', user.id);
    if (error) {
      // rollback
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
            await fetchPrinciples();
            Alert.alert('오류', '삭제하지 못했습니다.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Principle }) => (
    <View style={styles.row}>
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
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 새 원칙 추가 */}
      <View style={styles.addSection}>
        <TextInput
          style={styles.input}
          value={newContent}
          onChangeText={setNewContent}
          placeholder="새 투자 원칙을 입력하세요"
          placeholderTextColor={Colors.textMuted}
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={addPrinciple}
        />
        <TouchableOpacity
          style={[styles.addBtn, (!newContent.trim() || saving) && styles.addBtnDisabled]}
          onPress={addPrinciple}
          disabled={!newContent.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.addBtnText}>추가</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 원칙 목록 */}
      {principles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>원칙이 없습니다</Text>
          <Text style={styles.emptyText}>투자 원칙을 추가해보세요.{'\n'}원칙은 매일 일지 작성 시 활용됩니다.</Text>
        </View>
      ) : (
        <FlatList
          data={principles}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceBg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
  },
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
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  rowContent: {
    flex: 1,
  },
  rowText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  rowTextInactive: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
