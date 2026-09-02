'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';

export default function FluxoCaixaChart({ fluxoCaixaRs }: { fluxoCaixaRs: number[] }) {
  const dados = fluxoCaixaRs.map((v, ano) => ({
    ano,
    'R$ milhões': Math.round((v / 1_000_000) * 100) / 100,
  }));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        Fluxo de caixa do projeto, no BID de equilíbrio (R$ milhões)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis dataKey="ano" label={{ value: 'Ano', position: 'insideBottom', offset: -3, fill: CORES.eixo }} {...EIXO_PROPS} />
          <YAxis {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke={CORES.eixo} />
          <Bar dataKey="R$ milhões">
            {dados.map((d, i) => (
              <Cell key={i} fill={d['R$ milhões'] < 0 ? CORES.bad : CORES.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
