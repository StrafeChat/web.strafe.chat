/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    'hidden',
    'inline-flex', 
    'block',
    'flex',
    'md:hidden',
    'md:inline-flex',
    'md:block',
    'md:flex',
    'sm:hidden',
    'sm:block',
    'lg:hidden',
    'lg:block',
    'xl:hidden',
    'xl:block',
    // Force generation of all responsive classes
    {
      pattern: /^(sm|md|lg|xl|2xl):/,
    },
    // Ensure responsive variants are generated
    {
      pattern: /^(hidden|inline-flex|block|flex)$/,
      variants: ['sm', 'md', 'lg', 'xl', '2xl']
    },
    // Ensure object-cover and rounded classes are preserved
    'object-cover',
    'rounded-full',
    'aspect-ratio',
    // Ensure important classes are preserved
    '!hidden',
    'md:!hidden',
    '!w-[72px]',
    '!h-[72px]',
    '!rounded-full'
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: "var(--primary)",
        background: "var(--background)",
        "background-secondary": "var(--background1)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        surface: "var(--surface)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-accent": "var(--text-accent)",
        "text-inverse": "var(--text-inverse)",
        border: "var(--border)",
        error: "var(--error)",
        success: "var(--success)",
        warning: "var(--warning)",
        ring: "var(--ring)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--kb-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--kb-accordion-content-height)" },
          to: { height: 0 },
        },
        "collapsible-down": {
          from: { height: 0 },
          to: { height: "var(--kb-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--kb-collapsible-content-height)" },
          to: { height: 0 },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "draw-checkmark": {
          "0%": { strokeDashoffset: "24" },
          "60%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" },
        },
        fadein: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeout: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        slidein: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideout: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "swim-1": {
          "0%": { transform: "translate(0, 0) rotate(0deg)" },
          "33%": { transform: "translate(30vw, 10vh) rotate(20deg)" },
          "66%": { transform: "translate(-20vw, -15vh) rotate(-15deg)" },
          "100%": { transform: "translate(0, 0) rotate(0deg)" },
        },
        "swim-2": {
          "0%": { transform: "translate(0, 0) rotate(0deg)" },
          "33%": { transform: "translate(-25vw, -10vh) rotate(-25deg)" },
          "66%": { transform: "translate(15vw, 20vh) rotate(15deg)" },
          "100%": { transform: "translate(0, 0) rotate(0deg)" },
        },
        "swim-3": {
          "0%": { transform: "translate(0, 0) rotate(0deg)" },
          "33%": { transform: "translate(20vw, -15vh) rotate(15deg)" },
          "66%": { transform: "translate(-30vw, 10vh) rotate(-20deg)" },
          "100%": { transform: "translate(0, 0) rotate(0deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "draw-checkmark": "draw-checkmark 0.8s ease-out forwards",
        fadein: "fadein 200ms ease-out forwards",
        fadeout: "fadeout 200ms ease-in forwards",
        slidein: "slidein 200ms ease-out forwards",
        slideout: "slideout 200ms ease-in forwards",
        "swim-1": "swim-1 20s infinite ease-in-out",
        "swim-2": "swim-2 25s infinite ease-in-out",
        "swim-3": "swim-3 22s infinite ease-in-out",
      },
    },
  },
  corePlugins: {
    // Ensure all responsive variants are enabled
  },
  variants: {
    extend: {
      display: ['responsive'],
      visibility: ['responsive']
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities }) {
      addUtilities({
        ".hide-scrollbar": {
          /* Hide scrollbar for Chrome, Safari and Opera */
          "&::-webkit-scrollbar": {
            display: "none",
          },
          /* Hide scrollbar for IE, Edge and Firefox */
          "-ms-overflow-style": "none" /* IE and Edge */,
          "scrollbar-width": "none" /* Firefox */,
        },
      });
    },
  ],
};
