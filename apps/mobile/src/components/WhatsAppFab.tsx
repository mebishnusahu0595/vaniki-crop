import { memo, useMemo, useRef } from 'react';
import { Animated, Dimensions, Linking, PanResponder, Pressable, Text } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const SUPPORT_WHATSAPP_PHONE = '919302228883';
const FAB_SIZE = 56;
const FAB_MARGIN = 16;
const FAB_TOP_LIMIT = 96;

export const WhatsAppFab = memo(function WhatsAppFab() {
  const { t } = useTranslation();
  const { width, height } = Dimensions.get('window');

  const clampPosition = (x: number, y: number) => {
    const minX = FAB_MARGIN;
    const maxX = width - FAB_SIZE - FAB_MARGIN;
    const minY = FAB_TOP_LIMIT;
    const maxY = height - FAB_SIZE - FAB_MARGIN - 64;

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  };

  const initialPosition = clampPosition(width - FAB_SIZE - FAB_MARGIN, height - FAB_SIZE - 180);
  const position = useRef(new Animated.ValueXY(initialPosition)).current;

  const openWhatsApp = async () => {
    const message = encodeURIComponent(t('mobile.whatsapp.defaultMessage'));
    const url = `https://api.whatsapp.com/send?phone=${SUPPORT_WHATSAPP_PHONE}&text=${message}`;

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          position.setOffset({
            x: (position.x as any).__getValue(),
            y: (position.y as any).__getValue(),
          });
          position.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          position.flattenOffset();
          const clamped = clampPosition(
            (position.x as any).__getValue(),
            (position.y as any).__getValue(),
          );
          Animated.spring(position, {
            toValue: clamped,
            useNativeDriver: false,
            speed: 24,
            bounciness: 0,
          }).start();
        },
      }),
    [position, width, height],
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        transform: [{ translateX: position.x }, { translateY: position.y }],
      }}
    >
      <Pressable
        onPress={() => void openWhatsApp()}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.whatsapp.openChat')}
        className="h-14 w-14 items-center justify-center rounded-full bg-[#25D366]"
        style={{
          shadowColor: '#25D366',
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 10 },
          shadowRadius: 16,
          elevation: 9,
        }}
      >
        <FontAwesome name="whatsapp" size={30} color="#FFFFFF" />
      </Pressable>
      <Text className="mt-1 text-center text-[10px] font-black uppercase tracking-[1.3px] text-primary-500">
        WA
      </Text>
    </Animated.View>
  );
});
