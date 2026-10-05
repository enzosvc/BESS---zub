'use client';

import { useMemo, useState } from 'react';
import { Comparacao, estiloSerie, montarPremissas } from '@/lib/comparacao';

/** Premissas (inputs) usadas em cada simulação, lado a lado. Por padrão só as
 * que diferem entre os projetos — são elas que explicam a diferença de resultado. */
export default function TabelaPremissas({ comparacao }: { comparacao: Comparacao }) {
  const [mostrarIguais, setMostrarIguais] = useState(false);
  const grupos = useMemo(() => montarPremissas(comparacao), [comparacao]);

  const gruposVisiveis = grupos
    .map((g) => ({ ...g, linhas: mostrarIguais ? g.linhas : g.linhas.filter((l) => l.difere) }))
    .filter((g) => g.linhas.length > 0);
  const nDiferentes = grupos.reduce((n, g) => n + g.linhas.filter((l) => l.difere).length, 0);

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Premissas</h3>
          <p className="text-xs text-muted">
            Inputs usados em cada simulação. {nDiferentes} premissa(s) diferem entre os projetos.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={mostrarIguais}
            onChange={(e) => setMostrarIguais(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Mostrar também as premissas iguais
        </label>
      </div>

      {gruposVisiveis.length === 0 ? (
        <p className="text-sm text-muted">Todas as premissas são iguais entre os projetos selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-3">Premissa</th>
                {comparacao.projetos.map((p, i) => (
                  <th key={p.id} className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: estiloSerie(i).cor }}
                      />
                      {p.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gruposVisiveis.map((g) => [
                <tr key={`grupo-${g.titulo}`}>
                  <td
                    colSpan={comparacao.projetos.length + 1}
                    className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-2"
                  >
                    {g.titulo}
                  </td>
                </tr>,
                ...g.linhas.map((l) => (
                  <tr key={`${g.titulo}-${l.rotulo}`} className="border-b border-line text-ink">
                    <td className={`py-1.5 pr-3 ${l.difere ? 'font-medium' : 'text-muted'}`}>{l.rotulo}</td>
                    {l.valores.map((v, i) => (
                      <td key={i} className={`py-1.5 pr-3 font-data ${l.difere ? '' : 'text-muted'}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
