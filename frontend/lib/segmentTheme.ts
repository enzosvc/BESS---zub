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
    accent: '#8E2A4B',      // vinho
    accentDark: '#6B2140',
    onAccent: '#FBE4EC',
    texto: '#D98CAE',
    borda: '#6B2140',
    fundo: '#26121C',       // mesmo tom agora usado no bloco C&I do dashboard
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

/** Rótulo do modelo de negócio como o usuário vê — Autônomo (Utility) e
 * Arbitragem (C&I) usam o mesmo `business_model` no banco. */
export function rotuloModeloNegocio(modelo: string, segmento: string): string {
  if (modelo === 'lrcap') return 'LRCAP';
  if (modelo === 'colocalizado') return 'Colocalizado';
  const rotuloBase = segmento === 'utility' ? 'Autônomo' : 'Arbitragem';
  return modelo === 'arbitragem_fv_bess' ? `${rotuloBase} FV+BESS` : rotuloBase;
}
