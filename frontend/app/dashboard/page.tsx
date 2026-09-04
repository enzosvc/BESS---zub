'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedLayout from '@/components/ProtectedLayout';
import { listarProjetos } from '@/lib/api';

type IconeProps = { className?: string };

function IconSolar({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="7" width="19" height="11" rx="1" />
      <path d="M2.5 12.5h19M9 7v11M15 7v11" />
    </svg>
  );
}

function IconEolica({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V9" />
      <path d="M12 9 19 4.5" />
      <path d="M12 9 5.5 6" />
      <path d="M12 9 14 17.5" />
      <circle cx="12" cy="9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTorre({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 7 22M12 2l5 20" />
      <path d="M4 8h16M6 13h12M8 18h8" />
      <path d="M12 2v20" />
    </svg>
  );
}

function IconCasa({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function IconComercio({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 5 4h14l1 5" />
      <path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function IconIndustria({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V11l5 3.5V11l5 3.5V9l5 3.5V21z" />
      <path d="M3 21h17" />
      <path d="M7 21v-3M11.5 21v-3M16 21v-3" />
    </svg>
  );
}

function rotuloContagem(n: number | null): string {
  if (n === null) return '...';
  if (n === 0) return 'nenhum projeto ainda';
  return n === 1 ? '1 projeto' : `${n} projetos`;
}

export default function DashboardPage() {
  const [contagens, setContagens] = useState<Record<'utility' | 'cei', number | null>>({ utility: null, cei: null });

  useEffect(() => {
    (['utility', 'cei'] as const).forEach((seg) => {
      listarProjetos(seg)
        .then((lista) => setContagens((prev) => ({ ...prev, [seg]: lista.length })))
        .catch(() => setContagens((prev) => ({ ...prev, [seg]: 0 })));
    });
  }, []);

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-lg font-semibold text-ink">Bem-vindo ao BESS-ZUB</h1>
        <p className="mt-1 text-sm text-muted">Escolha o segmento pra ver e criar seus projetos.</p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Link
            href="/utility"
            className="rounded-lg border p-6 transition-colors hover:bg-panel-2"
            style={{ borderColor: 'rgba(55,138,221,0.4)', backgroundColor: '#0F1A33' }}
          >
            <div className="flex items-center gap-4" style={{ color: '#378ADD' }}>
              <IconSolar className="h-7 w-7" />
              <IconEolica className="h-7 w-7" />
              <IconTorre className="h-7 w-7" />
            </div>
            <p className="mt-4 font-mono text-xl font-semibold text-ink">Utility</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Armazenamento conectado à rede — leilões e contratos regulados.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted-2">LRCAP</span>
                <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted-2">Autônomo / Colocalizado</span>
              </div>
              <span className="font-mono text-[11px] text-muted-2">{rotuloContagem(contagens.utility)}</span>
            </div>
          </Link>

          <Link
            href="/cei"
            className="rounded-lg border p-6 transition-colors hover:bg-panel-2"
            style={{ borderColor: 'rgba(232,130,46,0.4)', backgroundColor: '#2A1D0F' }}
          >
            <div className="flex items-center gap-4" style={{ color: '#E8822E' }}>
              <IconCasa className="h-7 w-7" />
              <IconComercio className="h-7 w-7" />
              <IconIndustria className="h-7 w-7" />
            </div>
            <p className="mt-4 font-mono text-xl font-semibold text-ink">C&amp;I</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Armazenamento atrás do medidor — clientes comerciais e industriais.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted-2">Arbitragem</span>
              </div>
              <span className="font-mono text-[11px] text-muted-2">{rotuloContagem(contagens.cei)}</span>
            </div>
          </Link>
        </div>
      </div>
    </ProtectedLayout>
  );
}
