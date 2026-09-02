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
 */
function parseCsv(texto: string): AnoParseado[] {
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length < 2) throw new Error('CSV vazio ou só com cabeçalho.');

  const cabecalho = linhas[0].split(',').map((s) => s.trim().toLowerCase());
  const idxAno = cabecalho.indexOf('ano');
  const idxPreco = cabecalho.indexOf('preco_rs_mwh');
  if (idxAno === -1 || idxPreco === -1) {
    throw new Error('Cabeçalho precisa ter exatamente as colunas: ano,preco_rs_mwh');
  }

  const porAno = new Map<number, number[]>();
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const partes = linha.split(',');
    const ano = parseInt(partes[idxAno], 10);
    const preco = parseFloat(partes[idxPreco]);
    if (Number.isNaN(ano) || Number.isNaN(preco)) {
      throw new Error(`Linha ${i + 1} inválida: "${linha}"`);
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
          if (a.precos_rs_mwh.length % 24 !== 0) {
            throw new Error(
              `Ano ${a.ano} tem ${a.precos_rs_mwh.length} horas — precisa ser múltiplo de 24 (8760 ou 8784).`
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
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Nome do cenário</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: PLD SUDESTE histórico 2021-2025"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Submercado</label>
          <select
            value={submercado}
            onChange={(e) => setSubmercado(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="SUDESTE">SUDESTE</option>
            <option value="SUL">SUL</option>
            <option value="NORDESTE">NORDESTE</option>
            <option value="NORTE">NORTE</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Fonte (opcional)</label>
          <input
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            placeholder="ex.: CCEE PLD horário / Projeção EPE PDE 2035"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Arquivo CSV — colunas <code className="rounded bg-slate-100 px-1">ano,preco_rs_mwh</code>
        </label>
        <input type="file" accept=".csv" onChange={handleArquivo} className="text-sm" />
        <p className="mt-1 text-xs text-slate-400">
          `ano` é o ano SIMULADO (1, 2, 3...), não o ano calendário. As linhas de cada ano precisam já
          estar em ordem cronológica horária (8760 ou 8784 linhas por ano).
        </p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {resumo && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-4">Ano simulado</th>
                <th className="py-1 pr-4">Horas</th>
                <th className="py-1 pr-4">Preço médio</th>
                <th className="py-1 pr-4">Mín</th>
                <th className="py-1 pr-4">Máx</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.ano} className="border-b border-slate-100">
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
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? 'Salvando...' : 'Salvar cenário'}
        </button>
      </div>
    </div>
  );
}
