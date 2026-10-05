'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';
import { ProjetoComparado, estiloSerie, formatarNumero } from '@/lib/comparacao';

interface Props {
  titulo: string;
  unidade: string;
  projetos: ProjetoComparado[];
  /** Série por projeto: valor por ano (o índice do array é o ano, a partir de `anoInicial`). */
  serie: (p: ProjetoComparado) => number[];
  anoInicial: number;
  linhaZero?: boolean;
}

/** Uma linha por projeto, mesma cor do projeto nas tabelas. Projetos com
 * horizonte menor simplesmente terminam antes (sem extrapolar). */
export default function GraficoComparacao({ titulo, unidade, projetos, serie, anoInicial, linhaZero }: Props) {
  const series = projetos.map(serie);
  const nAnos = Math.max(...series.map((s) => s.length));
  const dados = Array.from({ length: nAnos }, (_, i) => {
    const ponto: Record<string, number | null> = { ano: anoInicial + i };
    projetos.forEach((p, pi) => {
      const v = series[pi][i];
      ponto[p.id] = v === undefined || v === null ? null : Math.round(v * 100) / 100;
    });
    return ponto;
  });

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        {titulo} ({unidade})
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis dataKey="ano" label={{ value: 'Ano', position: 'insideBottom', offset: -3, fill: CORES.eixo }} {...EIXO_PROPS} />
          <YAxis {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `${formatarNumero(v)} ${unidade}`} labelFormatter={(a) => `Ano ${a}`} />
          <Legend
            verticalAlign="top"
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            formatter={(nome) => <span style={{ color: CORES.eixo }}>{nome}</span>}
          />
          {linhaZero && <ReferenceLine y={0} stroke={CORES.eixo} />}
          {projetos.map((p, i) => {
            const { cor, tracejado } = estiloSerie(i);
            return (
              <Line
                key={p.id}
                type="linear"
                dataKey={p.id}
                name={p.name}
                legendType="plainline"
                stroke={cor}
                strokeWidth={2}
                strokeDasharray={tracejado ? '6 3' : undefined}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
