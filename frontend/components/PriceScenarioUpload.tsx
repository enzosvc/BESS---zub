'use client';

import { useState } from 'react';
import { criarPriceScenario } from '@/lib/api';

interface AnoParseado {
  ano: number; // ano SIMULADO (1, 2, 3... em ordem cronológica) — derivado, não digitado
  ano_calendario: number; // só para exibição no preview
  precos_rs_mwh: number[];
  parcial: boolean; // true = último ano do arquivo, com menos horas que um ano completo
}

interface ResumoAno {
  ano: number;
  ano_calendario: number;
  n_horas: number;
  n_horas_esperado: number;
  parcial: boolean;
  preco_medio_rs_mwh: number;
  preco_min_rs_mwh: number;
  preco_max_rs_mwh: number;
}

/**
 * Formato esperado do arquivo: as MESMAS 4 colunas do PLD consolidado —
 * `Data, Hora, Submercado, PLD` (nomes exatos, sem distinguir maiúsc/minúsc).
 * Não existe mais uma coluna "ano simulado" digitada à mão: o ano simulado
 * é derivado automaticamente do ano-calendário de `Data`, em ordem
 * cronológica crescente (o ano-calendário mais antigo no arquivo vira o
 * ano simulado 1, o segundo mais antigo vira o ano 2, e assim por diante).
 *
 * Como o arquivo consolidado tem os 4 submercados juntos, o campo
 * "Submercado" do formulário funciona como FILTRO — só as linhas desse
 * submercado entram no cenário; as outras são ignoradas.
 *
 * `Data` aceita AAAA-MM-DD (ISO) ou DD/MM/AAAA (Excel/BR). `Hora` é um
 * inteiro 0-23. Delimitador (`,` ou `;`) e separador decimal do PLD (`.`
 * ou `,`) são detectados automaticamente.
 */

const FAIXA_PRECO_RAZOAVEL = { min: 0, max: 100_000 }; // R$/MWh — só para pegar erro grosseiro de unidade/digitação

function detectarDelimitador(linhaCabecalho: string): string {
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
    const ultimaVirgula = t.lastIndexOf(',');
    const ultimoPonto = t.lastIndexOf('.');
    normalizado = ultimaVirgula > ultimoPonto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = t.replace(',', '.');
  }

  const valor = Number(normalizado);
  if (Number.isNaN(valor) || !Number.isFinite(valor)) {
    throw new Error(`${contexto}: "${texto}" não é um número válido.`);
  }
  return valor;
}

/** Aceita "AAAA-MM-DD" (ISO, com ou sem hora grudada: "2024-01-01 00:00:00" /
 * "2024-01-01T00:00:00") ou "DD/MM/AAAA" (Excel/BR). Retorna ano/mês/dia. */
function parseData(texto: string, contexto: string): { ano: number; mes: number; dia: number } {
  const t = texto.trim().split(/[ T]/)[0]; // descarta hora grudada na data, se houver

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };

  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { ano: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]) };

  throw new Error(`${contexto}: data "${texto}" não reconhecida (use AAAA-MM-DD ou DD/MM/AAAA).`);
}

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

interface LinhaParseada {
  chaveOrdenacao: number; // ano*1000000 + mes*10000 + dia*100 + hora — pra ordenar cronologicamente
  ano_calendario: number;
  preco: number;
}

interface AnoIgnorado {
  ano_calendario: number;
  n_horas: number;
  n_horas_esperado: number;
}

