import type { IntegrationLogRow } from '../../db/repos/integrationLog.repo';
import type { IntegrationStepRow } from '../../db/repos/integrationStep.repo';

const STYLE = `
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #333; line-height: 1.5; }
  h2 { margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; max-width: 640px; margin-bottom: 16px; }
  td { padding: 8px 12px; border: 1px solid #ddd; vertical-align: top; }
  td.label { background: #f7f7f7; font-weight: 600; width: 200px; }
  pre { background: #f5f5f5; padding: 12px; border-left: 3px solid #d33; white-space: pre-wrap; word-break: break-word; max-width: 640px; font-size: 12px; }
  .ok { color: #0a7a18; }
  .fail { color: #c0392b; }
  .muted { color: #888; font-size: 12px; }
`;

function escapeHtml(s: string | null | undefined): string {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function renderSuccessEmail(args: {
    log:      IntegrationLogRow;
    nunota:   number | null;
    piedCode: string;
}): { subject: string; bodyHtml: string } {
    const { log, nunota, piedCode } = args;

    const subject = `[Sankhya Tool] Pedido ${piedCode} processado — NUNOTA ${nunota ?? '?'}`;

    const bodyHtml = `<!DOCTYPE html><html><head><style>${STYLE}</style></head><body>
<h2 class="ok">✓ Pedido processado com sucesso</h2>
<table>
  <tr><td class="label">Pied code</td><td>${escapeHtml(piedCode)}</td></tr>
  <tr><td class="label">NUNOTA (Sankhya)</td><td><strong>${escapeHtml(nunota)}</strong></td></tr>
  <tr><td class="label">Flow</td><td>${escapeHtml(log.flow_name)}</td></tr>
  <tr><td class="label">Duração</td><td>${escapeHtml(log.duration_ms)} ms</td></tr>
  <tr><td class="label">Iniciado em</td><td>${escapeHtml(log.started_at)}</td></tr>
  <tr><td class="label">Finalizado em</td><td>${escapeHtml(log.finished_at)}</td></tr>
  <tr><td class="label">Integration log id</td><td>${escapeHtml(log.id)}</td></tr>
</table>
<p class="muted">Sankhya Tool · pied-interactive</p>
</body></html>`;

    return { subject, bodyHtml };
}

export function renderStage1Email(args: {
    log:      IntegrationLogRow;
    steps:    IntegrationStepRow[];
    piedCode: string;
}): { subject: string; bodyHtml: string } {
    const { log, steps, piedCode } = args;

    const findPayload = (name: string): any => {
        const s = steps.find(s => s.step_name === name && s.status === 'completed');
        return s?.payload as any;
    };

    const nunota  = findPayload('create_order_header')?.nunota  ?? '?';
    const nulop   = findPayload('start_production')?.nulop      ?? '?';
    const idiproc = findPayload('confirm_production')?.ordens?.[0] ?? '?';
    const idiatv  = findPayload('list_activities')?.idiatv      ?? '?';

    const subject = `[Sankhya Tool] Pedido ${piedCode} — estágio 1 concluído (NUNOTA ${nunota})`;

    const bodyHtml = `<!DOCTYPE html><html><head><style>${STYLE}</style></head><body>
<h2 class="ok">Estágio 1 concluído — aguardando teste2</h2>
<p>O pedido foi parcialmente integrado. NUNOTA gerada, OP confirmada e atividade iniciada no Sankhya.</p>
<p>A integração continuará automaticamente assim que o pedido evoluir para <strong>teste2</strong> no Pied (com os products finais definidos).</p>
<table>
  <tr><td class="label">Pied code</td><td>${escapeHtml(piedCode)}</td></tr>
  <tr><td class="label">NUNOTA (Sankhya)</td><td><strong>${escapeHtml(nunota)}</strong></td></tr>
  <tr><td class="label">NULOP</td><td>${escapeHtml(nulop)}</td></tr>
  <tr><td class="label">IDIPROC</td><td>${escapeHtml(idiproc)}</td></tr>
  <tr><td class="label">IDIATV</td><td>${escapeHtml(idiatv)}</td></tr>
  <tr><td class="label">Flow</td><td>${escapeHtml(log.flow_name)}</td></tr>
  <tr><td class="label">Iniciado em</td><td>${escapeHtml(log.started_at)}</td></tr>
  <tr><td class="label">Pausado em</td><td>${escapeHtml(log.finished_at)}</td></tr>
  <tr><td class="label">Integration log id</td><td>${escapeHtml(log.id)}</td></tr>
</table>
<p class="muted">Sankhya Tool · pied-interactive</p>
</body></html>`;

    return { subject, bodyHtml };
}

export function renderFailureEmail(args: {
    log:        IntegrationLogRow;
    failedStep: IntegrationStepRow | null;
    piedCode:   string;
}): { subject: string; bodyHtml: string } {
    const { log, failedStep, piedCode } = args;

    const stepName  = failedStep?.step_name  ?? '(antes do primeiro step)';
    const stepIndex = failedStep?.step_index ?? '?';
    const attempt   = failedStep?.attempt_number ?? log.attempts;

    const subject = `[Sankhya Tool] Falha no pedido ${piedCode} — passo ${stepName}`;

    const errorMessage = (failedStep?.error_message ?? log.error_message ?? '(sem mensagem de erro)').slice(0, 4000);

    const bodyHtml = `<!DOCTYPE html><html><head><style>${STYLE}</style></head><body>
<h2 class="fail">✗ Falha no flow</h2>
<table>
  <tr><td class="label">Pied code</td><td>${escapeHtml(piedCode)}</td></tr>
  <tr><td class="label">Flow</td><td>${escapeHtml(log.flow_name)}</td></tr>
  <tr><td class="label">Passo que falhou</td><td><strong>${escapeHtml(stepIndex)} — ${escapeHtml(stepName)}</strong></td></tr>
  <tr><td class="label">Tentativa</td><td>${escapeHtml(attempt)}</td></tr>
  <tr><td class="label">Iniciado em</td><td>${escapeHtml(log.started_at)}</td></tr>
  <tr><td class="label">Falhou em</td><td>${escapeHtml(log.finished_at)}</td></tr>
  <tr><td class="label">Integration log id</td><td>${escapeHtml(log.id)}</td></tr>
</table>

<h3>Mensagem de erro</h3>
<pre>${escapeHtml(errorMessage)}</pre>

<h3>Como retomar (depois de corrigir o problema)</h3>
<pre>curl -X POST https://&lt;host&gt;/reprocess/${escapeHtml(piedCode)}/resume \\
  -H "Authorization: Bearer &lt;AUTH_WEBHOOK_PIED&gt;"</pre>
<p class="muted">O resume reaproveita os steps já completos — só re-executa do passo que falhou em diante.</p>

<p class="muted">Sankhya Tool · pied-interactive</p>
</body></html>`;

    return { subject, bodyHtml };
}
