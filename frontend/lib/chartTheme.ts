// Paleta compartilhada dos gráficos (recharts) — aproximação das cores do
// favicon ZUB (navy + verde), no mesmo espírito do relatório de PLD/arbitragem.
// Recharts não lê variáveis CSS/Tailwind diretamente nos componentes SVG,
// por isso os valores ficam duplicados aqui em hexadecimal.

export const CORES = {
  grid: '#232B5C',
  eixo: '#9BA4C7',
  accent: '#47D73D',
  accentSoft: '#7EE685',
  amber: '#E8A33D',
  bad: '#E2665A',
  good: '#47D73D',
  muted: '#6A73A0',
  indigo: '#7E93D6', // usado só quando uma 2ª cor "fria" é necessária, ao lado do verde
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1B2350',
    border: '1px solid #2B3568',
    borderRadius: 6,
    fontSize: 12,
    color: '#E8ECF7',
  },
  labelStyle: { color: '#9BA4C7' },
  itemStyle: { color: '#E8ECF7' },
} as const;

export const EIXO_PROPS = {
  tick: { fill: CORES.eixo, fontSize: 12 },
  stroke: CORES.grid,
} as const;
