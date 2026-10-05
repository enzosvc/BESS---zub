// Tipos, paleta e premissas da comparação de projetos (ver
// backend/app/api/routes_comparacao.py). A comparação só lê a ÚLTIMA simulação
// salva de cada projeto — os inputs exibidos vêm de `resultado.entrada`, ou
// seja, são os que realmente geraram aquele número, não o formulário atual.

import {
  SECOES_BESS,
  SECOES_FINANCEIRO,
  SECOES_FINANCEIRO_ARBITRAGEM,
  CampoMeta,
  CampoMetaArbitragem,
} from '@/lib/inputSchema';
import { rotuloModeloNegocio } from '@/lib/segmentTheme';

export type Familia = 'lrcap' | 'preco';

export const MIN_PROJETOS = 2;
export const MAX_PROJETOS = 10;

export interface Candidato {
  id: string;
  name: string;
  business_model: string;
  updated_at: string;
  familia: Familia;
  ultima_simulacao: { created_at: string; model_version: string | null } | null;
  desatualizado: boolean;
}

export interface ProjetoComparado {
  id: string;
  name: string;
  business_model: string;
  segmento: string;
  updated_at: string;
  simulado_em: string;
  versao_modelo: string | null;
  desatualizado: boolean;
  cenario_preco_nome: string | null;
  ugc_nome: string | null;
  resultado: any;
}

export interface Comparacao {
  familia: Familia;
  projetos: ProjetoComparado[];
}

// Paleta categórica para fundo escuro (validada contra o painel #12183C:
// banda de luminosidade, croma, separação para daltonismo e contraste). Só 8
// cores distinguíveis existem — do 9º projeto em diante, a cor repete a
// partir do início e a linha fica tracejada (cor + traço identificam a série).
const CORES_SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

export function estiloSerie(indice: number): { cor: string; tracejado: boolean } {
  return { cor: CORES_SERIES[indice % CORES_SERIES.length], tracejado: indice >= CORES_SERIES.length };
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function formatarNumero(v: number, casas = 2): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ---------------------------------------------------------------------------
// Premissas (inputs) — mesmos rótulos/unidades do formulário
// ---------------------------------------------------------------------------

export interface LinhaPremissa {
  rotulo: string;
  valores: string[]; // um por projeto, já formatado
  difere: boolean;
}

export interface GrupoPremissas {
  titulo: string;
  linhas: LinhaPremissa[];
}

type Meta = CampoMeta | CampoMetaArbitragem;

/** Campos em fração 0-1 com unidade "%" (ou "%/ano", "% dos dias") são exibidos x100. */
function formatarValorCampo(valor: unknown, meta: Meta): string {
  if (valor === null || valor === undefined) return '—';
  if (Array.isArray(valor)) {
    const ini = Number(valor[0]);
    const fim = Number(valor[valor.length - 1]);
    return `${formatarNumero(ini * 100)}% → ${formatarNumero(fim * 100)}% (${valor.length} valores)`;
  }
  if (typeof valor !== 'number') return String(valor);
  const unidade = meta.unidade ?? '';
  if (unidade.startsWith('%')) return `${formatarNumero(valor * 100)} ${unidade}`;
  if (unidade === 'R$') return formatarReais(valor);
  return unidade ? `${formatarNumero(valor, 4)} ${unidade}` : formatarNumero(valor, 4);
}

function linha(rotulo: string, valores: string[], chavesComparacao: string[]): LinhaPremissa {
  return { rotulo, valores, difere: new Set(chavesComparacao).size > 1 };
}

/** Valor efetivamente usado na simulação: cfg (técnico) primeiro, depois fin. */
function valorEntrada(p: ProjetoComparado, chave: string): unknown {
  const { cfg, fin } = p.resultado.entrada;
  if (chave === 'prazo_anos' && p.resultado.prazo_anos_solicitado != null) {
    // nos modelos por preço, cfg.prazo_anos já vem truncado ao horizonte do cenário
    return p.resultado.prazo_anos_solicitado;
  }
  return chave in cfg ? cfg[chave] : fin[chave];
}

export function montarPremissas(comparacao: Comparacao): GrupoPremissas[] {
  const { familia, projetos } = comparacao;

  // Autônomo/Colocalizado/Arbitragem não usam janelas fixas nem augmentation
  // (o motor ignora esses campos) — não faz sentido compará-los.
  const secoesTecnicas =
    familia === 'lrcap'
      ? SECOES_BESS
      : SECOES_BESS.filter((s) => s.titulo !== 'Janelas de carga e descarga' && s.titulo !== 'Augmentation');
  const secoesFinanceiras: { titulo: string; campos: Meta[] }[] =
    familia === 'lrcap' ? SECOES_FINANCEIRO : SECOES_FINANCEIRO_ARBITRAGEM;

  const gerais: LinhaPremissa[] = [];
  const modelos = projetos.map((p) => p.business_model);
  gerais.push(linha('Modelo de negócio', projetos.map((p) => rotuloModeloNegocio(p.business_model, p.segmento)), modelos));
  if (familia === 'preco') {
    const cenarios = projetos.map((p) => p.cenario_preco_nome ?? '—');
    gerais.push(linha('Cenário de preço', cenarios, cenarios));
    if (projetos.some((p) => p.business_model === 'colocalizado')) {
      const ugcs = projetos.map((p) => p.ugc_nome ?? '—');
      gerais.push(linha('UGC (geração)', ugcs, ugcs));
    }
    const carga = projetos.map((p) => (p.resultado.entrada.fin.fv_acoplado ? 'Sem custo (geração própria)' : 'Comprada no PLD'));
    gerais.push(linha('Energia de carga', carga, carga));
  }
  const potencias = projetos.map((p) => p.resultado.entrada.cfg.potencia_nominal_efetiva_mw as number);
  gerais.push(
    linha(
      'Potência nominal (capacidade × C-rate)',
      potencias.map((v) => `${formatarNumero(v)} MW`),
      potencias.map(String)
    )
  );

  const grupos: GrupoPremissas[] = [{ titulo: 'Geral', linhas: gerais }];
  for (const secao of [...secoesTecnicas, ...secoesFinanceiras]) {
    grupos.push({
      titulo: secao.titulo,
      linhas: secao.campos.map((meta) => {
        const brutos = projetos.map((p) => valorEntrada(p, meta.chave as string));
        return linha(
          meta.unidade ? `${meta.rotulo} (${meta.unidade})` : meta.rotulo,
          brutos.map((v) => formatarValorCampo(v, meta)),
          brutos.map((v) => JSON.stringify(v))
        );
      }),
    });
  }
  return grupos;
}
