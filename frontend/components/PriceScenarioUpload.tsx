'use client';

import { useState } from 'react';
import { criarPriceScenario } from '@/lib/api';

interface AnoParseado {
  ano: number;
  precos_rs_mwh: number[];
}

interface ResumoAno {
  ano: number;
  n_horas: number;
  preco_medio_rs_mwh: number;
  preco_min_rs_mwh: number;
  preco_max_rs_mwh: number;
}

/**
 * Formato esperado do CSV: duas colunas, `ano,preco_rs_mwh` (cabeçalho
 * obrigatório, nomes exatos). As linhas de um mesmo `ano` PRECISAM já estar
 * em ordem cronológica horária (a mesma ordem em que aparecem no arquivo) —
 * é essa ordem que vira a posição hora-a-hora dentro do ano simulado.
 * `ano` é o ano SIMULADO do projeto (1, 2, 3...), não o ano calendário.
 *
 * Isso mapeia direto de uma tabela dinâmica do PLD consolidado: filtre um
 * submercado, ordene por Data+Hora, e numere os anos calendário na ordem em
 * que devem ser simulados (1, 2, 3...).
 *
 * Delimitador (`,` ou `;`) e separador decimal (`.` ou `,`) são detectados
 * automaticamente a partir do cabeçalho e dos valores — aceita tanto CSV
 * "internacional" (vírgula separa campos, ponto é decimal) quanto o formato
 * brasileiro comum nos exports de PLD (ponto e vírgula separa campos, vírgula
 * é decimal).
 */

const FAIXA_PRECO_RAZOAVEL = { min: 0, max: 100_000 }; // R$/MWh — só para pegar erro grosseiro de unidade/digitação

function detectarDelimitador(linhaCabecalho: string): string {
  // Se o cabeçalho tem ';' e NÃO tem ',', é ponto-e-vírgula. Nos outros casos, vírgula.
  if (linhaCabecalho.includes(';') && !linhaCabecalho.includes(',')) return ';';
  return ',';
}

/** Converte um texto numérico em number, tratando os dois formatos de decimal:
 * "204.37" (internacional) e "204,37" (BR) — e também milhar: "1.234,56" ou "1,234.56".
 * Lança erro em vez de truncar silenciosamente quando o formato é ambíguo/inválido. */
function parseNumero(texto: string, contexto: string): number {
  const t = texto.trim();
  if (t === '') throw new Error(`${contexto}: valor vazio.`);

  const temVirgula = t.includes(',');
  const temPonto = t.includes('.');
  let normalizado = t;

  if (temVirgula && temPonto) {
    // O separador que aparece por último é o decimal; o outro é milhar (remove).
    const ultimaVirgula = t.lastIndexOf(',');
    const ultimoPonto = t.lastIndexOf('.');
    if (ultimaVirgula > ultimoPonto) {
      normalizado = t.replace(/\./g, '').replace(',', '.');
    } else {
      normalizado = t.replace(/,/g, '');
    }
  } else if (temVirgula) {
    // Só vírgula presente -> é o decimal (formato BR: "204,37")
    normalizado = t.replace(',', '.');
  }
  // Só ponto, ou nenhum separador: já está no formato que Number() entende.

  const valor = Number(normalizado);
  if (Number.isNaN(valor) || !Number.isFinite(valor)) {
    throw new Error(`${contexto}: "${texto}" não é um número válido.`);
  }
  return valor;
}

function parseCsv(texto: string): AnoParseado[] {
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length < 2) throw new Error('CSV vazio ou só com cabeçalho.');

  const delimitador = detectarDelimitador(linhas[0]);
  const cabecalho = linhas[0].split(delimitador).map((s) => s.trim().toLowerCase());
  const idxAno = cabecalho.indexOf('ano');
  const idxPreco = cabecalho.indexOf('preco_rs_mwh');
  if (idxAno === -1 || idxPreco === -1) {
    throw new Error(
      `Cabeçalho precisa ter as colunas "ano" e "preco_rs_mwh" (delimitador detectado: "${delimitador}"). ` +
      `Cabeçalho lido: ${linhas[0]}`
    );
  }

  const porAno = new Map<number, number[]>();
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const partes = linha.split(delimitador);
    if (partes.length <= Math.max(idxAno, idxPreco)) {
      throw new Error(`Linha ${i + 1} tem menos colunas que o esperado: "${linha}"`);
    }

    let ano: number;
    let preco: number;
    try {
      ano = parseNumero(partes[idxAno], `Linha ${i + 1}, coluna "ano"`);
      preco = parseNumero(partes[idxPreco], `Linha ${i + 1}, coluna "preco_rs_mwh"`);
    } catch (err) {
      throw err instanceof Error ? err : new Error(`Linha ${i + 1} inválida: "${linha}"`);
    }

    if (!Number.isInteger(ano) || ano <= 0) {
      throw new Error(`Linha ${i + 1}: "ano" precisa ser um inteiro positivo (recebido: ${partes[idxAno]}).`);
    }
    if (preco < FAIXA_PRECO_RAZOAVEL.min || preco > FAIXA_PRECO_RAZOAVEL.max) {
      throw new Error(
        `Linha ${i + 1}: preço ${preco} R$/MWh está fora da faixa razoável ` +
        `(${FAIXA_PRECO_RAZOAVEL.min}–${FAIXA_PRECO_RAZOAVEL.max}). Confira a unidade/formato do arquivo.`
      );
    }

    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano)!.push(preco);
  }

  return Array.from(porAno.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ano, precos_rs_mwh]) => ({ ano, precos_rs_mwh }));
}

