import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      },

      // Pastel Gradient Design System - Custom Colors
      // Soft, calming palette for stress-free job hunting experience
      colors: {
        peach: '#FFB5B5',      // Soft peach - primary accent
        mint: '#B5E7DD',       // Soft mint - secondary accent
        lavender: '#D4C5F9',   // Soft lavender - tertiary accent
        sky: '#B5D4F9',        // Soft sky blue - quaternary accent
        butter: '#FFF4B5',     // Soft butter yellow - highlight
      },

      // Pastel Gradient Backgrounds
      // Bold through generous scale, not color intensity
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #FFB5B5 0%, #B5E7DD 100%)',      // Peach → Mint
        'gradient-secondary': 'linear-gradient(135deg, #D4C5F9 0%, #FFB5B5 100%)',    // Lavender → Peach
        'gradient-tertiary': 'linear-gradient(135deg, #B5E7DD 0%, #B5D4F9 100%)',     // Mint → Sky Blue
      },

      // Animation Timing System
      // Smooth, polished transitions for premium feel
      transitionDuration: {
        'fast': '150ms',       // Quick interactions (hover states)
        'base': '250ms',       // Standard transitions
        'slow': '350ms',       // Emphasized transitions
        'slower': '500ms',     // Entrance animations
      },

      // Animation Easing Curves
      // Material Design curves plus playful spring effect
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.4, 0.0, 0.2, 1)',    // Material standard
        'decelerate': 'cubic-bezier(0.0, 0.0, 0.2, 1)',  // Incoming elements
        'accelerate': 'cubic-bezier(0.4, 0.0, 1, 1)',    // Exiting elements
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',   // Bouncy, playful
      },

      // Box Shadow System
      // Soft elevation for depth without harshness
      boxShadow: {
        'glow-active': '0 0 24px rgba(255, 180, 180, 0.5)',     // Active state peach glow
        'glow-hover': '0 0 15px rgba(181, 231, 221, 0.4)',      // Hover state mint glow
      },

      // Focus Ring System
      // Accessibility-first keyboard navigation
      ringColor: {
        'focus': 'rgba(212, 197, 249, 0.3)',  // Lavender focus ring
      },
    }
  },
  plugins: []
};

export default config;
