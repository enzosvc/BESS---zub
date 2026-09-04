import type { CSSProperties } from 'react';

export type Segmento = 'utility' | 'cei';

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  utility: 'Utility',
  cei: 'C&I',
};

// Cores por segmento — sobrescrevem as variáveis CSS --accent/--accent-dark/--on-accent
// (ver globals.css e tailwind.config.js) só dentro do container que as aplica.
// Todo componente que já usa bg-accent/text-accent/border-accent (botões, cards,
// inputs) muda de cor automaticamente, sem precisar editar cada um.
const CORES_SEGMENTO: Record<Segmento, { accent: string; accentDark: string; onAccent: string; texto: string; borda: string; fundo: string }> = {
  utility: {
    accent: '#378ADD',      // azul claro
    accentDark: '#2568AC',
    onAccent: '#042C53',
    texto: '#85B7EB',
    borda: '#185FA5',
    fundo: '#0F1A33',       // mesmo tom já usado no bloco Utility do dashboard
  },
  cei: {
    accent: '#E8822E',      // laranja
    accentDark: '#C36A1E',
    onAccent: '#3A1D02',
    texto: '#F5B27A',
    borda: '#B85F1F',
    fundo: '#2A1D0F',       // mesmo tom já usado no bloco C&I do dashboard
  },
};

/** CSS vars para aplicar num container pai — todo bg-accent/text-accent/border-accent
 * descendente herda a cor do segmento automaticamente. */
export function estiloTemaSegmento(segmento: Segmento): CSSProperties {
  const c = CORES_SEGMENTO[segmento];
  return {
    '--accent': c.accent,
    '--accent-dark': c.accentDark,
    '--on-accent': c.onAccent,
  } as CSSProperties;
}

export function corTextoSegmento(segmento: Segmento): string {
  return CORES_SEGMENTO[segmento].texto;
}

export function corBordaSegmento(segmento: Segmento): string {
  return CORES_SEGMENTO[segmento].borda;
}

export function corFundoSegmento(segmento: Segmento): string {
  return CORES_SEGMENTO[segmento].fundo;
}
