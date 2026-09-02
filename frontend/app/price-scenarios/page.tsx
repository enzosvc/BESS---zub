'use client';

import { useEffect, useState } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import PriceScenarioUpload from '@/components/PriceScenarioUpload';
import { listarPriceScenarios, excluirPriceScenario } from '@/lib/api';

interface CenarioResumo {
  id: string;
  name: string;
  submercado: string | null;
  fonte: string | null;
  created_at: string;
  resumo: { n_anos: number };
}

export default function PriceScenariosPage() {
  const [cenarios, setCenarios] = useState<CenarioResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCenarios(await listarPriceScenarios());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar cenários.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o cenário "${nome}"? Só é possível se nenhum projeto o estiver usando.`)) return;
    try {
      await excluirPriceScenario(id);
      setCenarios((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir cenário.');
    }
  }

  return (
    <ProtectedLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Cenários de preço</h1>
          <p className="text-sm text-muted">
            Usados pelos projetos de arbitragem (standalone e FV+BESS) — PLD histórico ou projeção própria.
          </p>
        </div>
        <button
          onClick={() => setMostrarUpload((v) => !v)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
        >
          {mostrarUpload ? 'Fechar' : '+ Novo cenário'}
        </button>
      </div>

      {mostrarUpload && (
        <div className="mb-6">
          <PriceScenarioUpload
            onCriado={() => {
              setMostrarUpload(false);
              carregar();
            }}
          />
        </div>
      )}

      {carregando && <p className="text-sm text-muted">Carregando...</p>}
      {erro && <p className="text-sm text-bad">{erro}</p>}

      {!carregando && cenarios.length === 0 && !mostrarUpload && (
        <div className="rounded-lg border border-dashed border-line bg-panel p-10 text-center text-sm text-muted">
          Nenhum cenário salvo ainda. Clique em <strong>+ Novo cenário</strong> para fazer upload de um PLD
          histórico ou de uma projeção própria (ex.: EPE/CCEE).
        </div>
      )}

      <div className="grid gap-3">
        {cenarios.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-line bg-panel px-5 py-4 shadow-sm"
          >
            <div>
              <p className="font-medium text-ink">{c.name}</p>
              <p className="text-xs text-muted-2">
                {c.submercado ?? 'submercado não informado'} · {c.resumo.n_anos} ano(s) ·{' '}
                {c.fonte ?? 'fonte não informada'} · criado em {new Date(c.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button onClick={() => handleExcluir(c.id, c.name)} className="text-sm text-bad hover:underline">
              Excluir
            </button>
          </div>
        ))}
      </div>
    </ProtectedLayout>
  );
}
