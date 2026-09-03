/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // paleta ZUB — aproximada do favicon (bateria verde sobre navy)
        bg: '#0A0E22',        // fundo da página — navy mais escuro que o favicon, dá profundidade
        panel: '#12183C',     // navy exato do favicon — cards, header, painéis
        'panel-2': '#1B2350', // navy um degrau mais claro — hover, painéis aninhados, inputs
        line: '#2B3568',      // bordas
        ink: '#E8ECF7',       // texto principal (sobre fundo escuro)
        muted: '#9BA4C7',     // texto secundário
        'muted-2': '#6A73A0', // texto terciário / placeholder
        primary: '#12183C',   // navy da marca ZUB (mantido — usado em superfícies)
        accent: 'var(--accent)',           // ZUB verde por padrão; Utility/C&I sobrescrevem via CSS var
        'accent-dark': 'var(--accent-dark)',
        'on-accent': 'var(--on-accent)',   // texto sobre botão da cor de destaque
        warn: '#E8A33D',
        bad: '#E2665A',
        good: '#47D73D',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        serif: ['var(--font-serif)', 'serif'],
      },
    },
  },
  plugins: [],
};
