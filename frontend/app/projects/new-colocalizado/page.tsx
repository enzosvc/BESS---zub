'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import InputFormColocalizado from '@/components/InputFormColocalizado';
import { ModoDimensionamento } from '@/components/DimensionamentoToggle';
import {
  CONFIG_BESS_ARBITRAGEM_DEFAULT,
  CONFIG_FINANCEIRA_ARBITRAGEM_DEFAULT,
  ConfigBESS,
  ConfigFinanceiraArbitragem,
} from '@/lib/inputSchema';
import { criarProjetoColocalizado } from '@/lib/api';
import { Segmento, ROTULO_SEGMENTO } from '@/lib/segmentTheme';

function NovoProjetoColocalizadoConteudo() {
  const searchParams = useSearchParams();
  const segmento = (searchParams.get('segmento') === 'cei' ? 'cei' : 'utility') as Segmento;

  const [nome, setNome] = useState('Novo projeto colocalizado');
  const [bess, setBess] = useState<ConfigBESS>(CONFIG_BESS_ARBITRAGEM_DEFAULT);
  const [financeiro, setFinanceiro] = useState<ConfigFinanceiraArbitragem>({
    ...CONFIG_FINANCEIRA_ARBITRAGEM_DEFAULT,
    fv_acoplado: true, // sempre true no colocalizado — carga é sempre a geração própria, sem custo
  });
  const [priceScenarioId, setPriceScenarioId] = useState('');
  const [ugcScenarioId, setUgcScenarioId] = useState('');
  const [modoDimensionamento, setModoDimensionamento] = useState<ModoDimensionamento>('manual');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function handleSalvar() {
    if (!priceScenarioId) {
      setErro('Selecione um cenário de preço antes de salvar.');
      return;
    }
    if (!ugcScenarioId) {
      setErro('Selecione um UGC antes de salvar.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const projeto = await criarProjetoColocalizado({
        nome,
        seed: 2026,
        segmento,
        bess,
        financeiro,
        price_scenario_id: priceScenarioId,
        ugc_scenario_id: ugcScenarioId,
      });
      router.push(`/projects/${projeto.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar projeto.');
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = modoDimensionamento === 'manual' && !salvando;

  return (
    <ProtectedLayout segmento={segmento}>
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-2">
        Novo projeto Colocalizado — {ROTULO_SEGMENTO[segmento]}
      </p>
      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-muted">Nome do projeto</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full max-w-md rounded-md border border-line bg-panel-2 text-ink px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <InputFormColocalizado
        bess={bess}
        financeiro={financeiro}
        priceScenarioId={priceScenarioId}
        ugcScenarioId={ugcScenarioId}
        onChangeBess={setBess}
        onChangeFinanceiro={setFinanceiro}
        onChangePriceScenarioId={setPriceScenarioId}
        onChangeUgcScenarioId={setUgcScenarioId}
        modoDimensionamento={modoDimensionamento}
        onChangeModoDimensionamento={setModoDimensionamento}
      />

      {erro && <p className="mt-4 text-sm text-bad">{erro}</p>}
      {modoDimensionamento === 'otimizar' && (
        <p className="mt-4 text-sm text-warn">
          O modo "Otimizar tamanho" ainda não roda — troque para "Definir manualmente" pra salvar e simular.
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSalvar}
          disabled={!podeSalvar}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar e abrir projeto'}
        </button>
      </div>
    </ProtectedLayout>
  );
}

export default function NovoProjetoColocalizadoPage() {
  return (
    <Suspense fallback={null}>
      <NovoProjetoColocalizadoConteudo />
    </Suspense>
  );
}
