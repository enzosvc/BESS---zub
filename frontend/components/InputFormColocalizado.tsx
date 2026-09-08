'use client';

import { useEffect, useState } from 'react';
import {
  ConfigBESS,
  ConfigFinanceiraArbitragem,
  SECOES_BESS_ARBITRAGEM,
  SECOES_FINANCEIRO_ARBITRAGEM,
  CampoMeta,
  CampoMetaArbitragem,
} from '@/lib/inputSchema';
import { listarPriceScenarios, listarUGCScenarios } from '@/lib/api';
import DimensionamentoToggle, { ModoDimensionamento } from '@/components/DimensionamentoToggle';

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

function CampoNumerico({
  meta,
  valor,
  onChange,
}: {
  meta: CampoMeta | CampoMetaArbitragem;
  valor: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">
        {meta.rotulo} {meta.unidade && <span className="text-muted-2">({meta.unidade})</span>}
      </label>
      <input
        type="number"
        step={meta.step ?? 'any'}
        min={meta.min}
        max={meta.max}
        value={valor}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
      {meta.ajuda && <p className="mt-0.5 text-xs text-muted-2">{meta.ajuda}</p>}
    </div>
  );
}

function CampoArray({
  rotulo,
  valores,
  onChange,
}: {
  rotulo: string;
  valores: number[];
  onChange: (v: number[]) => void;
}) {
  const [texto, setTexto] = useState(valores.join(', '));

  function aplicar() {
    const partes = texto.split(',').map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n));
    if (partes.length >= 2) onChange(partes);
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <label className="mb-1 block text-xs font-medium text-muted">
        {rotulo} <span className="text-muted-2">(índice 0 = comissionamento; separados por vírgula)</span>
      </label>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={aplicar}
        rows={2}
        className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
      />
    </div>
  );
}

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
  const [secaoAberta, setSecaoAberta] = useState<string | null>('Dimensionamento e C-rate');
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

  function atualizarCampoBess(chave: keyof ConfigBESS, valor: number | number[]) {
    onChangeBess({ ...bess, [chave]: valor });
  }

  function atualizarCampoFin(chave: keyof ConfigFinanceiraArbitragem, valor: number) {
    onChangeFinanceiro({ ...financeiro, [chave]: valor });
  }

  function renderSecao<T extends CampoMeta | CampoMetaArbitragem>(
    titulo: string,
    campos: T[],
    valores: Record<string, unknown>,
    onChange: (c: string, v: any) => void
  ) {
    const aberta = secaoAberta === titulo;
    return (
      <div key={titulo} className="rounded-lg border border-line bg-panel">
        <button
          type="button"
          onClick={() => setSecaoAberta(aberta ? null : titulo)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink"
        >
          {titulo}
          <span className="text-muted-2">{aberta ? '−' : '+'}</span>
        </button>
        {aberta && (
          <div className="grid grid-cols-1 gap-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
            {campos.map((meta) => {
              const valorAtual = valores[meta.chave as string];
              if (Array.isArray(valorAtual)) {
                return (
                  <CampoArray
                    key={meta.chave as string}
                    rotulo={meta.rotulo}
                    valores={valorAtual}
                    onChange={(v) => onChange(meta.chave as string, v)}
                  />
                );
              }
              return (
                <CampoNumerico
                  key={meta.chave as string}
                  meta={meta}
                  valor={valorAtual as number}
                  onChange={(v) => onChange(meta.chave as string, v)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-accent/30 bg-panel-2 p-4">
        <p className="mb-3 text-sm font-medium text-ink">Colocalizado</p>
        <p className="mb-3 text-xs text-muted">
          Carga limitada pela geração real da usina (UGC), hora a hora — sem custo. Descarga vende
          nas horas mais caras do dia (mesma lógica do Autônomo).
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cenário de preço (descarga)</label>
            {carregando ? (
              <p className="text-xs text-muted-2">Carregando...</p>
            ) : cenarios.length === 0 ? (
              <p className="text-xs text-warn">
                Nenhum cenário salvo — vá em <a href="/price-scenarios" className="underline">Cenários de preço</a>.
              </p>
            ) : (
              <select
                value={priceScenarioId}
                onChange={(e) => onChangePriceScenarioId(e.target.value)}
                className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
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

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">UGC (carga — geração real)</label>
            {carregando ? (
              <p className="text-xs text-muted-2">Carregando...</p>
            ) : ugcs.length === 0 ? (
              <p className="text-xs text-warn">
                Nenhum UGC salvo — vá em <a href="/ugc" className="underline">UGC</a>.
              </p>
            ) : (
              <select
                value={ugcScenarioId}
                onChange={(e) => onChangeUgcScenarioId(e.target.value)}
                className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">— selecione —</option>
                {ugcs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.unidade ? `(${u.unidade})` : ''} — {u.resumo.n_anos} ano(s)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <DimensionamentoToggle
        modo={modoDimensionamento}
        onChangeModo={onChangeModoDimensionamento}
        metricaAlvo={metricaAlvo}
        onChangeMetricaAlvo={setMetricaAlvo}
      />

      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-2">
        Parâmetros técnicos (física da bateria)
      </h2>
      {SECOES_BESS_ARBITRAGEM.map((secao) =>
        renderSecao(secao.titulo, secao.campos, bess as unknown as Record<string, unknown>, (c, v) =>
          atualizarCampoBess(c as keyof ConfigBESS, v)
        )
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-2">
        Parâmetros financeiros
      </h2>
      {SECOES_FINANCEIRO_ARBITRAGEM.map((secao) =>
        renderSecao(secao.titulo, secao.campos, financeiro as unknown as Record<string, unknown>, (c, v) =>
          atualizarCampoFin(c as keyof ConfigFinanceiraArbitragem, v)
        )
      )}
    </div>
  );
}