function parseArquivo(texto: string, submercadoAlvo: string): { anos: AnoParseado[]; ignorados: AnoIgnorado[] } {
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length < 2) throw new Error('Arquivo vazio ou só com cabeçalho.');

  const delimitador = detectarDelimitador(linhas[0]);
  const cabecalho = linhas[0].split(delimitador).map((s) => s.trim().toLowerCase());
  const idxData = cabecalho.indexOf('data');
  const idxHora = cabecalho.indexOf('hora');
  const idxSubmercado = cabecalho.indexOf('submercado');
  const idxPld = cabecalho.indexOf('pld');
  if (idxData === -1 || idxHora === -1 || idxSubmercado === -1 || idxPld === -1) {
    throw new Error(
      `Cabeçalho precisa ter as colunas "Data", "Hora", "Submercado" e "PLD" ` +
      `(delimitador detectado: "${delimitador}"). Cabeçalho lido: ${linhas[0]}`
    );
  }

  const alvo = submercadoAlvo.trim().toUpperCase();
  const linhasParseadas: LinhaParseada[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const partes = linha.split(delimitador);
    if (partes.length <= Math.max(idxData, idxHora, idxSubmercado, idxPld)) {
      throw new Error(`Linha ${i + 1} tem menos colunas que o esperado: "${linha}"`);
    }

    const submercadoLinha = partes[idxSubmercado].trim().toUpperCase();
    if (submercadoLinha !== alvo) continue; // filtra: só o submercado selecionado no formulário

    const { ano, mes, dia } = parseData(partes[idxData], `Linha ${i + 1}, coluna "Data"`);
    const hora = parseNumero(partes[idxHora], `Linha ${i + 1}, coluna "Hora"`);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) {
      throw new Error(`Linha ${i + 1}: "Hora" precisa ser um inteiro de 0 a 23 (recebido: ${partes[idxHora]}).`);
    }
    const preco = parseNumero(partes[idxPld], `Linha ${i + 1}, coluna "PLD"`);
    if (preco < FAIXA_PRECO_RAZOAVEL.min || preco > FAIXA_PRECO_RAZOAVEL.max) {
      throw new Error(
        `Linha ${i + 1}: PLD ${preco} R$/MWh está fora da faixa razoável ` +
        `(${FAIXA_PRECO_RAZOAVEL.min}–${FAIXA_PRECO_RAZOAVEL.max}). Confira a unidade/formato do arquivo.`
      );
    }

    linhasParseadas.push({
      chaveOrdenacao: ano * 1_000_000 + mes * 10_000 + dia * 100 + hora,
      ano_calendario: ano,
      preco,
    });
  }

  if (linhasParseadas.length === 0) {
    throw new Error(
      `Nenhuma linha encontrada para o submercado "${submercadoAlvo}". Confira se o arquivo tem ` +
      `esse submercado exatamente com esse nome (SUDESTE, SUL, NORDESTE ou NORTE).`
    );
  }

  linhasParseadas.sort((a, b) => a.chaveOrdenacao - b.chaveOrdenacao);

  // Agrupa por ano-calendário (já em ordem cronológica) e verifica duplicatas
  // (mesma chaveOrdenacao repetida = mesma Data+Hora aparecendo mais de uma vez).
  for (let i = 1; i < linhasParseadas.length; i++) {
    if (linhasParseadas[i].chaveOrdenacao === linhasParseadas[i - 1].chaveOrdenacao) {
      throw new Error(
        `Data/Hora duplicada encontrada para ${submercadoAlvo}: mais de uma linha com a mesma ` +
        `combinação de Data e Hora. Confira o arquivo de origem.`
      );
    }
  }

  const porAnoCalendario = new Map<number, number[]>();
  for (const l of linhasParseadas) {
    if (!porAnoCalendario.has(l.ano_calendario)) porAnoCalendario.set(l.ano_calendario, []);
    porAnoCalendario.get(l.ano_calendario)!.push(l.preco);
  }

  const anosCalendarioOrdenados = Array.from(porAnoCalendario.keys()).sort((a, b) => a - b);

  // Todo ano precisa ser completo (8760/8784h), EXCETO o último — esse pode
  // ser parcial (o caso mais comum: o ano corrente, ainda em andamento no
  // arquivo consolidado). Um ano incompleto no MEIO da série continua sendo
  // ignorado, porque indica um buraco de dado real, não "ainda não acabou".
  const ignorados: AnoIgnorado[] = [];
  const completos: { ano_calendario: number; precos: number[]; parcial: boolean }[] = [];
  anosCalendarioOrdenados.forEach((anoCalendario, indice) => {
    const precos = porAnoCalendario.get(anoCalendario)!;
    const esperado = ehBissexto(anoCalendario) ? 8784 : 8760;
    const ehUltimoDoArquivo = indice === anosCalendarioOrdenados.length - 1;

    if (precos.length === esperado) {
      completos.push({ ano_calendario: anoCalendario, precos, parcial: false });
    } else if (ehUltimoDoArquivo && precos.length > 0 && precos.length % 24 === 0) {
      completos.push({ ano_calendario: anoCalendario, precos, parcial: true });
    } else {
      ignorados.push({ ano_calendario: anoCalendario, n_horas: precos.length, n_horas_esperado: esperado });
    }
  });

  if (completos.length === 0) {
    throw new Error(
      `Nenhum ano utilizável encontrado para ${submercadoAlvo} — todos os anos do arquivo estão com ` +
      `horas faltando no meio da série (${ignorados.map((a) => `${a.ano_calendario}: ${a.n_horas}/${a.n_horas_esperado}h`).join(', ')}).`
    );
  }

  const anos = completos.map((c, indice) => ({
    ano: indice + 1,
    ano_calendario: c.ano_calendario,
    precos_rs_mwh: c.precos,
    parcial: c.parcial,
  }));

  return { anos, ignorados };
}

