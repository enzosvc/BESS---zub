'use client';

export type ModoDimensionamento = 'manual' | 'otimizar';

/** Seletor compacto Manual / Otimizar (cabe na faixa de contexto do formulário). */
export function SeletorDimensionamento({
  modo, onChangeModo,
}: {
  modo: ModoDimensionamento;
  onChangeModo: (modo: ModoDimensionamento) => void;
}) {
  const opcoes: { valor: ModoDimensionamento; rotulo: string }[] = [
    { valor: 'manual', rotulo: 'Definir manualmente' },
    { valor: 'otimizar', rotulo: 'Otimizar tamanho' },
  ];
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted">Dimensionamento</p>
      <div className="flex gap-0.5 rounded-full border border-line bg-panel p-0.5">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChangeModo(o.valor)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              modo === o.valor ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Só a interface do modo "o modelo decide o tamanho ideal" — o motor de
 * otimização (que precisaria rodar a simulação dezenas/centenas de vezes até
 * maximizar a métrica escolhida) ainda NÃO existe. Por isso, com
 * modo='otimizar', a página bloqueia o botão de salvar.
 */
export function AvisoOtimizar({
  metricaAlvo, onChangeMetricaAlvo,
}: {
  metricaAlvo: 'vpl' | 'tir';
  onChangeMetricaAlvo: (m: 'vpl' | 'tir') => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-warn/40 bg-panel-2 px-3 py-2.5 text-xs text-warn">
      <p className="min-w-[16rem] flex-1">
        Em construção — o motor que testa vários tamanhos e escolhe o melhor ainda não roda. Escolha{' '}
        <strong>Definir manualmente</strong> para simular. A métrica abaixo ainda não é salva no projeto.
      </p>
      <label className="flex items-center gap-2 text-muted">
        Maximizar
        <select
          value={metricaAlvo}
          onChange={(e) => onChangeMetricaAlvo(e.target.value as 'vpl' | 'tir')}
          className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
        >
          <option value="tir">TIR</option>
          <option value="vpl">VPL</option>
        </select>
      </label>
    </div>
  );
}
