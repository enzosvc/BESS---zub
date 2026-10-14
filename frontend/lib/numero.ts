// Números digitados no formulário de parâmetros, no formato brasileiro.
// Aceita vírgula ou ponto como decimal ("0,98" e "0.98") e ponto como
// separador de milhar quando não há ambiguidade ("251.200.000", "1.234,5").
// Nunca usar parseFloat direto: "204,37" viraria 204.

/** Converte o texto digitado em número, ou `null` se não for um número válido. */
export function parseNumeroBR(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '');
  if (t === '' || t === '-' || t === ',' || t === '.') return null;

  let normalizado: string;
  if (t.includes(',')) {
    // vírgula presente: ela é o decimal e os pontos são milhar
    normalizado = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    // só pontos em grupos de 3 dígitos, sem zero à esquerda ("251.200.000",
    // "1.234"): milhar. "0.006" continua decimal.
    normalizado = t.replace(/\./g, '');
  } else {
    normalizado = t;
  }

  if (!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(normalizado)) return null;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/** Formata para exibição/edição: vírgula decimal, ponto de milhar, até 6 casas. */
export function formatarNumeroBR(valor: number): string {
  if (!Number.isFinite(valor)) return '';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}
