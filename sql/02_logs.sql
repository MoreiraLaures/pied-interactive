CREATE TABLE IF NOT EXISTS app_logs (
    id         SERIAL PRIMARY KEY,
    level      VARCHAR(10) NOT NULL,
    source     VARCHAR,
    pied_code  VARCHAR,
    message    TEXT NOT NULL,
    context    JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_logs_pied_code
    ON app_logs(pied_code);
CREATE INDEX IF NOT EXISTS idx_app_logs_level_created
    ON app_logs(level, created_at DESC);

CREATE TABLE IF NOT EXISTS sankhya_api_log (
    id            SERIAL PRIMARY KEY,
    pied_code     VARCHAR,
    endpoint      VARCHAR NOT NULL,
    method        VARCHAR(6) NOT NULL,
    request_body  JSONB,
    response_body JSONB,
    status_code   INTEGER,
    duration_ms   INTEGER,
    success       BOOLEAN,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sankhya_api_log_pied_code
    ON sankhya_api_log(pied_code);
CREATE INDEX IF NOT EXISTS idx_sankhya_api_log_endpoint_created
    ON sankhya_api_log(endpoint, created_at DESC);
