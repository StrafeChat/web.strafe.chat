import { Component, createSignal, onCleanup, onMount } from "solid-js";

interface SwipeableViewProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  children: any;
  class?: string;
}

const SwipeableView: Component<SwipeableViewProps> = (props) => {
  let touchStartX = 0;
  let element: HTMLDivElement | undefined;
  const [isDragging, setIsDragging] = createSignal(false);
  const [translateX, setTranslateX] = createSignal(0);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging()) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX;

    const maxSwipe = 100;
    const limitedDiff = Math.max(Math.min(diff, maxSwipe), -maxSwipe);

    setTranslateX(limitedDiff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const swipeThreshold = 50;

    if (translateX() > swipeThreshold && props.onSwipeRight) {
      props.onSwipeRight();
    } else if (translateX() < -swipeThreshold && props.onSwipeLeft) {
      props.onSwipeLeft();
    }

    setTranslateX(0);
  };

  onMount(() => {
    if (element) {
      element.addEventListener("touchstart", handleTouchStart);
      element.addEventListener("touchmove", handleTouchMove);
      element.addEventListener("touchend", handleTouchEnd);
    }
  });

  onCleanup(() => {
    if (element) {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    }
  });

  return (
    <div
      ref={element}
      class={props.class}
      style={{
        transform: `translateX(${translateX()}px)`,
        transition: isDragging() ? "none" : "transform 0.3s ease-out",
      }}
    >
      {props.children}
    </div>
  );
};

export default SwipeableView;
