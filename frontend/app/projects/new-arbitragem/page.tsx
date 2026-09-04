'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import InputFormArbitragem from '@/components/InputFormArbitragem';
import {
  CONFIG_BESS_ARBITRAGEM_DEFAULT,
  CONFIG_FINANCEIRA_ARBITRAGEM_DEFAULT,
  ConfigBESS,
  ConfigFinanceiraArbitragem,
} from '@/lib/inputSchema';
import { criarProjetoArbitragem } from '@/lib/api';
import { Segmento, ROTULO_SEGMENTO } from '@/lib/segmentTheme';

function NovoProjetoArbitragemConteudo() {
  const searchParams = useSearchParams();
  const segmento = (searchParams.get('segmento') === 'cei' ? 'cei' : 'utility') as Segmento;

  const [nome, setNome] = useState('Novo projeto de arbitragem');
  const [bess, setBess] = useState<ConfigBESS>(CONFIG_BESS_ARBITRAGEM_DEFAULT);
  const [financeiro, setFinanceiro] = useState<ConfigFinanceiraArbitragem>(CONFIG_FINANCEIRA_ARBITRAGEM_DEFAULT);
  const [priceScenarioId, setPriceScenarioId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function handleSalvar() {
    if (!priceScenarioId) {
      setErro('Selecione um cenário de preço antes de salvar.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const projeto = await criarProjetoArbitragem({
        nome,
        seed: 2026,
        segmento,
        bess,
        financeiro,
        price_scenario_id: priceScenarioId,
      });
      router.push(`/projects/${projeto.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar projeto.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ProtectedLayout segmento={segmento}>
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-2">
        Novo projeto de arbitragem — {ROTULO_SEGMENTO[segmento]}
      </p>
      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-muted">Nome do projeto</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full max-w-md rounded-md border border-line bg-panel-2 text-ink px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <InputFormArbitragem
        bess={bess}
        financeiro={financeiro}
        priceScenarioId={priceScenarioId}
        onChangeBess={setBess}
        onChangeFinanceiro={setFinanceiro}
        onChangePriceScenarioId={setPriceScenarioId}
      />

      {erro && <p className="mt-4 text-sm text-bad">{erro}</p>}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar e abrir projeto'}
        </button>
      </div>
    </ProtectedLayout>
  );
}

export default function NovoProjetoArbitragemPage() {
  return (
    <Suspense fallback={null}>
      <NovoProjetoArbitragemConteudo />
    </Suspense>
  );
}
