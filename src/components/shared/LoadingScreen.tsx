import { Component, createSignal, onMount, onCleanup } from "solid-js";

const TURTLE_SRC = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png";

const tips = [
  "Tip: You can use Ctrl+K to quickly switch channels!",
  "Tip: Press Ctrl+Shift+M to mute/unmute yourself instantly.",
  "Tip: Use @ to mention someone and get their attention.",
  "Tip: Drag and drop files to upload them instantly.",
  "Tip: Use the search bar to find messages and users.",
  "Tip: Customize your profile in settings for a unique look.",
  "Tip: Keyboard shortcuts make navigation super fast!",
  "Tip: You can pin important messages for quick access.",
  "Tip: Try dark mode for a more comfortable experience at night.",
  "Tip: Use reactions to quickly respond to messages."
];

const LoadingScreen: Component = () => {
  // Pick a random tip on mount
  const tip = tips[Math.floor(Math.random() * tips.length)];

  return (
    <div class="fixed inset-0 flex flex-col justify-center items-center transition-opacity duration-500 z-50" style="background: #1a1b26; z-index: 50;">
      {/* Turtle background - DO NOT TOUCH! (bryden gonna be angry) */}
      <div class="absolute inset-0 opacity-40 pointer-events-none select-none">
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-16 h-16 animate-swim-1" style={{ top: "40%", right: "30%" }} />
        <img src={TURTLE_SRC} alt="Turtle" class="absolute w-24 h-24 animate-swim-2" style={{ bottom: "30%", right: "40%" }} />
      </div>
      {/* Gradient overlay */}
      <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90 pointer-events-none select-none"></div>
      {/* Main content */}
      <div class="relative flex flex-col items-center justify-center w-full h-full z-10">
        <h1 class="text-6xl md:text-7xl font-extrabold tracking-tight text-center" style="color: #21c35e; text-shadow: 0 4px 32px #21c35e55, 0 2px 0 #fff; letter-spacing: 0.08em; margin-bottom: 2.5rem;">
          STRAFE
        </h1>
        <div class="flex flex-col items-center">
          <div class="w-16 h-16 border-4 rounded-full animate-spin mb-8" style="border-color: #21c35e; border-top-color: transparent;"></div>
        </div>
        {/* Tip at the bottom */}
        <div class="absolute bottom-8 left-0 w-full flex flex-col items-center">
          <div class="bg-background1/80 px-6 py-3 rounded-lg shadow-lg border border-[#21c35e33] max-w-lg mx-auto text-center">
            <span class="text-base md:text-lg text-[#21c35e] font-semibold" style="text-shadow: 0 1px 8px #21c35e55;">{tip}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
