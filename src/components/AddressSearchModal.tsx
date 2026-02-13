import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>주소 검색</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>닫기</Text>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  close: {
    fontSize: 14,
    color: '#007AFF',
  },
  postcode: {
    flex: 1,
  },
});
