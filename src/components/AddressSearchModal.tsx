import React from 'react';
import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Postcode from '@actbase/react-daum-postcode';
import type { OnCompleteParams } from '@actbase/react-daum-postcode/lib/types';

export interface AddressSelectedPayload {
  address: string;
  roadAddress: string;
  jibunAddress: string;
}

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelected: (payload: AddressSelectedPayload) => void;
}

export function AddressSearchModal({ visible, onClose, onSelected }: AddressSearchModalProps) {
  const insets = useSafeAreaInsets();
  const safeTopInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

  const handleSelected = (data: OnCompleteParams) => {
    onSelected({
      address: data.address ?? '',
      roadAddress: data.roadAddress ?? '',
      jibunAddress: data.jibunAddress ?? '',
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={[styles.header, { paddingTop: safeTopInset }]}>
          <Text style={styles.title}>주소 검색하기</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <X size={20} color="#17171c" />
          </Pressable>
        </View>
        <Postcode
          style={styles.postcode}
          jsOptions={{ animation: true, hideMapBtn: true }}
          onSelected={handleSelected}
          onError={() => {
            // 1차 범위에서는 실패 시 무시(no-op)하고 모달만 유지/닫기 가능하게 둔다.
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    color: '#17171c',
    fontFamily: 'Pretendard',
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postcode: {
    flex: 1,
  },
});
