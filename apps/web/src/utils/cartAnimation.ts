export interface CartFlyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CartFlyAnimationPayload {
  startRect: CartFlyRect;
  imageUrl?: string;
}

const CART_FLY_EVENT = 'vaniki:cart-fly';

export function emitCartFlyAnimation(payload: CartFlyAnimationPayload) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<CartFlyAnimationPayload>(CART_FLY_EVENT, {
      detail: payload,
    }),
  );
}

export function onCartFlyAnimation(callback: (payload: CartFlyAnimationPayload) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<CartFlyAnimationPayload>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(CART_FLY_EVENT, handler);

  return () => {
    window.removeEventListener(CART_FLY_EVENT, handler);
  };
}
