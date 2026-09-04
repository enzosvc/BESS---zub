'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import InputForm from '@/components/InputForm';
import ResultCards from '@/components/ResultCards';
import CapacidadeChart from '@/components/charts/CapacidadeChart';
import FluxoCaixaChart from '@/components/charts/FluxoCaixaChart';
import PerfilOrdensChart from '@/components/charts/PerfilOrdensChart';
import SensibilidadeChart from '@/components/charts/SensibilidadeChart';
import TabelaTecnicaAnual from '@/components/TabelaTecnicaAnual';
import TabelaSensibilidadeBid from '@/components/TabelaSensibilidadeBid';
import BidTirChart from '@/components/charts/BidTirChart';
import ProjetoArbitragemView from '@/components/ProjetoArbitragemView';
import { ConfigBESS, ConfigFinanceira } from '@/lib/inputSchema';
import { Segmento, estiloTemaSegmento } from '@/lib/segmentTheme';
import {
  obterProjeto,
  atualizarProjeto,
  simularProjeto,
  obterUltimoResultado,
  iniciarSensibilidade,
  obterStatusSensibilidade,
} from '@/lib/api';

type StatusSensibilidade = 'idle' | 'pending' | 'running' | 'completed' | 'failed';

export default function ProjetoPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [nome, setNome] = useState('');
  const [bess, setBess] = useState<ConfigBESS | null>(null);
  const [financeiro, setFinanceiro] = useState<ConfigFinanceira | null>(null);
  const [businessModel, setBusinessModel] = useState<string | null>(null);
  const [projetoBruto, setProjetoBruto] = useState<any>(null);
  const [carregandoProjeto, setCarregandoProjeto] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [statusSensibilidade, setStatusSensibilidade] = useState<StatusSensibilidade>('idle');
  const [progresso, setProgresso] = useState({ feito: 0, total: 105 });
  const [curvasSensibilidade, setCurvasSensibilidade] = useState<any[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    obterProjeto(projectId)
      .then((p) => {
        setNome(p.name);
        setBusinessModel(p.business_model);
        setProjetoBruto(p);
        // bess/financeiro só são usados pelo caminho LRCAP abaixo — para
        // arbitragem, ProjetoArbitragemView lê de `projetoBruto` (tipos diferentes).
        if (p.business_model === 'lrcap') {
          setBess(p.bess_config);
          setFinanceiro(p.financeiro_config);
          // já mostra a última simulação salva, sem precisar clicar em "Rodar" de novo
          obterUltimoResultado(projectId)
            .then((r) => r && setResultado(r))
            .catch(() => {}); // projeto novo, sem simulação ainda — não é erro
        }
      })
      .catch((err) => setErro(err instanceof Error ? err.message : 'Erro ao carregar projeto.'))
      .finally(() => setCarregandoProjeto(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [projectId]);

  async function handleSalvar() {
    if (!bess || !financeiro) return;
    setSalvando(true);
    setErro(null);
    try {
      await atualizarProjeto(projectId, { nome, seed: 2026, bess, financeiro });
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
    setCurvasSensibilidade(null);
    setStatusSensibilidade('idle');
    try {
      await handleSalvar(); // garante que a simulação usa o input mais recente
      const dados = await simularProjeto(projectId);
      setResultado(dados);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao rodar simulação.');
    } finally {
      setSimulando(false);
    }
  }

  const pollJob = useCallback((jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await obterStatusSensibilidade(jobId);
        setStatusSensibilidade(status.status);
        setProgresso({ feito: status.progresso_feito, total: status.progresso_total });
        if (status.status === 'completed') {
          setCurvasSensibilidade(status.resultado);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (status.status === 'failed') {
          setErro(`Falha na análise de sensibilidade: ${status.erro}`);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao consultar status do job.');
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2500);
  }, []);

  async function handleRodarSensibilidade() {
    if (!resultado) return;
    setErro(null);
    setStatusSensibilidade('pending');
    try {
      const bidBaseline = resultado.resultado_financeiro.bid_equilibrio_rs_ano;
      const { job_id } = await iniciarSensibilidade(projectId, bidBaseline);
      pollJob(job_id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao iniciar análise de sensibilidade.');
      setStatusSensibilidade('idle');
    }
  }

  if (carregandoProjeto || !businessModel) {
    return (
      <ProtectedLayout>
        <p className="text-sm text-muted">Carregando projeto...</p>
      </ProtectedLayout>
    );
  }

  if (businessModel !== 'lrcap') {
    return (
      <ProtectedLayout wide>
        <div style={estiloTemaSegmento((projetoBruto.segmento ?? 'utility') as Segmento)}>
          <ProjetoArbitragemView
            projectId={projectId}
            nomeInicial={projetoBruto.name}
            bessInicial={projetoBruto.bess_config}
            financeiroInicial={projetoBruto.financeiro_config}
            priceScenarioIdInicial={projetoBruto.price_scenario_id ?? ''}
          />
        </div>
      </ProtectedLayout>
    );
  }

  if (!bess || !financeiro) {
    return (
      <ProtectedLayout>
        <p className="text-sm text-muted">Carregando projeto...</p>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout wide>
      <div style={estiloTemaSegmento((projetoBruto?.segmento ?? 'utility') as Segmento)}>
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
            disabled={simulando}
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
          <InputForm bess={bess} financeiro={financeiro} onChangeBess={setBess} onChangeFinanceiro={setFinanceiro} />
        </div>
      </details>

      {resultado && (
        <div className="space-y-6">
          <p className="text-right text-xs text-muted-2">
            Modelo: <span className="font-mono">{resultado.versao_modelo}</span>
          </p>
          <ResultCards
            bidEquilibrioRsAno={resultado.resultado_financeiro.bid_equilibrio_rs_ano}
            vplRs={resultado.resultado_financeiro.vpl_no_bid_equilibrio_rs}
            tirPctAa={resultado.resultado_financeiro.tir_pct_aa}
            waccPctAa={resultado.resultado_financeiro.wacc_pct_aa}
            opexFixoCapexRsAno={resultado.resultado_financeiro.opex_fixo_capex_rs_ano}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PerfilOrdensChart series={resultado.perfil_ordens.series} />
            <CapacidadeChart trajetoria={resultado.trajetoria_15_anos} />
            <FluxoCaixaChart fluxoCaixaRs={resultado.fluxo_caixa_rs} />
            <BidTirChart dados={resultado.sensibilidade_bid} waccPctAa={resultado.resultado_financeiro.wacc_pct_aa} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TabelaTecnicaAnual
              trajetoria={resultado.trajetoria_15_anos}
              detalhamentoCustos={resultado.detalhamento_custos}
            />
            <TabelaSensibilidadeBid dados={resultado.sensibilidade_bid} />
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">
                Sensibilidade contínua (Perdas, SOH+RTE, Penalidades, TUST-C, TUST-G)
              </h3>
              {statusSensibilidade === 'idle' && (
                <button
                  onClick={handleRodarSensibilidade}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:opacity-90"
                >
                  Rodar análise (~90s, 105 simulações)
                </button>
              )}
            </div>

            {(statusSensibilidade === 'pending' || statusSensibilidade === 'running') && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${progresso.total ? (100 * progresso.feito) / progresso.total : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  Rodando... {progresso.feito}/{progresso.total} simulações
                </p>
              </div>
            )}

            {statusSensibilidade === 'completed' && curvasSensibilidade && (
              <SensibilidadeChart dados={curvasSensibilidade} />
            )}
          </div>
        </div>
      )}
      </div>
    </ProtectedLayout>
  );
}
