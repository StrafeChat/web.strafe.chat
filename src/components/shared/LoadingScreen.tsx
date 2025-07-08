import { Component, createSignal, onMount, onCleanup } from "solid-js";

const LoadingScreen: Component = () => {
  const [dots, setDots] = createSignal("");
  
  let interval: number;

  onMount(() => {
    interval = window.setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  const getLoadingMessage = () => {
    return "Loading Strafe";
  };

  return (
    <div class="fixed inset-0 flex flex-col justify-center items-center transition-opacity duration-500 z-50" style="background-color: var(--background); z-index: 50;">
      <div class="flex flex-col items-center space-y-6">
        <div class="w-16 h-16 border-4 rounded-full animate-spin" style="border-color: var(--primary); border-top-color: transparent;"></div>
        <div class="text-center">
          <p class="text-lg font-medium mb-2" style="color: var(--text-primary);">{getLoadingMessage()}{dots()}</p>
          <p class="text-sm" style="color: var(--text-secondary);">Please wait while we prepare everything for you</p>
        </div>
        <div class="flex space-x-2">
          <div class="w-2 h-2 rounded-full animate-pulse" style="background-color: var(--primary);"></div>
          <div class="w-2 h-2 rounded-full animate-pulse" style="background-color: var(--primary); animation-delay: 0.2s;"></div>
          <div class="w-2 h-2 rounded-full animate-pulse" style="background-color: var(--primary); animation-delay: 0.4s;"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
