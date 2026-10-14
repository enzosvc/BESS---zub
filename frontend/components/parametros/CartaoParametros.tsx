'use client';

import { ReactNode } from 'react';
import EntradaNumero from '@/components/parametros/EntradaNumero';
import { CampoMeta, CampoMetaArbitragem } from '@/lib/inputSchema';

export type MetaCampo = CampoMeta | CampoMetaArbitragem;

/** Campos com unidade em "%" (%, %/ano, % dos dias) são frações 0-1 armazenadas e exibidas x100. */
export function ehPercentual(meta: MetaCampo): boolean {
  return meta.unidade?.startsWith('%') ?? false;
}

/** Uma linha: rótulo à esquerda, caixa com unidade à direita. */
export function CampoParametro({
  meta, valor, onChange, fixo = false,
}: {
  meta: MetaCampo;
  valor: number;
  onChange: (v: number) => void;
  fixo?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_8.5rem] items-center gap-2 py-[3px]" title={meta.ajuda}>
      <span className="text-xs leading-tight text-muted">{meta.rotulo}</span>
      <EntradaNumero
        rotulo={meta.rotulo}
        valor={valor}
        onChange={onChange}
        percentual={ehPercentual(meta)}
        min={meta.min}
        max={meta.max}
        unidade={meta.unidade}
        fixo={fixo}
      />
    </div>
  );
}

export function Cartao({
  titulo, nota, financeiro = false, children, className = '',
}: {
  titulo: string;
  nota?: string;
  financeiro?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${financeiro ? 'border-t-2 border-t-accent' : ''} ${className}`}>
      <h3 className="flex items-baseline justify-between gap-2 px-3 pb-1.5 pt-2 text-xs font-semibold text-ink">
        {titulo}
        {nota && <span className="text-[11px] font-normal text-muted-2">{nota}</span>}
      </h3>
      <div className="px-3 pb-2.5">{children}</div>
    </section>
  );
}
