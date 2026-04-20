CREATE TABLE IF NOT EXISTS pied_partners (
    id           SERIAL PRIMARY KEY,
    cnpj         VARCHAR UNIQUE,
    cpf          VARCHAR,
    company_name VARCHAR,
    fantasy_name VARCHAR,
    city         VARCHAR,
    state        VARCHAR,
    cep          VARCHAR,
    contact_name  VARCHAR,
    contact_email VARCHAR,
    contact_phone VARCHAR,
    synced_at    TIMESTAMP,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pied_orders (
    id             SERIAL PRIMARY KEY,
    pied_id        VARCHAR UNIQUE,
    code           VARCHAR UNIQUE,
    name           VARCHAR,
    kind           VARCHAR,
    deal_status    VARCHAR,
    stock_status   VARCHAR,
    request_status VARCHAR,
    total_power    NUMERIC,
    original_value NUMERIC,
    final_value    NUMERIC,
    payment_type   VARCHAR,
    payment_status VARCHAR,
    partner_cnpj   VARCHAR REFERENCES pied_partners(cnpj),
    order_created  TIMESTAMP,
    budget_created TIMESTAMP,
    last_update    TIMESTAMP,
    synced_at      TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pied_order_products (
    id           SERIAL PRIMARY KEY,
    order_code   VARCHAR REFERENCES pied_orders(code),
    product_code VARCHAR,
    type         VARCHAR,
    name         VARCHAR,
    quantity     INTEGER,
    single_price NUMERIC,
    total_price  NUMERIC,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sankhya_partners (
    id         SERIAL PRIMARY KEY,
    codparc    INTEGER UNIQUE,
    cnpj       VARCHAR,
    name       VARCHAR,
    synced_at  TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sankhya_orders (
    id         SERIAL PRIMARY KEY,
    nunota     INTEGER UNIQUE,
    numnota    INTEGER,
    codparc    INTEGER,
    pied_code  VARCHAR REFERENCES pied_orders(code),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE integration_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS integration_log (
    id            SERIAL PRIMARY KEY,
    pied_code     VARCHAR REFERENCES pied_orders(code),
    nunota        INTEGER REFERENCES sankhya_orders(nunota),
    status        integration_status DEFAULT 'pending',
    webhook_event VARCHAR,
    attempts      INTEGER DEFAULT 0,
    error_message TEXT,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);