function resumir(anos: AnoParseado[]): ResumoAno[] {
  return anos.map((a) => ({
    ano: a.ano,
    ano_calendario: a.ano_calendario,
    n_horas: a.precos_rs_mwh.length,
    n_horas_esperado: ehBissexto(a.ano_calendario) ? 8784 : 8760,
    parcial: a.parcial,
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
  const [ignorados, setIgnorados] = useState<AnoIgnorado[]>([]);
  const [resumo, setResumo] = useState<ResumoAno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arquivoTexto, setArquivoTexto] = useState<string | null>(null);

  function processarArquivo(texto: string, submercadoAlvo: string) {
    setErro(null);
    setAnosParseados(null);
    setIgnorados([]);
    setResumo(null);
    try {
      const { anos, ignorados: anosIgnorados } = parseArquivo(texto, submercadoAlvo);
      setAnosParseados(anos);
      setIgnorados(anosIgnorados);
      setResumo(resumir(anos));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler o arquivo.');
    }
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = () => {
      const texto = reader.result as string;
      setArquivoTexto(texto);
      processarArquivo(texto, submercado);
    };
    reader.readAsText(arquivo);
  }

  function handleTrocarSubmercado(novoSubmercado: string) {
    setSubmercado(novoSubmercado);
    if (arquivoTexto) processarArquivo(arquivoTexto, novoSubmercado); // reprocessa com o novo filtro
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
        anos: anosParseados.map((a) => ({ ano: a.ano, precos_rs_mwh: a.precos_rs_mwh })),
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
          <label className="mb-1 block text-xs font-medium text-muted">
            Submercado <span className="text-muted-2">(filtra as linhas do arquivo)</span>
          </label>
          <select
            value={submercado}
            onChange={(e) => handleTrocarSubmercado(e.target.value)}
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
          Arquivo CSV — colunas{' '}
          <code className="rounded bg-panel-2 px-1">Data,Hora,Submercado,PLD</code> (igual ao PLD consolidado)
        </label>
        <input type="file" accept=".csv" onChange={handleArquivo} className="text-sm" />
        <p className="mt-1 text-xs text-muted-2">
          Pode conter os 4 submercados juntos — só as linhas do submercado escolhido acima entram no
          cenário. O ano simulado (1, 2, 3...) é derivado automaticamente da coluna Data, em ordem
          cronológica — não precisa numerar nada. O último ano do arquivo pode ser parcial (ex.: o ano
          corrente, ainda em andamento) — só um ano incompleto no meio da série é rejeitado. Aceita
          separador <code>,</code> ou <code>;</code>, Data em <code>AAAA-MM-DD</code> ou{' '}
          <code>DD/MM/AAAA</code>, e decimal com <code>.</code> ou <code>,</code>.
        </p>
      </div>

      {erro && <p className="text-sm text-bad">{erro}</p>}

      {ignorados.length > 0 && (
        <div className="rounded-lg border border-warn/40 bg-panel-2 p-3 text-xs text-warn">
          {ignorados.length} ano(s) ignorado(s) por estarem incompletos NO MEIO da série (não entram no
          cenário): {ignorados.map((a) => `${a.ano_calendario} (${a.n_horas}/${a.n_horas_esperado}h)`).join(', ')}.
          Isso normalmente indica linhas faltando no arquivo de origem — confira antes de continuar.
        </div>
      )}

      {resumo && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1 pr-4">Ano simulado</th>
                <th className="py-1 pr-4">Ano calendário</th>
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
                  <td className="py-1 pr-4">{r.ano_calendario}</td>
                  <td className="py-1 pr-4">
                    {r.n_horas}/{r.n_horas_esperado}
                    {r.parcial && (
                      <span className="ml-1 rounded-full bg-warn/20 px-1.5 py-0.5 text-[10px] font-medium text-warn">
                        parcial
                      </span>
                    )}
                  </td>
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
