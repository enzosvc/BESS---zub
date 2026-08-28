'use client';

import { useState } from 'react';
import {
  ConfigBESS,
  ConfigFinanceira,
  SECOES_BESS,
  SECOES_FINANCEIRO,
  CampoMeta,
} from '@/lib/inputSchema';

interface Props {
  bess: ConfigBESS;
  financeiro: ConfigFinanceira;
  onChangeBess: (novo: ConfigBESS) => void;
  onChangeFinanceiro: (novo: ConfigFinanceira) => void;
}

function CampoNumerico({
  meta,
  valor,
  onChange,
}: {
  meta: CampoMeta;
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

export default function InputForm({ bess, financeiro, onChangeBess, onChangeFinanceiro }: Props) {
  const [secaoAberta, setSecaoAberta] = useState<string | null>('Dimensionamento e C-rate');

  function atualizarCampoBess(chave: keyof ConfigBESS, valor: number | number[]) {
    onChangeBess({ ...bess, [chave]: valor });
  }

  function atualizarCampoFin(chave: keyof ConfigFinanceira, valor: number) {
    onChangeFinanceiro({ ...financeiro, [chave]: valor });
  }

  function renderSecao(titulo: string, campos: CampoMeta[], valores: Record<string, unknown>, onChange: (c: string, v: any) => void) {
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
      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Parâmetros técnicos
      </h2>
      {SECOES_BESS.map((secao) =>
        renderSecao(secao.titulo, secao.campos, bess as unknown as Record<string, unknown>, (c, v) =>
          atualizarCampoBess(c as keyof ConfigBESS, v)
        )
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Parâmetros financeiros
      </h2>
      {SECOES_FINANCEIRO.map((secao) =>
        renderSecao(secao.titulo, secao.campos, financeiro as unknown as Record<string, unknown>, (c, v) =>
          atualizarCampoFin(c as keyof ConfigFinanceira, v)
        )
      )}
    </div>
  );
}
