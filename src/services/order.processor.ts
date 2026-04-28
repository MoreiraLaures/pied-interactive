import type { PoolClient } from 'pg';
import { Order } from '../types/order.types';
import { matchesPadrao, runPadraoFlow } from '../flows/padrao.flow';
import { log } from '../db/logger';
import { pool } from '../db/pool';
import { tryLockPiedCode } from '../db/locks';
import {
    createPending,
    markProcessing,
    markCompleted,
    markFailed,
    findLatestFailedByCode,
} from '../db/repos/integrationLog.repo';
import { notifyFlowCompleted, notifyFlowFailed } from './email/notifier';

type Flow = {
    name: string;
    matches: (order: Order) => boolean;
    run:     (order: Order, integrationId: number) => Promise<void>;
};

const flows: Flow[] = [
    { name: 'padrao', matches: matchesPadrao, run: runPadraoFlow },
    // novos flows aqui
];

export async function processOrder(order: Order): Promise<void> {
    const flow = flows.find(f => f.matches(order));
    if (!flow) return;

    // 1. Skip por completação — pré-check rápido sem lock
    const completed = await checkAlreadyCompleted(order.code);
    if (completed) {
        await log({
            level: 'info', source: 'processor', piedCode: order.code,
            message: 'Pedido já processado anteriormente — skip',
            context: { existing: completed, flow: flow.name },
        });
        return;
    }

    // 2. Lock concorrencial via Postgres advisory lock
    const client = await pool.connect();
    try {
        const got = await tryLockPiedCode(client, order.code);
        if (!got) {
            await log({
                level: 'warn', source: 'processor', piedCode: order.code,
                message: 'Outro processo já está executando esse pedido — skip',
                context: { flow: flow.name },
            });
            return;
        }

        // 3. Re-check dentro do lock
        const recheck = await checkAlreadyCompleted(order.code, client);
        if (recheck) {
            await log({
                level: 'info', source: 'processor', piedCode: order.code,
                message: 'Pedido completado por outro processo durante o lock — skip',
                context: { existing: recheck, flow: flow.name },
            });
            return;
        }

        const lastFailed = await findLatestFailedByCode(order.code);
        const isResume = !!(lastFailed && lastFailed.flow_name === flow.name);
        const integrationId = isResume
            ? lastFailed!.id
            : await createPending(order.code, flow.name);

        await markProcessing(integrationId);

        await log({
            level: 'info', source: 'processor', piedCode: order.code,
            message: isResume
                ? `Retomando execução failed anterior (id=${integrationId})`
                : `Nova execução criada (id=${integrationId})`,
            context: { integrationId, flow: flow.name, isResume },
        });

        // 5. Roda o flow passando o integrationId pra rastreamento dos steps
        try {
            await flow.run(order, integrationId);
            await markCompleted(integrationId, order.code);
            // fire-and-forget — falha de email não derruba o flow
            notifyFlowCompleted(integrationId, order.code).catch(() => {});
        } catch (err) {
            const errorMessage = err instanceof Error
                ? `${err.message}\n${err.stack ?? ''}`
                : String(err);
            await markFailed(integrationId, errorMessage);
            await log({
                level: 'error', source: 'processor', piedCode: order.code,
                message: `Flow '${flow.name}' falhou`,
                context: { integrationId, error: errorMessage },
            });
            notifyFlowFailed(integrationId, order.code).catch(() => {});
            // não relança — falha de flow individual não derruba o webhook
        }
    } finally {
        client.release();
    }
}

type CompletedRow = {
    nunota: number;
    codparc: number;
    created_at: string;
};

async function checkAlreadyCompleted(
    code: string,
    client?: PoolClient
): Promise<CompletedRow | null> {
    const runner = client ?? pool;
    const { rows } = await runner.query<CompletedRow>(
        `SELECT nunota, codparc, created_at
           FROM sankhya_orders
          WHERE pied_code = $1
          LIMIT 1`,
        [code]
    );
    return rows[0] ?? null;
}
