import { Order } from '../types/order.types';
import { matchesPadrao, runPadraoFlow } from '../flows/padrao.flow';
import { log } from '../db/logger';
import { pool } from '../db/pool';
import { tryLockPiedCode } from '../db/locks';

type Flow = {
    name: string;
    matches: (order: Order) => boolean;
    run:     (order: Order) => Promise<void>;
};

const flows: Flow[] = [
    { name: 'padrao', matches: matchesPadrao, run: runPadraoFlow },
    // adicionar novos flows aqui no futuro
];

export async function processOrder(order: Order): Promise<void> {
    const flow = flows.find(f => f.matches(order));
    if (!flow) return;  // nenhum flow casou, nada a fazer

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

        // 3. Re-check dentro do lock — janela entre o pré-check e o lock pode ter inserido
        const recheck = await checkAlreadyCompleted(order.code, client);
        if (recheck) {
            await log({
                level: 'info', source: 'processor', piedCode: order.code,
                message: 'Pedido completado por outro processo durante o lock — skip',
                context: { existing: recheck, flow: flow.name },
            });
            return;
        }

        // 4. Roda o flow
        try {
            await flow.run(order);
        } catch (err) {
            await log({
                level: 'error', source: 'processor', piedCode: order.code,
                message: `Flow '${flow.name}' falhou`,
                context: {
                    error: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                },
            });
            // não relança — falha de flow individual não derruba o webhook
        }
    } finally {
        client.release();   // libera o advisory lock automaticamente
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

// import-only type pra não causar circular
import type { PoolClient } from 'pg';
