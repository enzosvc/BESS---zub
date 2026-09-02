'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';

interface LinhaTrajetoria {
  ano: number;
  receita_liquida_arbitragem_rs_ano: number;
  custo_operacional_rs_ano: number;
}

export default function ReceitaAnualChart({ trajetoria }: { trajetoria: LinhaTrajetoria[] }) {
  const dados = trajetoria.map((r) => ({
    ano: r.ano,
    'Receita líquida (R$ mil)': Math.round((r.receita_liquida_arbitragem_rs_ano / 1000) * 10) / 10,
    'Resultado após OPEX (R$ mil)': Math.round(((r.receita_liquida_arbitragem_rs_ano - r.custo_operacional_rs_ano) / 1000) * 10) / 10,
  }));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        Receita líquida de arbitragem por ano (varia com o cenário de preço)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis dataKey="ano" label={{ value: 'Ano', position: 'insideBottom', offset: -3, fill: CORES.eixo }} {...EIXO_PROPS} />
          <YAxis label={{ value: 'R$ mil', angle: -90, position: 'insideLeft', fill: CORES.eixo }} {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke={CORES.eixo} />
          <Bar dataKey="Resultado após OPEX (R$ mil)">
            {dados.map((d, i) => (
              <Cell key={i} fill={d['Resultado após OPEX (R$ mil)'] < 0 ? CORES.bad : CORES.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
