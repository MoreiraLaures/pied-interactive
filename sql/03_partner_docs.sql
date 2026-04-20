-- pied_partners: coluna document-agnostic (digits-only)
ALTER TABLE pied_partners
    ADD COLUMN IF NOT EXISTS cgc_cpf VARCHAR;
CREATE UNIQUE INDEX IF NOT EXISTS pied_partners_cgc_cpf_uidx
    ON pied_partners(cgc_cpf) WHERE cgc_cpf IS NOT NULL;

-- pied_orders: doc do integrador e do cliente (separados)
ALTER TABLE pied_orders
    ADD COLUMN IF NOT EXISTS integrador_doc VARCHAR;
ALTER TABLE pied_orders
    ADD COLUMN IF NOT EXISTS cliente_doc VARCHAR;

-- sankhya_partners: mesma lógica + flag de integrador
ALTER TABLE sankhya_partners
    ADD COLUMN IF NOT EXISTS cgc_cpf VARCHAR;
CREATE UNIQUE INDEX IF NOT EXISTS sankhya_partners_cgc_cpf_uidx
    ON sankhya_partners(cgc_cpf) WHERE cgc_cpf IS NOT NULL;
ALTER TABLE sankhya_partners
    ADD COLUMN IF NOT EXISTS is_integrador BOOLEAN DEFAULT FALSE;
