/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#374151',
          850: '#1f2937',
          950: '#0f172a'
        }
      },
      keyframes: {
        breathe: {
          '0%, 100%': { 
            boxShadow: `
              0 0 8px rgba(255, 255, 255, 0.3),
              inset 0 0 8px rgba(255, 255, 255, 0.1),
              0 0 16px rgba(255, 255, 255, 0.2)
            ` 
          },
          '50%': { 
            boxShadow: `
              0 0 20px rgba(255, 255, 255, 0.6),
              inset 0 0 16px rgba(255, 255, 255, 0.25),
              0 0 32px rgba(255, 255, 255, 0.4)
            ` 
          }
        },
        fadeInOut: {
          '0%, 100%': { opacity: '0.05' },
          '50%': { opacity: '0.8' }
        }
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        fadeInOut: 'fadeInOut 4s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}