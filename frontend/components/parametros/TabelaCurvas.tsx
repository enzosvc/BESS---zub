'use client';

import EntradaNumero from '@/components/parametros/EntradaNumero';
import { Cartao } from '@/components/parametros/CartaoParametros';

type ChaveCurva = 'mean_rte_por_ano' | 'soh_referencia_por_ano';

const LINHAS: { chave: ChaveCurva; rotulo: string }[] = [
  { chave: 'mean_rte_por_ano', rotulo: 'RTE médio' },
  { chave: 'soh_referencia_por_ano', rotulo: 'SOH de referência' },
];

interface Props {
  rte: number[];
  soh: number[];
  prazoAnos: number;
  /** Recebe só as curvas alteradas (as duas juntas quando "+ ano"/"completar" mexe nas duas). */
  onChange: (alteracoes: Partial<Record<ChaveCurva, number[]>>) => void;
}

/** RTE e SOH por ano numa tabela: índice 0 = comissionamento, 1..prazo = anos
 * do contrato (o backend exige pelo menos prazo + 1 valores em cada curva). */
export default function TabelaCurvas({ rte, soh, prazoAnos, onChange }: Props) {
  const curvas: Record<ChaveCurva, number[]> = { mean_rte_por_ano: rte, soh_referencia_por_ano: soh };
  const nColunas = Math.max(rte.length, soh.length);
  const faltam = prazoAnos + 1 - Math.min(rte.length, soh.length);

  function alterar(chave: ChaveCurva, indice: number, valor: number) {
    const nova = [...curvas[chave]];
    nova[indice] = valor;
    onChange({ [chave]: nova });
  }

  /** Estende as duas curvas até `tamanho` repetindo o último valor de cada uma. */
  function estender(tamanho: number) {
    const alteracoes: Partial<Record<ChaveCurva, number[]>> = {};
    for (const { chave } of LINHAS) {
      const atual = curvas[chave];
      if (atual.length < tamanho) {
        alteracoes[chave] = [...atual, ...Array(tamanho - atual.length).fill(atual[atual.length - 1] ?? 1)];
      }
    }
    onChange(alteracoes);
  }

  function removerUltimoAno() {
    const alteracoes: Partial<Record<ChaveCurva, number[]>> = {};
    for (const { chave } of LINHAS) {
      if (curvas[chave].length === nColunas) alteracoes[chave] = curvas[chave].slice(0, -1);
    }
    onChange(alteracoes);
  }

  return (
    <Cartao titulo="Curvas por ano (%)" nota="ano 0 = comissionamento · anos além do prazo ficam sem uso" className="col-span-full">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th />
              {Array.from({ length: nColunas }, (_, i) => (
                <th key={i} className={`font-normal ${i > prazoAnos ? 'text-muted-2/50' : 'text-muted-2'}`}>
                  {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map(({ chave, rotulo }) => (
              <tr key={chave}>
                <th className="w-px whitespace-nowrap pr-2 text-left font-normal text-muted">{rotulo}</th>
                {Array.from({ length: nColunas }, (_, i) => (
                  <td key={i} className={`min-w-[4.25rem] ${i > prazoAnos ? 'opacity-50' : ''}`}>
                    {i < curvas[chave].length ? (
                      <EntradaNumero
                        rotulo={`${rotulo} — ano ${i}`}
                        valor={curvas[chave][i]}
                        onChange={(v) => alterar(chave, i, v)}
                        percentual
                        min={0}
                        max={1}
                      />
                    ) : (
                      <div className="h-7 rounded border border-dashed border-bad" title="Valor faltando" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
        {faltam > 0 && (
          <span className="text-bad">
            Faltam valores para o prazo de {prazoAnos} anos.{' '}
            <button type="button" onClick={() => estender(prazoAnos + 1)} className="underline hover:text-accent">
              Completar repetindo o último valor
            </button>
          </span>
        )}
        <button type="button" onClick={() => estender(nColunas + 1)} className="text-muted hover:text-accent">
          + ano
        </button>
        {nColunas > 2 && (
          <button type="button" onClick={removerUltimoAno} className="text-muted hover:text-accent">
            − último ano
          </button>
        )}
      </div>
    </Cartao>
  );
}
