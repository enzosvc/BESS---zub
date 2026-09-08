'use client';

import { useEffect, useState } from 'react';
import InputFormColocalizado from '@/components/InputFormColocalizado';
import { ModoDimensionamento } from '@/components/DimensionamentoToggle';
import ResultCardsArbitragem from '@/components/ResultCardsArbitragem';
import CapacidadeChart from '@/components/charts/CapacidadeChart';
import FluxoCaixaChart from '@/components/charts/FluxoCaixaChart';
import DespachoPrecoChart from '@/components/charts/DespachoPrecoChart';
import ReceitaAnualChart from '@/components/charts/ReceitaAnualChart';
import { ConfigBESS, ConfigFinanceiraArbitragem } from '@/lib/inputSchema';
import { atualizarProjetoColocalizado, simularProjeto, obterUltimoResultado } from '@/lib/api';

interface Props {
  projectId: string;
  nomeInicial: string;
  bessInicial: ConfigBESS;
  financeiroInicial: ConfigFinanceiraArbitragem;
  priceScenarioIdInicial: string;
  ugcScenarioIdInicial: string;
}

export default function ProjetoColocalizadoView({
  projectId,
  nomeInicial,
  bessInicial,
  financeiroInicial,
  priceScenarioIdInicial,
  ugcScenarioIdInicial,
}: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const [bess, setBess] = useState<ConfigBESS>(bessInicial);
  const [financeiro, setFinanceiro] = useState<ConfigFinanceiraArbitragem>(financeiroInicial);
  const [priceScenarioId, setPriceScenarioId] = useState(priceScenarioIdInicial);
  const [ugcScenarioId, setUgcScenarioId] = useState(ugcScenarioIdInicial);
  const [modoDimensionamento, setModoDimensionamento] = useState<ModoDimensionamento>('manual');
  const [salvando, setSalvando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterUltimoResultado(projectId)
      .then((r) => r && setResultado(r))
      .catch(() => {});
  }, [projectId]);

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      await atualizarProjetoColocalizado(projectId, {
        nome,
        seed: 2026,
        bess,
        financeiro,
        price_scenario_id: priceScenarioId,
        ugc_scenario_id: ugcScenarioId,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar projeto.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSimular() {
    setSimulando(true);
    setErro(null);
    setResultado(null);
    try {
      await handleSalvar();
      const dados = await simularProjeto(projectId);
      setResultado(dados);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao rodar simulação.');
    } finally {
      setSimulando(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded-md border border-line bg-panel-2 text-ink px-3 py-2 text-lg font-semibold focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="rounded-md border border-line bg-panel px-4 py-2 text-sm font-medium text-ink hover:bg-panel-2 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={handleSimular}
            disabled={simulando || !priceScenarioId || !ugcScenarioId}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {simulando ? 'Rodando simulação...' : 'Rodar simulação'}
          </button>
        </div>
      </div>

      {erro && <p className="mb-4 text-sm text-bad">{erro}</p>}

      <details className="mb-6 rounded-lg border border-line bg-panel">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
          Parâmetros de entrada (clique para expandir/recolher)
        </summary>
        <div className="border-t border-line p-4">
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
        </div>
      </details>

      {resultado && (
        <div className="space-y-6">
          <p className="text-right text-xs text-muted-2">
            Modelo: <span className="font-mono">{resultado.versao_modelo}</span>
          </p>

          {resultado.horizonte_truncado && (
            <div className="rounded-lg border border-warn/40 bg-panel-2 p-3 text-sm text-warn">
              Análise limitada a <strong>{resultado.horizonte_efetivo_anos} ano(s)</strong> — o cenário de
              preço e/ou o UGC não têm dados para os {resultado.prazo_anos_solicitado} anos do prazo do
              contrato. VPL, TIR e fluxo de caixa refletem só esse período mais curto.
            </div>
          )}

          <ResultCardsArbitragem
            vplRs={resultado.resultado_financeiro.vpl_rs}
            tirPctAa={resultado.resultado_financeiro.tir_pct_aa}
            waccPctAa={resultado.resultado_financeiro.wacc_pct_aa}
            receitaLiquidaMediaRsAno={resultado.resultado_financeiro.receita_liquida_media_rs_ano}
            receitaLiquidaAno1Rs={resultado.resultado_financeiro.receita_liquida_ano1_rs}
            modeloNegocio={resultado.modelo_negocio}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DespachoPrecoChart series={resultado.perfil_ordens.series} />
            <ReceitaAnualChart trajetoria={resultado.trajetoria_15_anos} />
            <CapacidadeChart trajetoria={resultado.trajetoria_15_anos} />
            <FluxoCaixaChart fluxoCaixaRs={resultado.fluxo_caixa_rs} />
          </div>
        </div>
      )}
    </>
  );
}
