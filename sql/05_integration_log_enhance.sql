-- ============================================================
-- 1.2 — integration_log enriquecida + integration_log_steps (Opção B)
--
-- Adiciona campos de execução em integration_log e cria a tabela
-- integration_log_steps pra rastrear CADA etapa do flow:
--   - identificar onde parou (pra email)
--   - guardar payload de cada step (pra retomar de onde parou)
--   - histórico de tentativas (debug)
-- ============================================================

-- 1) Enriquece integration_log com timing + flow identifier
ALTER TABLE integration_log
    ADD COLUMN IF NOT EXISTS flow_name   VARCHAR;

ALTER TABLE integration_log
    ADD COLUMN IF NOT EXISTS started_at  TIMESTAMP;

ALTER TABLE integration_log
    ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;

ALTER TABLE integration_log
    ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS integration_log_status_created_idx
    ON integration_log(status, created_at DESC);

CREATE INDEX IF NOT EXISTS integration_log_pied_code_idx
    ON integration_log(pied_code);

-- 2) Enum de status do step
DO $$ BEGIN
    CREATE TYPE integration_step_status AS ENUM ('started', 'completed', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3) Tabela de steps — uma linha por tentativa de cada etapa
CREATE TABLE IF NOT EXISTS integration_log_steps (
    id              SERIAL PRIMARY KEY,
    integration_id  INTEGER NOT NULL REFERENCES integration_log(id) ON DELETE CASCADE,
    step_name       VARCHAR NOT NULL,
    step_index      INTEGER NOT NULL,
    attempt_number  INTEGER NOT NULL DEFAULT 1,
    status          integration_step_status NOT NULL,
    started_at      TIMESTAMP DEFAULT NOW(),
    finished_at     TIMESTAMP,
    duration_ms     INTEGER,
    payload         JSONB,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),

    UNIQUE (integration_id, step_name, attempt_number)
);

CREATE INDEX IF NOT EXISTS integration_log_steps_integration_idx
    ON integration_log_steps(integration_id, step_index);

CREATE INDEX IF NOT EXISTS integration_log_steps_completed_idx
    ON integration_log_steps(integration_id, step_name)
    WHERE status = 'completed';

-- 4) Índice para localizar rapidamente partial por pied_code (estágio A → B)
CREATE INDEX IF NOT EXISTS integration_log_partial_idx
    ON integration_log(pied_code, status, created_at DESC)
    WHERE status = 'partial_complete';
