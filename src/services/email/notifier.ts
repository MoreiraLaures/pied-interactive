/**
 * Notificações de alto nível plugadas no flow:
 *   - notifyFlowCompleted: chamada após markCompleted (sucesso)
 *   - notifyFlowFailed:    chamada após markFailed    (falha)
 *
 * Ambas são "fire-and-forget" pelo caller — qualquer erro de email é capturado
 * aqui e logado em app_logs, NUNCA propagado pra não derrubar o flow.
 */

import { findById } from '../../db/repos/integrationLog.repo';
import { findFailedStep, findAllByIntegration } from '../../db/repos/integrationStep.repo';
import { sendMail, getRecipients } from './mailer';
import { renderSuccessEmail, renderFailureEmail, renderStage1Email } from './templates';
import { log } from '../../db/logger';
import { pool } from '../../db/pool';

export async function notifyFlowCompleted(integrationId: number, piedCode: string): Promise<void> {
    try {
        const recipients = getRecipients();
        if (recipients.length === 0) {
            console.warn('[notifier] MAIL_RECIPIENTS vazio — pulando notificação de sucesso');
            return;
        }

        const logRow = await findById(integrationId);
        if (!logRow) return;

        const { rows } = await pool.query<{ nunota: number }>(
            `SELECT nunota FROM sankhya_orders WHERE pied_code = $1 LIMIT 1`,
            [piedCode],
        );
        const nunota = rows[0]?.nunota ?? null;

        const { subject, bodyHtml } = renderSuccessEmail({ log: logRow, nunota, piedCode });
        await sendMail({ to: recipients, subject, bodyHtml });

        await log({
            level: 'info', source: 'notifier', piedCode,
            message: 'Email de sucesso enviado',
            context: { integrationId, recipients, nunota },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await log({
            level: 'error', source: 'notifier', piedCode,
            message: 'Falha ao enviar email de sucesso',
            context: { integrationId, error: msg },
        }).catch(() => {});
        console.error('[notifier]', msg);
    }
}

export async function notifyFlowStage1(integrationId: number, piedCode: string): Promise<void> {
    try {
        const recipients = getRecipients();
        if (recipients.length === 0) {
            console.warn('[notifier] MAIL_RECIPIENTS vazio — pulando notificação de estágio 1');
            return;
        }

        const logRow = await findById(integrationId);
        if (!logRow) return;

        const steps = await findAllByIntegration(integrationId);

        const { subject, bodyHtml } = renderStage1Email({ log: logRow, steps, piedCode });
        await sendMail({ to: recipients, subject, bodyHtml });

        await log({
            level: 'info', source: 'notifier', piedCode,
            message: 'Email de estágio 1 enviado',
            context: { integrationId, recipients },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await log({
            level: 'error', source: 'notifier', piedCode,
            message: 'Falha ao enviar email de estágio 1',
            context: { integrationId, error: msg },
        }).catch(() => {});
        console.error('[notifier]', msg);
    }
}

export async function notifyFlowFailed(integrationId: number, piedCode: string): Promise<void> {
    try {
        const recipients = getRecipients();
        if (recipients.length === 0) {
            console.warn('[notifier] MAIL_RECIPIENTS vazio — pulando notificação de falha');
            return;
        }

        const logRow = await findById(integrationId);
        if (!logRow) return;

        const failedStep = await findFailedStep(integrationId);

        const { subject, bodyHtml } = renderFailureEmail({ log: logRow, failedStep, piedCode });
        await sendMail({ to: recipients, subject, bodyHtml });

        await log({
            level: 'info', source: 'notifier', piedCode,
            message: 'Email de falha enviado',
            context: { integrationId, recipients, failedStep: failedStep?.step_name },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await log({
            level: 'error', source: 'notifier', piedCode,
            message: 'Falha ao enviar email de falha',
            context: { integrationId, error: msg },
        }).catch(() => {});
        console.error('[notifier]', msg);
    }
}
