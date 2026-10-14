'use client';

import { useEffect, useState } from 'react';
import GradeParametros, { LAYOUT_PRECO } from '@/components/parametros/GradeParametros';
import { ConfigBESS, ConfigFinanceiraArbitragem, SECOES_FINANCEIRO_ARBITRAGEM } from '@/lib/inputSchema';
import { listarPriceScenarios } from '@/lib/api';
import { Segmento } from '@/lib/segmentTheme';

interface CenarioOpcao {
  id: string;
  name: string;
  submercado: string | null;
  resumo: { n_anos: number };
}

interface Props {
  bess: ConfigBESS;
  financeiro: ConfigFinanceiraArbitragem;
  priceScenarioId: string;
  segmento: Segmento;
  onChangeBess: (novo: ConfigBESS) => void;
  onChangeFinanceiro: (novo: ConfigFinanceiraArbitragem) => void;
  onChangePriceScenarioId: (id: string) => void;
}

/** Parâmetros de entrada do Autônomo (Utility) e da Arbitragem (C&I). */
export default function InputFormArbitragem({
  bess,
  financeiro,
  priceScenarioId,
  segmento,
  onChangeBess,
  onChangeFinanceiro,
  onChangePriceScenarioId,
}: Props) {
  const [cenarios, setCenarios] = useState<CenarioOpcao[]>([]);
  const [carregandoCenarios, setCarregandoCenarios] = useState(true);

  useEffect(() => {
    listarPriceScenarios()
      .then(setCenarios)
      .finally(() => setCarregandoCenarios(false));
  }, []);

  // Autônomo (Utility) é necessariamente standalone — o FV+BESS (carga "grátis"
  // sem checar geração real) foi substituído pelo modelo Colocalizado, que usa
  // a geração de verdade via UGC. Corrige qualquer estado antigo (ex.: projeto
  // criado antes dessa mudança) assim que o formulário abre.
  useEffect(() => {
    if (segmento === 'utility' && financeiro.fv_acoplado) {
      onChangeFinanceiro({ ...financeiro, fv_acoplado: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmento]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-accent/30 bg-panel-2 px-3 py-2.5">
        <div title={
          segmento === 'utility'
            ? 'Autônomo é sempre Standalone (compra e vende no PLD) — pra carga com geração real de uma usina, use Colocalizado.'
            : 'FV+BESS: carga com energia solar própria (custo ≈ R$0). Standalone: compra e vende no PLD.'
        }>
          <p className="mb-1 text-[11px] font-medium text-muted">Modelo de negócio</p>
          {segmento === 'utility' ? (
            <span className="inline-flex rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
              Autônomo · <b className="ml-1 font-medium text-ink">Standalone</b>
            </span>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs">
              <span className={financeiro.fv_acoplado ? 'text-muted' : 'font-medium text-ink'}>Standalone</span>
              <input
                type="checkbox"
                checked={financeiro.fv_acoplado}
                onChange={(e) => onChangeFinanceiro({ ...financeiro, fv_acoplado: e.target.checked })}
                className="relative h-4 w-8 appearance-none rounded-full bg-line transition-colors checked:bg-accent
                  before:absolute before:left-0.5 before:top-0.5 before:h-3 before:w-3 before:rounded-full
                  before:bg-ink before:transition-transform checked:before:translate-x-4"
              />
              <span className={financeiro.fv_acoplado ? 'font-medium text-ink' : 'text-muted'}>FV + BESS</span>
            </label>
          )}
        </div>

        <div className="hidden w-px self-stretch bg-line sm:block" />

        <div className="min-w-[16rem] flex-1">
          <p className="mb-1 text-[11px] font-medium text-muted">Cenário de preço</p>
          {carregandoCenarios ? (
            <p className="py-1.5 text-xs text-muted-2">Carregando cenários...</p>
          ) : cenarios.length === 0 ? (
            <p className="py-1.5 text-xs text-warn">
              Nenhum cenário salvo ainda — vá em <a href="/price-scenarios" className="underline">Cenários de preço</a>{' '}
              para fazer upload de um antes de simular.
            </p>
          ) : (
            <select
              value={priceScenarioId}
              onChange={(e) => onChangePriceScenarioId(e.target.value)}
              className="w-full rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">— selecione —</option>
              {cenarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.submercado ? `(${c.submercado})` : ''} — {c.resumo.n_anos} ano(s)
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

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
