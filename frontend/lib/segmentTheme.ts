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
const CORES_SEGMENTO: Record<Segmento, { accent: string; accentDark: string; onAccent: string; texto: string; borda: string }> = {
  utility: {
    accent: '#378ADD',      // azul claro
    accentDark: '#2568AC',
    onAccent: '#042C53',
    texto: '#85B7EB',
    borda: '#185FA5',
  },
  cei: {
    accent: '#E24B4A',      // vermelho
    accentDark: '#B23837',
    onAccent: '#501313',
    texto: '#F09595',
    borda: '#A32D2D',
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
