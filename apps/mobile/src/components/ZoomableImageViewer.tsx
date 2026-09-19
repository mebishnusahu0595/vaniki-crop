import { memo, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { resolveMediaUrl } from '../utils/media';

interface ZoomableImageViewerProps {
  visible: boolean;
  images: Array<{ url: string; publicId?: string }>;
  initialIndex?: number;
  isHindi?: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.72);

function SingleZoomableImage({
  imageUrl,
  onScaleChange,
}: {
  imageUrl: string;
  onScaleChange?: (scale: number) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset transform when image changes
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    if (onScaleChange) onScaleChange(1);
  }, [imageUrl]);

  const notifyScale = (s: number) => {
    if (onScaleChange) onScaleChange(s);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const nextScale = Math.min(Math.max(savedScale.value * event.scale, 0.9), 4.5);
      scale.value = nextScale;
      runOnJS(notifyScale)(nextScale);
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyScale)(1);
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((event) => {
      if (scale.value > 1.05) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        const maxBoundX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxBoundY = (IMAGE_HEIGHT * (scale.value - 1)) / 2;
        const clampedX = Math.min(Math.max(translateX.value, -maxBoundX), maxBoundX);
        const clampedY = Math.min(Math.max(translateY.value, -maxBoundY), maxBoundY);

        translateX.value = withSpring(clampedX);
        translateY.value = withSpring(clampedY);
        savedTranslateX.value = clampedX;
        savedTranslateY.value = clampedY;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd(() => {
      if (scale.value > 1.3) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyScale)(1);
      } else {
        scale.value = withSpring(2.6);
        savedScale.value = 2.6;
        runOnJS(notifyScale)(2.6);
      }
    });

  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={styles.imageWrapper}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export const ZoomableImageViewer = memo(function ZoomableImageViewer({
  visible,
  images,
  initialIndex = 0,
  isHindi = false,
  onClose,
}: ZoomableImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentScale, setCurrentScale] = useState(1);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setCurrentScale(1);
    }
  }, [visible, initialIndex]);

  if (!visible || !images.length) return null;

  const currentImage = images[currentIndex] || images[0];
  const fullUrl = resolveMediaUrl(currentImage.url, currentImage.publicId);

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      {/* CRITICAL FOR ANDROID: Modal creates a detached window, GestureHandlerRootView is required for gestures */}
      <GestureHandlerRootView style={styles.modalRoot}>
        {/* Top Control Bar */}
        <View style={styles.topBar}>
          <View style={styles.topInfo}>
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
            <Text style={styles.zoomHintText}>
              {isHindi ? 'पिंच या डबल-टैप करें' : 'Pinch or double-tap to zoom'}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={14}
            accessibilityLabel="Close"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Zoomable Image Center Stage */}
        <View style={styles.stage}>
          <SingleZoomableImage
            key={`zoom-${currentIndex}-${fullUrl}`}
            imageUrl={fullUrl}
            onScaleChange={setCurrentScale}
          />
        </View>

        {/* Bottom Thumbnail Strip */}
        <View style={styles.bottomBar}>
          {images.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStrip}
            >
              {images.map((img, idx) => {
                const thumbUrl = resolveMediaUrl(img.url, img.publicId);
                const isSelected = idx === currentIndex;
                return (
                  <Pressable
                    key={`zoom-thumb-${idx}`}
                    onPress={() => {
                      setCurrentIndex(idx);
                      setCurrentScale(1);
                    }}
                    style={[
                      styles.thumbnailBox,
                      isSelected ? styles.thumbnailSelected : styles.thumbnailUnselected,
                    ]}
                  >
                    <Image source={{ uri: thumbUrl }} style={styles.thumbnailImage} contentFit="contain" />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ height: 16 }} />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 40,
  },
  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.88)',
    zIndex: 40,
  },
  thumbnailStrip: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  thumbnailBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
  },
  thumbnailSelected: {
    borderWidth: 2.5,
    borderColor: '#10B981',
    transform: [{ scale: 1.06 }],
  },
  thumbnailUnselected: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    opacity: 0.65,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});
