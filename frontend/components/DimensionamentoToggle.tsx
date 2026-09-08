'use client';

export type ModoDimensionamento = 'manual' | 'otimizar';

interface Props {
  modo: ModoDimensionamento;
  onChangeModo: (modo: ModoDimensionamento) => void;
  metricaAlvo: 'vpl' | 'tir';
  onChangeMetricaAlvo: (m: 'vpl' | 'tir') => void;
}

/**
 * Só a interface do modo "o modelo decide o tamanho ideal" — o motor de
 * otimização (que precisaria rodar a simulação de 15 anos dezenas/centenas
 * de vezes, testando combinações de potência/capacidade até maximizar a
 * métrica escolhida) ainda NÃO existe. Por isso, com modo='otimizar', o
 * formulário mostra os campos de configuração da busca mas BLOQUEIA o botão
 * de salvar — nada é enviado pro backend nesse modo ainda.
 */
export default function DimensionamentoToggle({ modo, onChangeModo, metricaAlvo, onChangeMetricaAlvo }: Props) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Dimensionamento do BESS</p>
          <p className="text-xs text-muted">Definir potência/capacidade você mesmo, ou pedir pro modelo calcular o tamanho ideal.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-panel-2 p-1">
          <button
            type="button"
            onClick={() => onChangeModo('manual')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              modo === 'manual' ? 'bg-accent text-on-accent' : 'text-muted'
            }`}
          >
            Definir manualmente
          </button>
          <button
            type="button"
            onClick={() => onChangeModo('otimizar')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              modo === 'otimizar' ? 'bg-accent text-on-accent' : 'text-muted'
            }`}
          >
            Otimizar tamanho
          </button>
        </div>
      </div>

      {modo === 'otimizar' && (
        <div className="space-y-3 border-t border-line pt-3">
          <div className="rounded-md border border-warn/40 bg-panel-2 p-3 text-xs text-warn">
            Em construção — o motor que testa várias combinações de potência/capacidade e escolhe a
            melhor ainda não roda. Por enquanto, escolha <strong>Definir manualmente</strong> pra
            simular. Os campos abaixo já ficam salvos como preferência, prontos pra quando o motor
            existir.
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Maximizar</label>
            <select
              value={metricaAlvo}
              onChange={(e) => onChangeMetricaAlvo(e.target.value as 'vpl' | 'tir')}
              className="w-full max-w-xs rounded-md border border-line bg-panel-2 px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="tir">TIR</option>
              <option value="vpl">VPL</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
