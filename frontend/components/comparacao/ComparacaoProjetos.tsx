'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import SeletorProjetos from '@/components/comparacao/SeletorProjetos';
import TabelaResultados from '@/components/comparacao/TabelaResultados';
import TabelaPremissas from '@/components/comparacao/TabelaPremissas';
import GraficoComparacao from '@/components/comparacao/GraficoComparacao';
import { listarCandidatosComparacao, obterComparacao } from '@/lib/api';
import { Candidato, Comparacao, ProjetoComparado, MAX_PROJETOS } from '@/lib/comparacao';
import { Segmento, ROTULO_SEGMENTO } from '@/lib/segmentTheme';

function acumulado(valores: number[]): number[] {
  let soma = 0;
  return valores.map((v) => (soma += v));
}

const emMilhoes = (v: number) => v / 1_000_000;

/** Avisos que tornam a comparação enganosa se passarem despercebidos. */
function avisos(comparacao: Comparacao): string[] {
  const lista: string[] = [];
  const { projetos } = comparacao;

  const desatualizados = projetos.filter((p) => p.desatualizado).map((p) => p.name);
  if (desatualizados.length > 0) {
    lista.push(
      `Projeto(s) alterado(s) depois da última simulação: ${desatualizados.join(', ')}. ` +
        'Os resultados mostrados podem não refletir os inputs atuais — rode a simulação de novo para atualizar.'
    );
  }

  if (new Set(projetos.map((p) => p.versao_modelo)).size > 1) {
    lista.push(
      'As simulações foram feitas com versões diferentes do modelo. Parte da diferença pode vir de mudanças no ' +
        'motor, não dos inputs — rode as simulações de novo para comparar na mesma versão.'
    );
  }

  if (comparacao.familia === 'preco' && new Set(projetos.map((p) => p.resultado.horizonte_efetivo_anos)).size > 1) {
    lista.push(
      'Os projetos têm horizontes de análise diferentes (anos de cenário de preço disponíveis). VPL e receita ' +
        'acumulada cobrem períodos diferentes e não são diretamente comparáveis.'
    );
  }
  return lista;
}

export default function ComparacaoProjetos({ segmento }: { segmento: Segmento }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [carregandoComparacao, setCarregandoComparacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarComparacao(ids: string[]) {
    setCarregandoComparacao(true);
    setErro(null);
    try {
      setComparacao(await obterComparacao(ids));
    } catch (err) {
      setComparacao(null);
      setErro(err instanceof Error ? err.message : 'Erro ao carregar a comparação.');
    } finally {
      setCarregandoComparacao(false);
    }
  }

  useEffect(() => {
    // Seleção vinda do link (?ids=...) — permite reabrir/salvar nos favoritos a mesma comparação.
    const idsLink = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX_PROJETOS);
    setSelecionados(idsLink);
    listarCandidatosComparacao(segmento)
      .then(setCandidatos)
      .catch((err) => setErro(err instanceof Error ? err.message : 'Erro ao carregar projetos.'))
      .finally(() => setCarregandoCandidatos(false));
    if (idsLink.length >= 2) carregarComparacao(idsLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmento]);

  function handleComparar() {
    router.replace(`/${segmento}/comparar?ids=${selecionados.join(',')}`, { scroll: false });
    carregarComparacao(selecionados);
  }

  const familiaPreco = comparacao?.familia === 'preco';

  return (
    <ProtectedLayout wide segmento={segmento}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Comparar projetos — {ROTULO_SEGMENTO[segmento]}</h1>
        <Link href={`/${segmento}`} className="text-sm text-muted hover:text-accent">
          ← Meus projetos
        </Link>
      </div>

      {carregandoCandidatos ? (
        <p className="text-sm text-muted">Carregando projetos...</p>
      ) : (
        <SeletorProjetos
          segmento={segmento}
          candidatos={candidatos}
          selecionados={selecionados}
          onChangeSelecionados={setSelecionados}
          onComparar={handleComparar}
          carregandoComparacao={carregandoComparacao}
        />
      )}

      {erro && <p className="mt-4 text-sm text-bad">{erro}</p>}

      {comparacao && (
        <div className="mt-6 space-y-6">
          {avisos(comparacao).map((a) => (
            <div key={a} className="rounded-lg border border-warn/40 bg-panel-2 p-3 text-sm text-warn">
              ⚠ {a}
            </div>
          ))}

          <TabelaResultados comparacao={comparacao} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <GraficoComparacao
              titulo="Fluxo de caixa acumulado"
              unidade="R$ milhões"
              projetos={comparacao.projetos}
              serie={(p: ProjetoComparado) => acumulado(p.resultado.fluxo_caixa_rs).map(emMilhoes)}
              anoInicial={0}
              linhaZero
            />
            {familiaPreco ? (
              <GraficoComparacao
                titulo="Receita líquida de arbitragem por ano"
                unidade="R$ milhões"
                projetos={comparacao.projetos}
                serie={(p) => p.resultado.trajetoria_15_anos.map((l: any) => emMilhoes(l.receita_liquida_arbitragem_rs_ano))}
                anoInicial={1}
                linhaZero
              />
            ) : (
              <GraficoComparacao
                titulo="Custo operacional por ano"
                unidade="R$ milhões"
                projetos={comparacao.projetos}
                serie={(p) => p.resultado.trajetoria_15_anos.map((l: any) => emMilhoes(l.custo_operacional_rs_ano))}
                anoInicial={1}
              />
            )}
            <GraficoComparacao
              titulo="Capacidade líquida no POI"
              unidade="MWh"
              projetos={comparacao.projetos}
              serie={(p) => p.resultado.trajetoria_15_anos.map((l: any) => l.capacidade_liquida_poi_mwh)}
              anoInicial={1}
            />
          </div>

          <TabelaPremissas comparacao={comparacao} />
        </div>
      )}
    </ProtectedLayout>
  );
}
