'use client';

import EntradaNumero from '@/components/parametros/EntradaNumero';
import { Cartao, CampoParametro, MetaCampo } from '@/components/parametros/CartaoParametros';
import { ConfigBESS, SECOES_BESS } from '@/lib/inputSchema';

type Chave = keyof ConfigBESS;

const METAS = new Map<string, MetaCampo>(
  (SECOES_BESS.find((s) => s.titulo === 'Janelas de carga e descarga')?.campos ?? []).map((m) => [m.chave as string, m])
);

const COLUNAS: { janela: 1 | 2; ponta: 'inicio' | 'fim' }[] = [
  { janela: 1, ponta: 'inicio' },
  { janela: 1, ponta: 'fim' },
  { janela: 2, ponta: 'inicio' },
  { janela: 2, ponta: 'fim' },
];

/** Trechos [início, fim) em horas; uma janela que passa da meia-noite vira dois trechos. */
function trechos(inicio: number, fim: number): [number, number][] {
  if (fim > inicio) return [[inicio, fim]];
  if (fim < inicio) return [[inicio, 24], [0, fim]];
  return [];
}

function Barra({ inicio, fim, cor, secundario }: { inicio: number; fim: number; cor: string; secundario?: boolean }) {
  return (
    <>
      {trechos(inicio, fim).map(([a, b]) => (
        <span
          key={`${a}-${b}`}
          className="absolute inset-y-0 rounded-sm"
          style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%`, backgroundColor: cor, opacity: secundario ? 0.45 : 1 }}
        />
      ))}
    </>
  );
}

const COR_CARGA = 'var(--accent)';
const COR_DESCARGA = '#E8A33D';

/** Janelas fixas do LRCAP: tabela de horários + linha do tempo de 24 h desenhada
 * como o motor despacha (orders.py): a descarga principal dura 1/C-rate a partir
 * do início — o "fim" da janela 2 de descarga não é usado pelo motor. */
export default function JanelasCargaDescarga({ bess, onChange }: { bess: ConfigBESS; onChange: (chave: Chave, valor: number) => void }) {
  const duracaoH = 1 / bess.c_rate;
  const fimDescargaPrincipal = (bess.descarga_janela2_inicio_h + duracaoH) % 24;
  const fimInformadoIgnorado = Math.abs(fimDescargaPrincipal - bess.descarga_janela2_fim_h) > 1e-9;

  function celula(chave: Chave) {
    const meta = METAS.get(chave as string);
    return (
      <td key={chave as string}>
        <EntradaNumero
          rotulo={meta?.rotulo ?? (chave as string)}
          valor={bess[chave] as number}
          onChange={(v) => onChange(chave, v)}
          min={meta?.min}
          max={meta?.max}
          unidade="h"
          className="w-[4.5rem]"
        />
      </td>
    );
  }

  return (
    <Cartao titulo="Janelas de carga e descarga" nota="despacho contratual" className="col-span-full">
      <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[auto_1fr]">
        <div>
          <table className="border-separate border-spacing-x-1 border-spacing-y-[3px] text-xs">
            <thead>
              <tr>
                <th />
                <th colSpan={2} className="font-normal text-muted-2">Janela 1 (secundária)</th>
                <th colSpan={2} className="font-normal text-muted-2">Janela 2 (principal)</th>
              </tr>
              <tr>
                <th />
                {COLUNAS.map((c) => (
                  <th key={`${c.janela}-${c.ponta}`} className="text-[11px] font-normal text-muted-2">
                    {c.ponta === 'inicio' ? 'início' : 'fim'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['carga', 'descarga'] as const).map((tipo) => (
                <tr key={tipo}>
                  <th className="pr-2 text-left font-normal text-muted">{tipo === 'carga' ? 'Carga' : 'Descarga'}</th>
                  {COLUNAS.map((c) => celula(`${tipo}_janela${c.janela}_${c.ponta}_h` as Chave))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {(['fracao_minima_ciclo_secundario', 'probabilidade_ciclo_secundario'] as const).map((chave) => (
              <CampoParametro
                key={chave}
                meta={METAS.get(chave)!}
                valor={bess[chave]}
                onChange={(v) => onChange(chave, v)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-4 text-[11px] text-muted">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ backgroundColor: COR_CARGA }} />Carga</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ backgroundColor: COR_DESCARGA }} />Descarga</span>
            <span className="text-muted-2">tom claro = ciclo secundário</span>
          </div>
          <div className="relative h-[18px] rounded bg-panel-2">
            <Barra inicio={bess.carga_janela2_inicio_h} fim={bess.carga_janela2_fim_h} cor={COR_CARGA} />
            <Barra inicio={bess.descarga_janela2_inicio_h} fim={fimDescargaPrincipal} cor={COR_DESCARGA} />
            <Barra inicio={bess.carga_janela1_inicio_h} fim={bess.carga_janela1_fim_h} cor={COR_CARGA} secundario />
            <Barra inicio={bess.descarga_janela1_inicio_h} fim={bess.descarga_janela1_fim_h} cor={COR_DESCARGA} secundario />
          </div>
          <div className="flex justify-between font-data text-[10px] text-muted-2">
            {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{h}h</span>)}
          </div>
          {fimInformadoIgnorado && (
            <p className="text-[11px] text-muted-2">
              A descarga principal dura 1/C-rate ({duracaoH.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h) a partir
              do início — o fim informado na janela 2 de descarga não é usado pelo motor.
            </p>
          )}
        </div>
      </div>
    </Cartao>
  );
}
