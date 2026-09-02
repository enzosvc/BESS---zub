'use client';

interface LinhaTrajetoria {
  ano: number;
  energia_liquida_poi_mwh_ano: number;
  perdas_mwh_ano: number;
  capacidade_disponivel_mwh: number;
  capacidade_liquida_poi_mwh: number;
  custo_augmentation_rs: number;
}

interface LinhaDetalhamento {
  ano: number;
  custo_nao_atendimento_rs: number;
}

function formatarNumero(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function TabelaTecnicaAnual({
  trajetoria,
  detalhamentoCustos,
}: {
  trajetoria: LinhaTrajetoria[];
  detalhamentoCustos: LinhaDetalhamento[];
}) {
  const custoNaoAtendimentoPorAno = new Map(detalhamentoCustos.map((d) => [d.ano, d.custo_nao_atendimento_rs]));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">Tabela técnica — por ano do contrato</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-3">Ano</th>
              <th className="py-2 pr-3">Energia líquida POI (MWh)</th>
              <th className="py-2 pr-3">Perdas (MWh)</th>
              <th className="py-2 pr-3">Capacidade disponível (MWh)</th>
              <th className="py-2 pr-3">Capacidade líquida POI (MWh)</th>
              <th className="py-2 pr-3">Potência líquida POI (MW)</th>
              <th className="py-2 pr-3">Custo augmentation (R$)</th>
              <th className="py-2 pr-3">Custo não atendimento (R$)</th>
            </tr>
          </thead>
          <tbody>
            {trajetoria.map((r) => (
              <tr key={r.ano} className="border-b border-line text-ink">
                <td className="py-1.5 pr-3 font-medium">{r.ano}</td>
                <td className="py-1.5 pr-3">{formatarNumero(r.energia_liquida_poi_mwh_ano)}</td>
                <td className="py-1.5 pr-3">{formatarNumero(r.perdas_mwh_ano)}</td>
                <td className="py-1.5 pr-3">{formatarNumero(r.capacidade_disponivel_mwh)}</td>
                <td className="py-1.5 pr-3">{formatarNumero(r.capacidade_liquida_poi_mwh)}</td>
                <td className="py-1.5 pr-3">{formatarNumero(r.capacidade_liquida_poi_mwh / 4)}</td>
                <td className="py-1.5 pr-3">{formatarReais(r.custo_augmentation_rs)}</td>
                <td className="py-1.5 pr-3">{formatarReais(custoNaoAtendimentoPorAno.get(r.ano) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
