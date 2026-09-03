'use client';

import Link from 'next/link';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function DashboardPage() {
  return (
    <ProtectedLayout>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold text-ink">Bem-vindo ao BESS-ZUB</h1>
        <p className="mb-10 max-w-md text-sm text-muted">
          Escolha o segmento de negócio pra ver e criar seus projetos.
        </p>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/utility"
            className="group rounded-xl border-2 p-8 text-left transition-colors"
            style={{ borderColor: '#185FA5', backgroundColor: '#0F1A33' }}
          >
            <p className="mb-1 text-lg font-semibold" style={{ color: '#85B7EB' }}>
              Utility
            </p>
            <p className="text-sm text-muted">
              Projetos de armazenamento para leilões e contratos regulados — LRCAP e arbitragem de mercado.
            </p>
          </Link>

          <Link
            href="/cei"
            className="group rounded-xl border-2 p-8 text-left transition-colors"
            style={{ borderColor: '#A32D2D', backgroundColor: '#2A1315' }}
          >
            <p className="mb-1 text-lg font-semibold" style={{ color: '#F09595' }}>
              C&amp;I
            </p>
            <p className="text-sm text-muted">
              Projetos de armazenamento para clientes comerciais e industriais — LRCAP e arbitragem de mercado.
            </p>
          </Link>
        </div>
      </div>
    </ProtectedLayout>
  );
}
