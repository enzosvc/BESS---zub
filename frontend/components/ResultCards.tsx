'use client';

interface Props {
  bidEquilibrioRsAno: number;
  vplRs: number;
  tirPctAa: number;
  waccPctAa: number;
  opexFixoCapexRsAno: number;
}

function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function Card({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${destaque ? 'border-primary bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold ${destaque ? 'text-primary' : 'text-slate-900'}`}>{valor}</p>
    </div>
  );
}

export default function ResultCards({ bidEquilibrioRsAno, vplRs, tirPctAa, waccPctAa, opexFixoCapexRsAno }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card titulo="BID de equilíbrio" valor={`${formatarReais(bidEquilibrioRsAno)}/ano`} destaque />
      <Card titulo="VPL no BID de equilíbrio" valor={formatarReais(vplRs)} />
      <Card titulo="TIR do projeto" valor={`${tirPctAa.toFixed(2)}% a.a.`} />
      <Card titulo="WACC" valor={`${waccPctAa.toFixed(2)}% a.a.`} />
      <Card titulo="OPEX_FIXO_CAPEX" valor={`${formatarReais(opexFixoCapexRsAno)}/ano`} />
    </div>
  );
}
