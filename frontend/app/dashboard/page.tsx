'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedLayout from '@/components/ProtectedLayout';
import { listarProjetos, excluirProjeto } from '@/lib/api';

interface Projeto {
  id: string;
  name: string;
  updated_at: string;
  business_model: string;
}

const ROTULO_MODELO: Record<string, string> = {
  lrcap: 'LRCAP',
  arbitragem_standalone: 'Arbitragem',
  arbitragem_fv_bess: 'Arbitragem FV+BESS',
};

function BadgeModelo({ modelo }: { modelo: string }) {
  const cor =
    modelo === 'lrcap'
      ? 'bg-slate-100 text-slate-600'
      : modelo === 'arbitragem_fv_bess'
      ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cor}`}>
      {ROTULO_MODELO[modelo] ?? modelo}
    </span>
  );
}

export default function DashboardPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await listarProjetos();
      setProjetos(dados);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar projetos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o projeto "${nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await excluirProjeto(id);
      setProjetos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir projeto.');
    }
  }

  return (
    <ProtectedLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Meus projetos</h1>
        <div className="flex gap-2">
          <Link
            href="/price-scenarios"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cenários de preço
          </Link>
          <Link
            href="/projects/new"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + LRCAP
          </Link>
          <Link
            href="/projects/new-arbitragem"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Arbitragem
          </Link>
        </div>
      </div>

      {carregando && <p className="text-sm text-slate-500">Carregando...</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {!carregando && projetos.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Você ainda não tem projetos. Clique em <strong>+ LRCAP</strong> ou <strong>+ Arbitragem</strong> para
          começar sua primeira modelagem de BESS.
        </div>
      )}

      <div className="grid gap-3">
        {projetos.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-primary">
                  {p.name}
                </Link>
                <BadgeModelo modelo={p.business_model} />
              </div>
              <p className="text-xs text-slate-400">
                Atualizado em {new Date(p.updated_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/projects/${p.id}`} className="text-primary hover:underline">
                Abrir
              </Link>
              <button onClick={() => handleExcluir(p.id, p.name)} className="text-red-500 hover:underline">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </ProtectedLayout>
  );
}
