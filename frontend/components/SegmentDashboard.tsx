'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedLayout from '@/components/ProtectedLayout';
import { listarProjetos, excluirProjeto } from '@/lib/api';
import { Segmento, ROTULO_SEGMENTO } from '@/lib/segmentTheme';

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
  const cor = modelo === 'lrcap' ? 'bg-panel-2 text-muted' : 'bg-panel-2 text-accent';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cor}`}>{ROTULO_MODELO[modelo] ?? modelo}</span>;
}

export default function SegmentDashboard({ segmento }: { segmento: Segmento }) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setProjetos(await listarProjetos(segmento));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar projetos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [segmento]);

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o projeto "${nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await excluirProjeto(id);
      setProjetos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir projeto.');
    }
  }

  const rotuloArbitragem = segmento === 'utility' ? '+ Autônomo / Colocalizado' : '+ Arbitragem';

  return (
    <ProtectedLayout segmento={segmento}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Meus projetos — {ROTULO_SEGMENTO[segmento]}</h1>
        <div className="flex gap-2">
          {segmento === 'utility' && (
            <Link
              href={`/projects/new?segmento=${segmento}`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
            >
              + LRCAP
            </Link>
          )}
          <Link
            href={`/projects/new-arbitragem?segmento=${segmento}`}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
          >
            {rotuloArbitragem}
          </Link>
        </div>
      </div>

      {carregando && <p className="text-sm text-muted">Carregando...</p>}
      {erro && <p className="text-sm text-bad">{erro}</p>}

      {!carregando && projetos.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-panel p-10 text-center text-sm text-muted">
          Nenhum projeto de {ROTULO_SEGMENTO[segmento]} ainda. Clique em{' '}
          {segmento === 'utility' && (
            <>
              <strong>+ LRCAP</strong> ou{' '}
            </>
          )}
          <strong>{rotuloArbitragem}</strong> pra começar.
        </div>
      )}

      <div className="grid gap-3">
        {projetos.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-line bg-panel px-5 py-4 shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/projects/${p.id}`} className="font-medium text-ink hover:text-accent">
                  {p.name}
                </Link>
                <BadgeModelo modelo={p.business_model} />
              </div>
              <p className="text-xs text-muted-2">Atualizado em {new Date(p.updated_at).toLocaleString('pt-BR')}</p>
            </div>
            <button onClick={() => handleExcluir(p.id, p.name)} className="text-sm text-bad hover:underline">
              Excluir
            </button>
          </div>
        ))}
      </div>
    </ProtectedLayout>
  );
}
