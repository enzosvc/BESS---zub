'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';

interface LinhaSensibilidadeBid {
  bid_testado_rs_ano: number;
  bid_sobre_equilibrio: number;
  vpl_rs: number;
  tir_pct_aa: number | null;
}

export default function BidTirChart({
  dados,
  waccPctAa,
}: {
  dados: LinhaSensibilidadeBid[];
  waccPctAa: number;
}) {
  const dadosGrafico = dados.map((r) => ({
    'BID (R$ milhões/ano)': Math.round((r.bid_testado_rs_ano / 1_000_000) * 100) / 100,
    // null vira um buraco na linha (não converge nesse ponto testado), em vez de plotar 0%
    'TIR (% a.a.)': r.tir_pct_aa === null ? null : Math.round(r.tir_pct_aa * 100) / 100,
  }));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">BID testado × TIR resultante</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dadosGrafico} margin={{ top: 5, right: 20, left: 0, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis
            dataKey="BID (R$ milhões/ano)"
            type="number"
            label={{ value: 'BID testado (R$ milhões/ano)', position: 'bottom', offset: 0, fill: CORES.eixo }}
            {...EIXO_PROPS}
          />
          <YAxis label={{ value: 'TIR (% a.a.)', angle: -90, position: 'insideLeft', fill: CORES.eixo }} {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => (v === null ? 'não converge' : `${Number(v).toFixed(2)}%`)} />
          <Legend verticalAlign="top" wrapperStyle={{ color: CORES.eixo, fontSize: 12 }} />
          <ReferenceLine
            y={waccPctAa}
            stroke={CORES.muted}
            strokeDasharray="3 3"
            label={{ value: 'WACC', position: 'insideTopRight', fontSize: 11, fill: CORES.eixo }}
          />
          <Line type="monotone" dataKey="TIR (% a.a.)" stroke={CORES.accent} strokeWidth={2} dot={{ r: 3, fill: CORES.accent }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
