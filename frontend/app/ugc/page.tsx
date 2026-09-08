'use client';

import { useEffect, useState } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import UGCUpload from '@/components/UGCUpload';
import { listarUGCScenarios, excluirUGCScenario } from '@/lib/api';

interface UGCResumo {
  id: string;
  name: string;
  unidade: string | null;
  fonte: string | null;
  created_at: string;
  resumo: { n_anos: number };
}

export default function UGCPage() {
  const [ugcs, setUgcs] = useState<UGCResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setUgcs(await listarUGCScenarios());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar UGCs.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o UGC "${nome}"? Só é possível se nenhum projeto o estiver usando.`)) return;
    try {
      await excluirUGCScenario(id);
      setUgcs((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir UGC.');
    }
  }

  return (
    <ProtectedLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">UGC — Unidades de Geração e Consumo</h1>
          <p className="text-sm text-muted">
            Curva histórica de geração de uma usina/planta, usada pelo modelo Colocalizado.
          </p>
        </div>
        <button
          onClick={() => setMostrarUpload((v) => !v)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
        >
          {mostrarUpload ? 'Fechar' : '+ Novo UGC'}
        </button>
      </div>

      {mostrarUpload && (
        <div className="mb-6">
          <UGCUpload
            onCriado={() => {
              setMostrarUpload(false);
              carregar();
            }}
          />
        </div>
      )}

      {carregando && <p className="text-sm text-muted">Carregando...</p>}
      {erro && <p className="text-sm text-bad">{erro}</p>}

      {!carregando && ugcs.length === 0 && !mostrarUpload && (
        <div className="rounded-lg border border-dashed border-line bg-panel p-10 text-center text-sm text-muted">
          Nenhum UGC salvo ainda. Clique em <strong>+ Novo UGC</strong> para fazer upload da geração
          histórica de uma usina.
        </div>
      )}

      <div className="grid gap-3">
        {ugcs.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg border border-line bg-panel px-5 py-4 shadow-sm"
          >
            <div>
              <p className="font-medium text-ink">{u.name}</p>
              <p className="text-xs text-muted-2">
                {u.unidade ?? 'unidade não informada'} · {u.resumo.n_anos} ano(s) ·{' '}
                {u.fonte ?? 'fonte não informada'} · criado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button onClick={() => handleExcluir(u.id, u.name)} className="text-sm text-bad hover:underline">
              Excluir
            </button>
          </div>
        ))}
      </div>
    </ProtectedLayout>
  );
}
