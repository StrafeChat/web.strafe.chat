import { Component, createSignal, onMount, onCleanup } from "solid-js";

const TURTLE_SRC = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png";

const bottomTexts = [
  "Connecting to STRAFE",
  "Loading your experience",
  "Making things awesome",
  "Almost there"
];

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

  const text = bottomTexts[Math.floor(Math.random() * bottomTexts.length)];

  return (
    <div class="fixed inset-0 flex flex-col justify-center items-center transition-opacity duration-500 z-50" style="background: #1a1b26; z-index: 50;">
      {/* Animated turtles background */}
      <div class="absolute inset-0 opacity-40 pointer-events-none select-none">
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-16 h-16 animate-swim-1" style={{ top: "40%", right: "30%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-24 h-24 animate-swim-2" style={{ bottom: "30%", right: "40%" }} />
      </div>
      {/* Gradient overlay for Discord-like effect */}
      <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90 pointer-events-none select-none"></div>
      {/* Main content */}
      <div class="relative flex flex-col items-center justify-center w-full h-full z-10">
        <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight text-center" style="color: #21c35e; text-shadow: 0 2px 16px #21c35e55, 0 1px 0 #fff; letter-spacing: 0.05em;">STRAFE</h1>
        <div class="mt-8 flex flex-col items-center">
          <div class="w-16 h-16 border-4 rounded-full animate-spin" style="border-color: #21c35e; border-top-color: transparent;"></div>
        </div>
        <div class="absolute bottom-10 left-0 w-full flex flex-col items-center">
          <p class="text-lg font-medium text-text-primary drop-shadow mb-2" style="color: #fff; text-shadow: 0 1px 8px #21c35e55;">{text}{dots()}</p>
          <p class="text-sm text-text-secondary" style={{ color: "#b5ffcb" }}>Please wait while we prepare everything for you</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