function resumir(anos: AnoParseado[]): ResumoAno[] {
  return anos.map((a) => ({
    ano: a.ano,
    n_horas: a.precos_rs_mwh.length,
    preco_medio_rs_mwh: a.precos_rs_mwh.reduce((s, v) => s + v, 0) / a.precos_rs_mwh.length,
    preco_min_rs_mwh: Math.min(...a.precos_rs_mwh),
    preco_max_rs_mwh: Math.max(...a.precos_rs_mwh),
  }));
}

export default function PriceScenarioUpload({ onCriado }: { onCriado: (scenario: any) => void }) {
  const [nome, setNome] = useState('');
  const [submercado, setSubmercado] = useState('SUDESTE');
  const [fonte, setFonte] = useState('');
  const [anosParseados, setAnosParseados] = useState<AnoParseado[] | null>(null);
  const [resumo, setResumo] = useState<ResumoAno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErro(null);
    setAnosParseados(null);
    setResumo(null);
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const anos = parseCsv(reader.result as string);
        for (const a of anos) {
          if (a.precos_rs_mwh.length !== 8760 && a.precos_rs_mwh.length !== 8784) {
            throw new Error(
              `Ano ${a.ano} tem ${a.precos_rs_mwh.length} horas — precisa ser exatamente 8760 ` +
              `(ano comum) ou 8784 (ano bissexto). Confira se não há linhas faltando, duplicadas, ` +
              `ou de outro ano misturadas.`
            );
          }
        }
        setAnosParseados(anos);
        setResumo(resumir(anos));
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao ler o CSV.');
      }
    };
    reader.readAsText(arquivo);
  }

  async function handleSalvar() {
    if (!anosParseados || !nome.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const salvo = await criarPriceScenario({
        name: nome,
        submercado,
        fonte: fonte || undefined,
        anos: anosParseados,
      });
      onCriado(salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar cenário.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-line bg-panel p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Nome do cenário</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: PLD SUDESTE histórico 2021-2025"
          className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Submercado</label>
          <select
            value={submercado}
            onChange={(e) => setSubmercado(e.target.value)}
            className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            <option value="SUDESTE">SUDESTE</option>
            <option value="SUL">SUL</option>
            <option value="NORDESTE">NORDESTE</option>
            <option value="NORTE">NORTE</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Fonte (opcional)</label>
          <input
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            placeholder="ex.: CCEE PLD horário / Projeção EPE PDE 2035"
            className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Arquivo CSV — colunas <code className="rounded bg-panel-2 px-1">ano,preco_rs_mwh</code>
        </label>
        <input type="file" accept=".csv" onChange={handleArquivo} className="text-sm" />
        <p className="mt-1 text-xs text-muted-2">
          `ano` é o ano SIMULADO (1, 2, 3...), não o ano calendário. Cada ano precisa ter exatamente
          8760 (ano comum) ou 8784 (bissexto) linhas, em ordem cronológica horária. Aceita separador
          `,` ou `;`, e decimal com `.` ou `,` — detectados automaticamente.
        </p>
      </div>

      {erro && <p className="text-sm text-bad">{erro}</p>}

      {resumo && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1 pr-4">Ano simulado</th>
                <th className="py-1 pr-4">Horas</th>
                <th className="py-1 pr-4">Preço médio</th>
                <th className="py-1 pr-4">Mín</th>
                <th className="py-1 pr-4">Máx</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.ano} className="border-b border-line">
                  <td className="py-1 pr-4">{r.ano}</td>
                  <td className="py-1 pr-4">{r.n_horas}</td>
                  <td className="py-1 pr-4">R$ {r.preco_medio_rs_mwh.toFixed(2)}</td>
                  <td className="py-1 pr-4">R$ {r.preco_min_rs_mwh.toFixed(2)}</td>
                  <td className="py-1 pr-4">R$ {r.preco_max_rs_mwh.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSalvar}
          disabled={!anosParseados || !nome.trim() || enviando}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? 'Salvando...' : 'Salvar cenário'}
        </button>
      </div>
    </div>
  );
}
