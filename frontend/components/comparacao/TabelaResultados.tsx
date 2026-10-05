'use client';

import {
  Comparacao,
  ProjetoComparado,
  estiloSerie,
  formatarDataHora,
  formatarReais,
} from '@/lib/comparacao';
import { rotuloModeloNegocio } from '@/lib/segmentTheme';

interface Coluna {
  titulo: string;
  valor: (p: ProjetoComparado) => number | null;
  formatar: (v: number) => string;
  /** 'max' / 'min' destaca o melhor valor da coluna (só nas métricas de decisão). */
  melhor?: 'max' | 'min';
}

function formatarPct(v: number): string {
  return `${v.toFixed(2)}% a.a.`;
}

const COLUNAS_PRECO: Coluna[] = [
  { titulo: 'VPL', valor: (p) => p.resultado.resultado_financeiro.vpl_rs, formatar: formatarReais, melhor: 'max' },
  { titulo: 'TIR', valor: (p) => p.resultado.resultado_financeiro.tir_pct_aa, formatar: formatarPct, melhor: 'max' },
  { titulo: 'WACC', valor: (p) => p.resultado.resultado_financeiro.wacc_pct_aa, formatar: formatarPct },
  {
    titulo: 'Receita líquida média/ano',
    valor: (p) => p.resultado.resultado_financeiro.receita_liquida_media_rs_ano,
    formatar: formatarReais,
  },
  {
    titulo: 'Receita líquida — ano 1',
    valor: (p) => p.resultado.resultado_financeiro.receita_liquida_ano1_rs,
    formatar: formatarReais,
  },
  { titulo: 'OPEX fixo/ano', valor: (p) => p.resultado.resultado_financeiro.opex_fixo_capex_rs_ano, formatar: formatarReais },
];

const COLUNAS_LRCAP: Coluna[] = [
  {
    titulo: 'BID de equilíbrio/ano',
    valor: (p) => p.resultado.resultado_financeiro.bid_equilibrio_rs_ano,
    formatar: formatarReais,
    melhor: 'min',
  },
  { titulo: 'TIR', valor: (p) => p.resultado.resultado_financeiro.tir_pct_aa, formatar: formatarPct },
  { titulo: 'WACC', valor: (p) => p.resultado.resultado_financeiro.wacc_pct_aa, formatar: formatarPct },
  { titulo: 'OPEX fixo/ano', valor: (p) => p.resultado.resultado_financeiro.opex_fixo_capex_rs_ano, formatar: formatarReais },
  {
    titulo: 'Augmentations',
    valor: (p) => p.resultado.trajetoria_15_anos.filter((l: any) => l.evento_augmentation).length,
    formatar: (v) => String(v),
  },
  {
    titulo: 'Custo de augmentation (soma nominal)',
    valor: (p) => p.resultado.trajetoria_15_anos.reduce((s: number, l: any) => s + l.custo_augmentation_rs, 0),
    formatar: formatarReais,
  },
];

function indiceMelhor(coluna: Coluna, projetos: ProjetoComparado[]): number | null {
  if (!coluna.melhor) return null;
  let melhor: number | null = null;
  projetos.forEach((p, i) => {
    const v = coluna.valor(p);
    if (v === null) return;
    const atual = melhor === null ? null : coluna.valor(projetos[melhor]);
    if (atual === null || (coluna.melhor === 'max' ? v > atual : v < atual)) melhor = i;
  });
  return melhor;
}

export default function TabelaResultados({ comparacao }: { comparacao: Comparacao }) {
  const { familia, projetos } = comparacao;
  const colunas = familia === 'lrcap' ? COLUNAS_LRCAP : COLUNAS_PRECO;
  const melhores = colunas.map((c) => indiceMelhor(c, projetos));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-1 text-sm font-semibold text-ink">Resultados</h3>
      <p className="mb-3 text-xs text-muted">
        {familia === 'lrcap'
          ? 'No LRCAP o BID é calculado para zerar o VPL — compare pelo BID de equilíbrio (menor = lance mais competitivo).'
          : 'Valores da última simulação salva de cada projeto. Destaque = melhor VPL e melhor TIR.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-3">Projeto</th>
              <th className="py-2 pr-3">Modelo</th>
              {familia === 'preco' && <th className="py-2 pr-3">Horizonte</th>}
              {colunas.map((c) => (
                <th key={c.titulo} className="py-2 pr-3 text-right">
                  {c.titulo}
                </th>
              ))}
              <th className="py-2 pr-3">Simulado em</th>
              <th className="py-2 pr-3">Versão</th>
            </tr>
          </thead>
          <tbody>
            {projetos.map((p, i) => {
              const { cor } = estiloSerie(i);
              const r = p.resultado;
              return (
                <tr key={p.id} className="border-b border-line text-ink">
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
                      <a href={`/projects/${p.id}`} className="font-medium hover:text-accent">
                        {p.name}
                      </a>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{rotuloModeloNegocio(p.business_model, p.segmento)}</td>
                  {familia === 'preco' && (
                    <td className="py-1.5 pr-3 font-data">
                      {r.horizonte_efetivo_anos} de {r.prazo_anos_solicitado} anos
                    </td>
                  )}
                  {colunas.map((c, ci) => {
                    const v = c.valor(p);
                    const destaque = melhores[ci] === i;
                    return (
                      <td
                        key={c.titulo}
                        className={`py-1.5 pr-3 text-right font-data ${destaque ? 'font-semibold text-accent' : ''}`}
                      >
                        {v === null ? 'não converge' : c.formatar(v)}
                      </td>
                    );
                  })}
                  <td className="py-1.5 pr-3 text-muted">
                    {formatarDataHora(p.simulado_em)}
                    {p.desatualizado && <span className="ml-1 text-warn" title="Projeto alterado depois da simulação">⚠</span>}
                  </td>
                  <td className="py-1.5 pr-3 font-data text-muted">{p.versao_modelo ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
