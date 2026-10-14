'use client';

import { Cartao, CampoParametro, MetaCampo } from '@/components/parametros/CartaoParametros';
import TabelaCurvas from '@/components/parametros/TabelaCurvas';
import JanelasCargaDescarga from '@/components/parametros/JanelasCargaDescarga';
import { ConfigBESS, SECOES_BESS } from '@/lib/inputSchema';
import { formatarNumeroBR } from '@/lib/numero';

interface Secao {
  titulo: string;
  campos: MetaCampo[];
}

export interface LayoutParametros {
  /** Três colunas de parâmetros técnicos, cada uma com títulos de seção de SECOES_BESS. */
  colunasTecnicas: [string[], string[], string[]];
  /** Campos técnicos fixados pelo modelo (só leitura). */
  camposFixos: (keyof ConfigBESS)[];
  /** Cartão de janelas fixas de carga/descarga (só LRCAP). */
  janelas: boolean;
}

export const LAYOUT_LRCAP: LayoutParametros = {
  colunasTecnicas: [
    ['Dimensionamento e C-rate', 'Janela operacional de SOC', 'Resolução temporal e prazo'],
    ['Cadeia de perdas (bateria até o POI)', 'Temperatura'],
    ['Disponibilidade', 'Augmentation'],
  ],
  camposFixos: [],
  janelas: true,
};

/** Autônomo, Colocalizado e Arbitragem C&I: despacho por preço, sem janelas
 * fixas nem augmentation; o motor exige passo de 1 h e o ano inteiro (365 dias). */
export const LAYOUT_PRECO: LayoutParametros = {
  colunasTecnicas: [
    ['Dimensionamento e C-rate', 'Janela operacional de SOC', 'Resolução temporal e prazo'],
    ['Cadeia de perdas (bateria até o POI)'],
    ['Temperatura', 'Disponibilidade'],
  ],
  camposFixos: ['delta_t_h', 'dias_simulados_por_ano'],
  janelas: false,
};

const SECOES_TECNICAS = new Map(SECOES_BESS.map((s) => [s.titulo, s]));

interface Props {
  layout: LayoutParametros;
  bess: ConfigBESS;
  financeiro: Record<string, unknown>;
  secoesFinanceiras: Secao[];
  onChangeBess: (alteracoes: Partial<ConfigBESS>) => void;
  onChangeFinanceiro: (chave: string, valor: number) => void;
}

/** Todos os parâmetros visíveis ao mesmo tempo: 3 colunas técnicas + 1
 * financeira, curvas por ano em tabela larga e (LRCAP) as janelas fixas. */
export default function GradeParametros({
  layout, bess, financeiro, secoesFinanceiras, onChangeBess, onChangeFinanceiro,
}: Props) {
  const valoresBess = bess as unknown as Record<string, number>;

  function cartaoTecnico(titulo: string) {
    const secao = SECOES_TECNICAS.get(titulo);
    if (!secao) return null;
    return (
      <Cartao key={titulo} titulo={titulo}>
        {secao.campos.map((meta) => (
          <CampoParametro
            key={meta.chave as string}
            meta={meta}
            valor={valoresBess[meta.chave as string]}
            onChange={(v) => onChangeBess({ [meta.chave]: v })}
            fixo={layout.camposFixos.includes(meta.chave as keyof ConfigBESS)}
          />
        ))}
        {titulo === 'Dimensionamento e C-rate' && (
          <p className="mt-1.5 rounded bg-panel-2 px-2 py-1.5 text-[11.5px] text-muted">
            Potência {formatarNumeroBR(Math.round(bess.capacidade_nominal_mwh * bess.c_rate * 100) / 100)} MW · duração{' '}
            {formatarNumeroBR(Math.round((100 / bess.c_rate)) / 100)} h
          </p>
        )}
      </Cartao>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      <p className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-2 xl:col-span-3 xl:block">
        Parâmetros técnicos
      </p>
      <p className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-2 xl:block">
        Parâmetros financeiros
      </p>

      {layout.colunasTecnicas.map((titulos, i) => (
        <div key={i} className="flex flex-col gap-3">
          {titulos.map(cartaoTecnico)}
        </div>
      ))}

      <div className="flex flex-col gap-3">
        {secoesFinanceiras.map((secao) => (
          <Cartao key={secao.titulo} titulo={secao.titulo} financeiro>
            {secao.campos.map((meta) => (
              <CampoParametro
                key={meta.chave as string}
                meta={meta}
                valor={financeiro[meta.chave as string] as number}
                onChange={(v) => onChangeFinanceiro(meta.chave as string, v)}
              />
            ))}
          </Cartao>
        ))}
      </div>

      <TabelaCurvas
        rte={bess.mean_rte_por_ano}
        soh={bess.soh_referencia_por_ano}
        prazoAnos={bess.prazo_anos}
        onChange={onChangeBess}
      />

      {layout.janelas && <JanelasCargaDescarga bess={bess} onChange={(chave, v) => onChangeBess({ [chave]: v })} />}
    </div>
  );
}
