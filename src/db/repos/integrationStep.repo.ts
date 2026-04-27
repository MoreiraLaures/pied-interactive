import { pool } from '../pool';

export type StepStatus = 'started' | 'completed' | 'failed' | 'skipped';

export type IntegrationStepRow = {
    id:             number;
    integration_id: number;
    step_name:      string;
    step_index:     number;
    attempt_number: number;
    status:         StepStatus;
    started_at:     string | null;
    finished_at:    string | null;
    duration_ms:    number | null;
    payload:        unknown;
    error_message:  string | null;
    created_at:     string;
};

/**
 * Cria registro de step em status='started'. Calcula attempt_number automaticamente
 * (max existente pra esse step nessa execução + 1).
 *
 * Implementado em 2 queries (em vez de uma INSERT com subquery) pra evitar erro de
 * inferência de tipo do PG quando o mesmo parâmetro é usado em contextos diferentes
 * (INSERT VALUES vs WHERE). É seguro porque o advisory lock em processOrder garante
 * que não há execução concorrente do mesmo pied_code.
 */
export async function markStarted(
    integrationId: number,
    stepName: string,
    stepIndex: number
): Promise<{ stepId: number; attemptNumber: number }> {
    const { rows: maxRows } = await pool.query<{ next: number }>(
        `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next
           FROM integration_log_steps
          WHERE integration_id = $1 AND step_name = $2`,
        [integrationId, stepName]
    );
    const attemptNumber = maxRows[0].next;

    const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO integration_log_steps
                (integration_id, step_name, step_index, attempt_number, status, started_at)
         VALUES ($1, $2, $3, $4, 'started', NOW())
         RETURNING id`,
        [integrationId, stepName, stepIndex, attemptNumber]
    );
    return { stepId: rows[0].id, attemptNumber };
}

/** Marca step como completo, salvando o payload de output (usado pelo resume). */
export async function markCompleted(stepId: number, payload?: unknown): Promise<void> {
    await pool.query(
        `UPDATE integration_log_steps
            SET status      = 'completed',
                finished_at = NOW(),
                duration_ms = (EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000)::INTEGER,
                payload     = $2::jsonb
          WHERE id = $1`,
        [stepId, payload === undefined ? null : JSON.stringify(payload)]
    );
}

export async function markFailed(stepId: number, errorMessage: string): Promise<void> {
    await pool.query(
        `UPDATE integration_log_steps
            SET status        = 'failed',
                finished_at   = NOW(),
                duration_ms   = (EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000)::INTEGER,
                error_message = $2
          WHERE id = $1`,
        [stepId, errorMessage.slice(0, 4000)]
    );
}

/**
 * Procura o último completed pra esse step nessa execução.
 * Se existe, o StepRunner pula a execução e usa o payload (resume).
 */
export async function findCompletedStep(
    integrationId: number,
    stepName: string
): Promise<IntegrationStepRow | null> {
    const { rows } = await pool.query<IntegrationStepRow>(
        `SELECT * FROM integration_log_steps
          WHERE integration_id = $1 AND step_name = $2 AND status = 'completed'
          ORDER BY attempt_number DESC
          LIMIT 1`,
        [integrationId, stepName]
    );
    return rows[0] ?? null;
}

/** Último step com status='failed' nessa execução — usado pelo email + resume. */
export async function findFailedStep(integrationId: number): Promise<IntegrationStepRow | null> {
    const { rows } = await pool.query<IntegrationStepRow>(
        `SELECT * FROM integration_log_steps
          WHERE integration_id = $1 AND status = 'failed'
          ORDER BY step_index DESC, attempt_number DESC
          LIMIT 1`,
        [integrationId]
    );
    return rows[0] ?? null;
}

/** Todos os steps dessa execução em ordem — pra dashboard, email body, debug. */
export async function findAllByIntegration(integrationId: number): Promise<IntegrationStepRow[]> {
    const { rows } = await pool.query<IntegrationStepRow>(
        `SELECT * FROM integration_log_steps
          WHERE integration_id = $1
          ORDER BY step_index ASC, attempt_number ASC`,
        [integrationId]
    );
    return rows;
}