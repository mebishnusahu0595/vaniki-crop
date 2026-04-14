import { useCallback, useRef } from 'react';
import type { NativeSyntheticEvent, ScrollView, TargetedEvent } from 'react-native';

type ScrollResponder = {
  scrollResponderScrollNativeHandleToKeyboard?: (
    nodeHandle: number,
    additionalOffset?: number,
    preventNegativeScrollOffset?: boolean,
  ) => void;
};

export function useFocusAwareScroll(extraOffset = 96) {
  const scrollRef = useRef<ScrollView>(null);

  const onInputFocus = useCallback(
    (event: NativeSyntheticEvent<TargetedEvent>) => {
      const target = event.target;
      if (typeof target !== 'number') return;

      const responder = scrollRef.current?.getScrollResponder?.() as ScrollResponder | undefined;
      responder?.scrollResponderScrollNativeHandleToKeyboard?.(target, extraOffset, true);
    },
    [extraOffset],
  );

  return {
    scrollRef,
    onInputFocus,
  };
}
