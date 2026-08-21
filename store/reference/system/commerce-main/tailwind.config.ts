import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class',
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        container: {
            center: true,
            padding: '1rem',
            screens: {
                sm: '100%',
                md: '100%',
                lg: '1024px',
                xl: '1280px',
            },
        },
        extend: {
            fontFamily: {
                arabic: ['"Tajawal"', 'ui-sans-serif', 'system-ui'],
            },
            direction: {
                rtl: 'rtl',
            },
            colors: {
                primary: {
                    DEFAULT: '#0D9488',
                    dark: '#0F766E',
                    light: '#5EEAD4',
                },
                secondary: {
                    DEFAULT: '#F59E42',
                    dark: '#B45309',
                    light: '#FDE68A',
                },
            },
        },
    },
}

export default config