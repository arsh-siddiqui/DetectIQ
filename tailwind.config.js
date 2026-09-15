/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'accent-blue': 'var(--accent-blue)',
        'accent-cyan': 'var(--accent-cyan)',
        'accent-violet': 'var(--accent-violet)',
        accent: {
          blue: 'var(--accent-blue)',
          cyan: 'var(--accent-cyan)',
          violet: 'var(--accent-violet)',
        },
        success: {
          DEFAULT: 'var(--success)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          light: 'var(--text-secondary)',
          faint: 'var(--text-muted)',
        },
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent-blue)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      backgroundColor: {
        primary: 'var(--accent-blue)',
        'accent-blue': 'var(--accent-blue)',
        'accent-cyan': 'var(--accent-cyan)',
        'accent-violet': 'var(--accent-violet)',
        background: 'var(--bg-background)',
        surface: 'var(--bg-surface, var(--bg-card))',
        card: 'var(--bg-card)',
        elevated: 'var(--bg-elevated)',
        secondary: 'var(--bg-secondary)',
        interactive: 'var(--bg-interactive, var(--bg-secondary))',
        input: 'var(--bg-input)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      borderColor: {
        border: 'var(--border-border)',
        input: 'var(--border-input)',
        primary: 'var(--accent-blue)',
        'accent-blue': 'var(--accent-blue)',
        'accent-cyan': 'var(--accent-cyan)',
        'accent-violet': 'var(--accent-violet)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        soft: 'var(--shadow-card)',
        softer: 'var(--shadow-card)',
        lift: 'var(--shadow-elevated)',
        glow: "0 0 15px rgba(0, 240, 255, 0.5)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Outfit", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        xl: "20px",
        "2xl": "24px",
        "3xl": "28px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
