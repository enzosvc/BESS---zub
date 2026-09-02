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
import { listarPriceScenarios } from '@/lib/api';

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
  onChangeBess: (novo: ConfigBESS) => void;
  onChangeFinanceiro: (novo: ConfigFinanceiraArbitragem) => void;
  onChangePriceScenarioId: (id: string) => void;
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
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {meta.rotulo} {meta.unidade && <span className="text-slate-400">({meta.unidade})</span>}
      </label>
      <input
        type="number"
        step={meta.step ?? 'any'}
        min={meta.min}
        max={meta.max}
        value={valor}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      {meta.ajuda && <p className="mt-0.5 text-xs text-slate-400">{meta.ajuda}</p>}
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
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {rotulo} <span className="text-slate-400">(índice 0 = comissionamento; separados por vírgula)</span>
      </label>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={aplicar}
        rows={2}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none"
      />
    </div>
  );
}

export default function InputFormArbitragem({
  bess,
  financeiro,
  priceScenarioId,
  onChangeBess,
  onChangeFinanceiro,
  onChangePriceScenarioId,
}: Props) {
  const [secaoAberta, setSecaoAberta] = useState<string | null>('Dimensionamento e C-rate');
  const [cenarios, setCenarios] = useState<CenarioOpcao[]>([]);
  const [carregandoCenarios, setCarregandoCenarios] = useState(true);

  useEffect(() => {
    listarPriceScenarios()
      .then(setCenarios)
      .finally(() => setCarregandoCenarios(false));
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
      <div key={titulo} className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setSecaoAberta(aberta ? null : titulo)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800"
        >
          {titulo}
          <span className="text-slate-400">{aberta ? '−' : '+'}</span>
        </button>
        {aberta && (
          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="rounded-lg border border-primary/30 bg-blue-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Modelo de negócio</p>
            <p className="text-xs text-slate-500">
              FV+BESS: carga com energia solar própria (custo ≈ R$0). Standalone: compra e vende no PLD.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {financeiro.fv_acoplado ? 'FV + BESS' : 'Standalone'}
            </span>
            <input
              type="checkbox"
              checked={financeiro.fv_acoplado}
              onChange={(e) => onChangeFinanceiro({ ...financeiro, fv_acoplado: e.target.checked })}
              className="h-5 w-9 appearance-none rounded-full bg-slate-300 transition-colors checked:bg-primary relative
                before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full
                before:bg-white before:transition-transform checked:before:translate-x-4"
            />
          </label>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-600">Cenário de preço</label>
        {carregandoCenarios ? (
          <p className="text-xs text-slate-400">Carregando cenários...</p>
        ) : cenarios.length === 0 ? (
          <p className="text-xs text-amber-700">
            Nenhum cenário salvo ainda — vá em <a href="/price-scenarios" className="underline">Cenários de preço</a>{' '}
            para fazer upload de um antes de simular.
          </p>
        ) : (
          <select
            value={priceScenarioId}
            onChange={(e) => onChangePriceScenarioId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
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

      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Parâmetros técnicos (física da bateria)
      </h2>
      {SECOES_BESS_ARBITRAGEM.map((secao) =>
        renderSecao(secao.titulo, secao.campos, bess as unknown as Record<string, unknown>, (c, v) =>
          atualizarCampoBess(c as keyof ConfigBESS, v)
        )
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
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
