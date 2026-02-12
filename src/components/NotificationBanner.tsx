import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface NotificationBannerProps {
  title?: string;
  body?: string;
  link?: string;
  onPress: () => void;
  onDismiss?: () => void;
}

export function NotificationBanner({ title, body, onPress, onDismiss }: NotificationBannerProps) {
  return (
    <Pressable style={styles.banner} onPress={onPress}>
      <View style={styles.content}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
        {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  content: {},
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: '#666',
  },
});
