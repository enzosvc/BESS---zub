'use client';

import { useEffect, useState } from 'react';
import GradeParametros, { LAYOUT_PRECO } from '@/components/parametros/GradeParametros';
import { ConfigBESS, ConfigFinanceiraArbitragem, SECOES_FINANCEIRO_ARBITRAGEM } from '@/lib/inputSchema';
import { listarPriceScenarios, listarUGCScenarios } from '@/lib/api';
import { AvisoOtimizar, ModoDimensionamento, SeletorDimensionamento } from '@/components/DimensionamentoToggle';

interface CenarioOpcao {
  id: string;
  name: string;
  submercado: string | null;
  resumo: { n_anos: number };
}

interface UGCOpcao {
  id: string;
  name: string;
  unidade: string | null;
  resumo: { n_anos: number };
}

interface Props {
  bess: ConfigBESS;
  financeiro: ConfigFinanceiraArbitragem;
  priceScenarioId: string;
  ugcScenarioId: string;
  onChangeBess: (novo: ConfigBESS) => void;
  onChangeFinanceiro: (novo: ConfigFinanceiraArbitragem) => void;
  onChangePriceScenarioId: (id: string) => void;
  onChangeUgcScenarioId: (id: string) => void;
  modoDimensionamento: ModoDimensionamento;
  onChangeModoDimensionamento: (m: ModoDimensionamento) => void;
}

const CLASSE_SELECT =
  'w-full rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none';

/** Parâmetros de entrada do Colocalizado: carga limitada pela geração real da
 * usina (UGC), sem custo; descarga nas horas mais caras do dia (como o Autônomo). */
export default function InputFormColocalizado({
  bess,
  financeiro,
  priceScenarioId,
  ugcScenarioId,
  onChangeBess,
  onChangeFinanceiro,
  onChangePriceScenarioId,
  onChangeUgcScenarioId,
  modoDimensionamento,
  onChangeModoDimensionamento,
}: Props) {
  const [cenarios, setCenarios] = useState<CenarioOpcao[]>([]);
  const [ugcs, setUgcs] = useState<UGCOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [metricaAlvo, setMetricaAlvo] = useState<'vpl' | 'tir'>('tir');

  useEffect(() => {
    Promise.all([listarPriceScenarios(), listarUGCScenarios()])
      .then(([p, u]) => {
        setCenarios(p);
        setUgcs(u);
      })
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-end gap-3 rounded-lg border border-accent/30 bg-panel-2 px-3 py-2.5"
        title="Carga limitada pela geração real da usina (UGC), hora a hora — sem custo. Descarga vende nas horas mais caras do dia."
      >
        <div className="min-w-[14rem] flex-1">
          <p className="mb-1 text-[11px] font-medium text-muted">Cenário de preço (descarga)</p>
          {carregando ? (
            <p className="py-1.5 text-xs text-muted-2">Carregando...</p>
          ) : cenarios.length === 0 ? (
            <p className="py-1.5 text-xs text-warn">
              Nenhum cenário salvo — vá em <a href="/price-scenarios" className="underline">Cenários de preço</a>.
            </p>
          ) : (
            <select value={priceScenarioId} onChange={(e) => onChangePriceScenarioId(e.target.value)} className={CLASSE_SELECT}>
              <option value="">— selecione —</option>
              {cenarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.submercado ? `(${c.submercado})` : ''} — {c.resumo.n_anos} ano(s)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="min-w-[14rem] flex-1">
          <p className="mb-1 text-[11px] font-medium text-muted">UGC (carga — geração real)</p>
          {carregando ? (
            <p className="py-1.5 text-xs text-muted-2">Carregando...</p>
          ) : ugcs.length === 0 ? (
            <p className="py-1.5 text-xs text-warn">
              Nenhum UGC salvo — vá em <a href="/ugc" className="underline">UGC</a>.
            </p>
          ) : (
            <select value={ugcScenarioId} onChange={(e) => onChangeUgcScenarioId(e.target.value)} className={CLASSE_SELECT}>
              <option value="">— selecione —</option>
              {ugcs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.unidade ? `(${u.unidade})` : ''} — {u.resumo.n_anos} ano(s)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="hidden w-px self-stretch bg-line sm:block" />

        <SeletorDimensionamento modo={modoDimensionamento} onChangeModo={onChangeModoDimensionamento} />
      </div>

      {modoDimensionamento === 'otimizar' && (
        <AvisoOtimizar metricaAlvo={metricaAlvo} onChangeMetricaAlvo={setMetricaAlvo} />
      )}

      <GradeParametros
        layout={LAYOUT_PRECO}
        bess={bess}
        financeiro={financeiro as unknown as Record<string, unknown>}
        secoesFinanceiras={SECOES_FINANCEIRO_ARBITRAGEM}
        onChangeBess={(alteracoes) => onChangeBess({ ...bess, ...alteracoes })}
        onChangeFinanceiro={(chave, valor) => onChangeFinanceiro({ ...financeiro, [chave]: valor })}
      />
    </div>
  );
}
