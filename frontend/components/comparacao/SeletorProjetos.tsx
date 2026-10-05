'use client';

import Link from 'next/link';
import { Candidato, Familia, MAX_PROJETOS, MIN_PROJETOS, formatarDataHora } from '@/lib/comparacao';
import { Segmento, rotuloModeloNegocio } from '@/lib/segmentTheme';

interface Props {
  segmento: Segmento;
  candidatos: Candidato[];
  selecionados: string[];
  onChangeSelecionados: (ids: string[]) => void;
  onComparar: () => void;
  carregandoComparacao: boolean;
}

const TITULO_FAMILIA: Record<Segmento, Record<Familia, string>> = {
  utility: { preco: 'Autônomo e Colocalizado', lrcap: 'LRCAP' },
  cei: { preco: 'Arbitragem', lrcap: 'LRCAP' },
};

/** Lista de projetos do segmento, agrupada por família. Só dá pra marcar
 * projeto com simulação salva, da mesma família dos já marcados, até o limite. */
export default function SeletorProjetos({
  segmento,
  candidatos,
  selecionados,
  onChangeSelecionados,
  onComparar,
  carregandoComparacao,
}: Props) {
  const familiaSelecionada = candidatos.find((c) => c.id === selecionados[0])?.familia ?? null;
  const podeComparar = selecionados.length >= MIN_PROJETOS && selecionados.length <= MAX_PROJETOS;

  function alternar(id: string) {
    onChangeSelecionados(
      selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id]
    );
  }

  function motivoBloqueio(c: Candidato): string | null {
    if (selecionados.includes(c.id)) return null;
    if (!c.ultima_simulacao) return 'Sem simulação salva — abra o projeto e rode a simulação.';
    if (familiaSelecionada && c.familia !== familiaSelecionada) {
      return 'LRCAP só pode ser comparado com LRCAP.';
    }
    if (selecionados.length >= MAX_PROJETOS) return `Limite de ${MAX_PROJETOS} projetos atingido.`;
    return null;
  }

  const familias: Familia[] = ['preco', 'lrcap'];

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Projetos para comparar</p>
          <p className="text-xs text-muted">
            Selecione de {MIN_PROJETOS} a {MAX_PROJETOS} projetos com simulação salva. A comparação usa a última
            simulação de cada um.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-data text-xs text-muted">
            {selecionados.length} de {MAX_PROJETOS} selecionados
          </span>
          {selecionados.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeSelecionados([])}
              className="text-xs text-muted hover:text-accent"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={onComparar}
            disabled={!podeComparar || carregandoComparacao}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {carregandoComparacao ? 'Carregando...' : 'Comparar'}
          </button>
        </div>
      </div>

      {candidatos.length === 0 && (
        <p className="text-sm text-muted">Nenhum projeto neste segmento ainda.</p>
      )}

      <div className="space-y-4">
        {familias.map((familia) => {
          const doGrupo = candidatos.filter((c) => c.familia === familia);
          if (doGrupo.length === 0) return null;
          return (
            <div key={familia}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-2">
                {TITULO_FAMILIA[segmento][familia]}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {doGrupo.map((c) => {
                  const marcado = selecionados.includes(c.id);
                  const bloqueio = motivoBloqueio(c);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-start gap-3 rounded-md border px-3 py-2 ${
                        marcado ? 'border-accent bg-panel-2' : 'border-line'
                      } ${bloqueio ? 'opacity-60' : 'cursor-pointer hover:bg-panel-2'}`}
                      title={bloqueio ?? undefined}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={bloqueio !== null}
                        onChange={() => alternar(c.id)}
                        className="mt-1 accent-[var(--accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                          <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                            {rotuloModeloNegocio(c.business_model, segmento)}
                          </span>
                        </div>
                        {c.ultima_simulacao ? (
                          <p className="text-xs text-muted-2">
                            Simulado em {formatarDataHora(c.ultima_simulacao.created_at)}
                            {c.desatualizado && (
                              <span className="ml-2 text-warn">⚠ alterado depois da simulação</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-2">
                            Sem simulação salva —{' '}
                            <Link href={`/projects/${c.id}`} className="underline hover:text-accent">
                              abrir projeto
                            </Link>
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
