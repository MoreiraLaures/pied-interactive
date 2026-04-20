import { pool } from './pool';



export type LogLevel = 'info' | 'warn' | 'error';

type LogArgs = {
    level: LogLevel;
    source: string;
    message: string;
    piedCode?: string;
    context?: unknown;
};

export async function log(args: LogArgs): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO app_logs (level, source, pied_code, message, context)
             VALUES ($1, $2, $3, $4, $5)`,
            [args.level, args.source, args.piedCode ?? null, args.message, args.context ? JSON.stringify(args.context) : null]
        );
    } catch (err) {
        // se o próprio logger falha, só stdout — não relança
        console.error('[LOGGER] failed to write log', err, args);
    }
}
