import { piedClient } from '../class/pied.class';
import { matchesPadrao, runPadraoFlow } from '../flows/padrao.flow';
import { Order } from '../types/order.types';
import {
    findLatestFailedByCode,
    markProcessing,
    markCompleted,
    markFailed,
} from '../db/repos/integrationLog.repo';
import { log } from '../db/logger';
import { pool } from '../db/pool';
import { tryLockPiedCode } from '../db/locks';
import { notifyFlowCompleted, notifyFlowFailed } from './email/notifier';

/**
 * Retoma uma execução que terminou em status='failed'. Usa o MESMO integration_log id
 * — o StepRunner consulta integration_log_steps e pula automaticamente os steps já
 * completos, executando só de onde parou em diante.
 *
 * Re-fetcha o Order do Pied antes de rodar (caso correções tenham sido feitas
 * na plataforma — produto cadastrado, doc corrigido, etc).
 */

type Flow = {
    name:    string;
    matches: (order: Order) => boolean;
    run:     (order: Order, integrationId: number) => Promise<void>;
};

const flows: Flow[] = [
    { name: 'padrao', matches: matchesPadrao, run: runPadraoFlow },
];

export type ResumeResult =
    | { status: 'no_failure';  message: string }
    | { status: 'no_flow';     flowName: string }
    | { status: 'no_order';    message: string }
    | { status: 'locked';      message: string }
    | { status: 'completed';   integrationId: number; nunota: number | null }
    | { status: 'failed';      integrationId: number; error: string };

export async function resumeOrder(piedCode: string): Promise<ResumeResult> {
    // 1. Procura último integration_log com status='failed' pra esse code
    const lastFailed = await findLatestFailedByCode(piedCode);
    if (!lastFailed) {
        return {
            status: 'no_failure',
            message: `Nenhuma execução failed encontrada para code=${piedCode}`,
        };
    }

    // 2. Acha o flow correspondente pelo nome salvo
    const flow = lastFailed.flow_name
        ? flows.find(f => f.name === lastFailed.flow_name)
        : undefined;
    if (!flow) {
        return {
            status: 'no_flow',
            flowName: lastFailed.flow_name ?? 'unknown',
        };
    }

    // 3. Re-fetcha order do Pied (pode ter sido corrigido pós-falha)
    const orders = await piedClient.getOrder(piedCode);
    if (!orders || orders.length === 0) {
        return {
            status: 'no_order',
            message: `Pied não retornou order pra code=${piedCode}`,
        };
    }
    const order = orders[0];

    await log({
        level: 'info', source: 'resumer', piedCode,
        message: `Iniciando resume da integration ${lastFailed.id} (flow=${flow.name})`,
        context: {
            integrationId: lastFailed.id,
            previousError: lastFailed.error_message?.slice(0, 200),
        },
    });

    // 4. Lock concorrencial — evita resume e webhook normal rodando juntos
    const client = await pool.connect();
    try {
        const got = await tryLockPiedCode(client, piedCode);
        if (!got) {
            return {
                status: 'locked',
                message: `Outro processo está executando esse code agora`,
            };
        }

        // 5. integration_log volta de failed → processing
        await markProcessing(lastFailed.id);

        // 6. Roda o flow com o MESMO integrationId — StepRunner pula steps já completos
        try {
            await flow.run(order, lastFailed.id);
            await markCompleted(lastFailed.id, piedCode);

            const { rows } = await client.query<{ nunota: number }>(
                `SELECT nunota FROM sankhya_orders WHERE pied_code = $1 LIMIT 1`,
                [piedCode],
            );

            await log({
                level: 'info', source: 'resumer', piedCode,
                message: `Resume concluído com sucesso`,
                context: { integrationId: lastFailed.id, nunota: rows[0]?.nunota ?? null },
            });

            notifyFlowCompleted(lastFailed.id, piedCode).catch(() => {});

            return {
                status: 'completed',
                integrationId: lastFailed.id,
                nunota: rows[0]?.nunota ?? null,
            };
        } catch (err) {
            const errorMessage = err instanceof Error
                ? `${err.message}\n${err.stack ?? ''}`
                : String(err);

            await markFailed(lastFailed.id, errorMessage);
            await log({
                level: 'error', source: 'resumer', piedCode,
                message: `Resume falhou novamente`,
                context: { integrationId: lastFailed.id, error: errorMessage },
            });

            notifyFlowFailed(lastFailed.id, piedCode).catch(() => {});

            return {
                status: 'failed',
                integrationId: lastFailed.id,
                error: errorMessage.slice(0, 500),
            };
        }
    } finally {
        client.release();
    }
}
