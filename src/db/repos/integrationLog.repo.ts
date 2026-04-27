import { pool } from '../pool';

export type IntegrationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type IntegrationLogRow = {
    id:            number;
    pied_code:     string;
    nunota:        number | null;
    status:        IntegrationStatus;
    flow_name:     string | null;
    attempts:      number;
    error_message: string | null;
    started_at:    string | null;
    finished_at:   string | null;
    duration_ms:   number | null;
    webhook_event: string | null;
    created_at:    string;
    updated_at:    string;
};

/** Cria registro de execução em estado 'pending'. Retorna o id da linha. */
export async function createPending(
    piedCode: string,
    flowName: string,
    webhookEvent?: string
): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO integration_log (pied_code, flow_name, webhook_event, status, attempts)
         VALUES ($1, $2, $3, 'pending', 1)
         RETURNING id`,
        [piedCode, flowName, webhookEvent ?? null]
    );
    return rows[0].id;
}

/** Marca início real da execução (depois do lock + idempotência). */
export async function markProcessing(id: number): Promise<void> {
    await pool.query(
        `UPDATE integration_log
            SET status     = 'processing',
                started_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [id]
    );
}

/** Marca conclusão bem-sucedida. Tenta linkar o nunota gerado pelo flow. */
export async function markCompleted(id: number, piedCode: string): Promise<void> {
    await pool.query(
        `UPDATE integration_log
            SET status      = 'completed',
                finished_at = NOW(),
                duration_ms = (EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000)::INTEGER,
                nunota      = (SELECT nunota FROM sankhya_orders WHERE pied_code = $2 LIMIT 1),
                updated_at  = NOW()
          WHERE id = $1`,
        [id, piedCode]
    );
}

/** Marca falha. errorMessage é truncado pra evitar estourar a coluna com stack gigante. */
export async function markFailed(id: number, errorMessage: string): Promise<void> {
    await pool.query(
        `UPDATE integration_log
            SET status        = 'failed',
                finished_at   = NOW(),
                duration_ms   = (EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000)::INTEGER,
                error_message = $2,
                updated_at    = NOW()
          WHERE id = $1`,
        [id, errorMessage.slice(0, 4000)]
    );
}

/** Histórico de execuções de um pedido. */
export async function findByCode(piedCode: string, limit = 20): Promise<IntegrationLogRow[]> {
    const { rows } = await pool.query<IntegrationLogRow>(
        `SELECT * FROM integration_log
          WHERE pied_code = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [piedCode, limit]
    );
    return rows;
}

/** Última execução com status='failed' — usado pelo /resume. */
export async function findLatestFailedByCode(piedCode: string): Promise<IntegrationLogRow | null> {
    const { rows } = await pool.query<IntegrationLogRow>(
        `SELECT * FROM integration_log
          WHERE pied_code = $1 AND status = 'failed'
          ORDER BY created_at DESC
          LIMIT 1`,
        [piedCode]
    );
    return rows[0] ?? null;
}

/** Última execução de qualquer status — usado por dashboards/diagnóstico. */
export async function findLatestByCode(piedCode: string): Promise<IntegrationLogRow | null> {
    const { rows } = await pool.query<IntegrationLogRow>(
        `SELECT * FROM integration_log
          WHERE pied_code = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [piedCode]
    );
    return rows[0] ?? null;
}

export async function findById(id: number): Promise<IntegrationLogRow | null> {
    const { rows } = await pool.query<IntegrationLogRow>(
        `SELECT * FROM integration_log WHERE id = $1`,
        [id]
    );
    return rows[0] ?? null;
}

/** Detector de "stuck": execuções em 'processing' há mais de N minutos. Usado pelo cron. */
export async function findStuck(olderThanMinutes: number): Promise<IntegrationLogRow[]> {
    const { rows } = await pool.query<IntegrationLogRow>(
        `SELECT * FROM integration_log
          WHERE status = 'processing'
            AND started_at < NOW() - ($1::TEXT || ' minutes')::INTERVAL
          ORDER BY started_at ASC`,
        [olderThanMinutes]
    );
    return rows;
}