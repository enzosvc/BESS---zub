'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';

interface LinhaSensibilidade {
  fator: string;
  item_pct: number;
  bid_pct: number;
}

const CORES_FATOR: Record<string, string> = {
  Perdas: CORES.amber,
  'SOH+RTE': CORES.accent,
  Penalidades: CORES.bad,
  'TUST-C': CORES.accentSoft,
  'TUST-G': CORES.indigo,
};

export default function SensibilidadeChart({ dados }: { dados: LinhaSensibilidade[] }) {
  // Recharts precisa de um array "largo" (uma linha por item_pct, uma coluna por fator)
  const porItemPct = new Map<number, Record<string, number>>();
  for (const linha of dados) {
    const atual = porItemPct.get(linha.item_pct) ?? { item_pct: linha.item_pct };
    atual[linha.fator] = Math.round(linha.bid_pct * 100) / 100;
    porItemPct.set(linha.item_pct, atual);
  }
  const dadosLargos = Array.from(porItemPct.values()).sort((a, b) => a.item_pct - b.item_pct);
  const fatores = Array.from(new Set(dados.map((d) => d.fator)));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        Sensibilidade contínua do BID a cada fator
      </h3>
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={dadosLargos} margin={{ top: 5, right: 20, left: 0, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis
            dataKey="item_pct"
            type="number"
            domain={[0, 100]}
            label={{ value: '% do valor do item (0% = ideal, 100% = atual)', position: 'bottom', offset: 0, fill: CORES.eixo }}
            {...EIXO_PROPS}
          />
          <YAxis label={{ value: '% do BID de equilíbrio', angle: -90, position: 'insideLeft', fill: CORES.eixo }} {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `${v.toFixed(2)}%`} />
          <Legend verticalAlign="top" wrapperStyle={{ color: CORES.eixo, fontSize: 12 }} />
          <ReferenceLine y={100} stroke={CORES.muted} strokeDasharray="3 3" />
          <ReferenceLine x={100} stroke={CORES.muted} strokeDasharray="3 3" />
          {fatores.map((fator) => (
            <Line
              key={fator}
              type="monotone"
              dataKey={fator}
              stroke={CORES_FATOR[fator] ?? CORES.muted}
              strokeWidth={2}
              dot={{ r: 2, fill: CORES_FATOR[fator] ?? CORES.muted }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
