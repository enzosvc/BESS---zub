'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedLayout from '@/components/ProtectedLayout';
import { listarProjetos } from '@/lib/api';

interface EntradaSegmento {
  segmento: 'utility' | 'cei';
  rotulo: string;
  cor: string;
  descricao: string;
}

const SEGMENTOS: EntradaSegmento[] = [
  {
    segmento: 'utility',
    rotulo: 'Utility',
    cor: '#378ADD',
    descricao: 'Armazenamento conectado à rede — leilões e contratos regulados.',
  },
  {
    segmento: 'cei',
    rotulo: 'C&I',
    cor: '#E24B4A',
    descricao: 'Armazenamento atrás do medidor — clientes comerciais e industriais.',
  },
];

export default function DashboardPage() {
  const [contagens, setContagens] = useState<Record<string, number | null>>({ utility: null, cei: null });

  useEffect(() => {
    SEGMENTOS.forEach((s) => {
      listarProjetos(s.segmento)
        .then((lista) => setContagens((prev) => ({ ...prev, [s.segmento]: lista.length })))
        .catch(() => setContagens((prev) => ({ ...prev, [s.segmento]: 0 })));
    });
  }, []);

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-2xl py-10">
        <h1 className="text-lg font-semibold text-ink">Bem-vindo ao BESS-ZUB</h1>
        <p className="mt-1 text-sm text-muted">Escolha o segmento pra ver e criar seus projetos.</p>

        <div className="mt-8 divide-y divide-line border-y border-line">
          {SEGMENTOS.map((s) => {
            const n = contagens[s.segmento];
            return (
              <Link
                key={s.segmento}
                href={`/${s.segmento}`}
                className="group flex items-start gap-4 py-6 transition-colors hover:bg-panel"
              >
                <span className="mt-2 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.cor }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-serif text-xl font-semibold text-ink">{s.rotulo}</p>
                    <span className="shrink-0 font-mono text-xs text-muted-2">
                      {n === null ? '...' : n === 0 ? 'nenhum projeto' : n === 1 ? '1 projeto' : `${n} projetos`}
                    </span>
                  </div>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{s.descricao}</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted-2">
                      LRCAP
                    </span>
                    <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted-2">
                      Arbitragem
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </ProtectedLayout>
  );
}
