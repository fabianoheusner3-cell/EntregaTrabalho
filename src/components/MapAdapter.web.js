import { forwardRef, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export const MapView = forwardRef(function WebMapView(
  { children, initialRegion, onPress, style },
  ref,
) {
  useImperativeHandle(ref, () => ({
    animateToRegion() {},
  }));

  function handlePress() {
    onPress?.({
      nativeEvent: {
        coordinate: {
          latitude: initialRegion?.latitude || -23.5505,
          longitude: initialRegion?.longitude || -46.6333,
        },
      },
    });
  }

  return (
    <Pressable onPress={handlePress} style={[styles.map, style]}>
      <View style={styles.gridLineHorizontal} />
      <View style={styles.gridLineVertical} />
      <Text style={styles.mapLabel}>Mapa disponivel no app mobile</Text>
      <View style={styles.markerLayer}>{children}</View>
    </Pressable>
  );
});

export function Marker({
  coordinate,
  onDragEnd,
  onPress,
  pinColor = colors.primary,
  title,
}) {
  function handlePress() {
    onPress?.();
    onDragEnd?.({
      nativeEvent: {
        coordinate,
      },
    });
  }

  return (
    <Pressable
      accessibilityLabel={title || 'Pin do mapa'}
      onPress={handlePress}
      style={[styles.marker, { backgroundColor: pinColor }]}
    >
      <Text style={styles.markerText}>•</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  map: {
    alignItems: 'center',
    backgroundColor: '#E9F4FF',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridLineHorizontal: {
    backgroundColor: 'rgba(36, 117, 190, 0.18)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  gridLineVertical: {
    backgroundColor: 'rgba(36, 117, 190, 0.18)',
    bottom: 0,
    left: '50%',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  mapLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  markerLayer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 18,
  },
  marker: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
});
