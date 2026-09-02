'use client';

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';

interface PontoDespacho {
  data_hora: string;
  potencia_solicitada_mw: number;
  preco_rs_mwh: number;
}

export default function DespachoPrecoChart({ series }: { series: PontoDespacho[] }) {
  const dados = series.map((p) => ({
    hora: p.data_hora.slice(5, 16).replace('T', ' '),
    MW: Math.round(p.potencia_solicitada_mw * 100) / 100,
    'PLD (R$/MWh)': Math.round(p.preco_rs_mwh * 100) / 100,
  }));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        Despacho x preço — primeiros 30 dias do ano 1 (foresight perfeito: carrega nas horas mais
        baratas, descarrega nas mais caras do dia)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis dataKey="hora" tick={false} stroke={CORES.grid} label={{ value: 'Tempo (30 dias)', position: 'insideBottom', offset: -3, fill: CORES.eixo }} />
          <YAxis yAxisId="mw" label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: CORES.eixo }} {...EIXO_PROPS} />
          <YAxis yAxisId="preco" orientation="right" label={{ value: 'R$/MWh', angle: 90, position: 'insideRight', fill: CORES.eixo }} {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ color: CORES.eixo, fontSize: 12 }} />
          <ReferenceLine yAxisId="mw" y={0} stroke={CORES.eixo} strokeWidth={1} />
          <Bar yAxisId="mw" dataKey="MW" fill={CORES.accent} isAnimationActive={false} />
          <Line yAxisId="preco" type="monotone" dataKey="PLD (R$/MWh)" stroke={CORES.amber} dot={false} strokeWidth={1.3} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
