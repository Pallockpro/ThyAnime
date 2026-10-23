module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // every colour is a CSS variable (see app/globals.css) so the whole site can switch theme: Slime (default) / OG
        ink: 'rgb(var(--ink) / <alpha-value>)',
        plum: 'rgb(var(--plum) / <alpha-value>)',
        blossom: {
          300: 'rgb(var(--b300) / <alpha-value>)',
          400: 'rgb(var(--b400) / <alpha-value>)',
          500: 'rgb(var(--b500) / <alpha-value>)',
          600: 'rgb(var(--b600) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        accent2: 'rgb(var(--accent2) / <alpha-value>)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        petal: {
          '0%': { transform: 'translate3d(0,-10vh,0) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '100%': { transform: 'translate3d(var(--drift,60px),110vh,0) rotate(540deg)', opacity: '0' },
        },
        kenburns: { '0%': { transform: 'scale(1.12)' }, '100%': { transform: 'scale(1)' } },
        progress: { '0%': { width: '0%' }, '100%': { width: '100%' } },
        bannerin: { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 7s ease-in-out infinite',
        kenburns: 'kenburns 9s ease-out forwards',
        bannerin: 'bannerin 0.45s ease-out both',
      },
    },
  },
  plugins: [],
}
