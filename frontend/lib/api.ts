import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada — faça login de novo.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function tratarResposta(resp: Response) {
  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`Erro ${resp.status}: ${texto}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export async function listarProjetos(segmento?: string) {
  const headers = await authHeaders();
  const query = segmento ? `?segmento=${encodeURIComponent(segmento)}` : '';
  const resp = await fetch(`${API_URL}/api/projects${query}`, { headers });
  return tratarResposta(resp);
}

export async function obterProjeto(projectId: string) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects/${projectId}`, { headers });
  return tratarResposta(resp);
}

export async function criarProjeto(payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

export async function atualizarProjeto(projectId: string, payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects/${projectId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

export async function excluirProjeto(projectId: string) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects/${projectId}`, {
    method: 'DELETE',
    headers,
  });
  return tratarResposta(resp);
}

/** Roda a simulação síncrona (rápida, ~1-2s) direto com um payload de input,
 * sem precisar salvar como projeto antes. */
export async function simular(payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/simulate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

/** Roda a simulação síncrona usando o input já salvo do projeto, e persiste o resultado. */
export async function simularProjeto(projectId: string) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects/${projectId}/simulate`, {
    method: 'POST',
    headers,
  });
  return tratarResposta(resp);
}

/** Dispara o job assíncrono de sensibilidade (Bloco 8.2, ~90s) e devolve { job_id }. */
export async function iniciarSensibilidade(projectId: string, bidEquilibrioRsAno?: number) {
  const headers = await authHeaders();
  const query = bidEquilibrioRsAno ? `?bid_equilibrio_rs_ano=${bidEquilibrioRsAno}` : '';
  const resp = await fetch(`${API_URL}/api/projects/${projectId}/sensitivity${query}`, {
    method: 'POST',
    headers,
  });
  return tratarResposta(resp);
}

/** Consulta o status/resultado de um job de sensibilidade — chame em polling
 * (ex.: a cada 2s) até status === 'completed' ou 'failed'. */
export async function obterStatusSensibilidade(jobId: string) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/sensitivity/${jobId}`, { headers });
  return tratarResposta(resp);
}

// =============================================================================
// Modelo de negócio: ARBITRAGEM (standalone ou FV+BESS)
// =============================================================================

export async function criarProjetoArbitragem(payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects/arbitragem`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

export async function atualizarProjetoArbitragem(projectId: string, payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/projects/${projectId}/arbitragem`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

/** Simulação ad-hoc do modelo de arbitragem (não salva projeto). */
export async function simularArbitragem(payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/simulate-arbitragem`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

/** Cenários de preço (PLD real ou projeção), usados pelos modelos de arbitragem. */
export async function criarPriceScenario(payload: unknown) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/price-scenarios`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return tratarResposta(resp);
}

export async function listarPriceScenarios() {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/price-scenarios`, { headers });
  return tratarResposta(resp);
}

export async function obterPriceScenario(scenarioId: string) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/price-scenarios/${scenarioId}`, { headers });
  return tratarResposta(resp);
}

export async function excluirPriceScenario(scenarioId: string) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_URL}/api/price-scenarios/${scenarioId}`, {
    method: 'DELETE',
    headers,
  });
  return tratarResposta(resp);
}
