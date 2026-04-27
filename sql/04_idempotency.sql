-- Idempotência: garante 1 sankhya_order por pied_code
-- (UNIQUE INDEX serve igualzinho a CONSTRAINT pro ON CONFLICT, e suporta IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS sankhya_orders_pied_code_uidx
    ON sankhya_orders(pied_code);
