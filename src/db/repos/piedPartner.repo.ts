import { PoolClient } from 'pg';
import { digitsOnly } from '../helpers';

export type PiedPartnerInput = {
    cnpj: string | null;
    cpf: string | null;
    companyName: string | null;
    fantasyName: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
};

export async function upsertPiedPartner(
    client: PoolClient,
    input: PiedPartnerInput
): Promise<string | null> {
    const cgcCpf = digitsOnly(input.cnpj) ?? digitsOnly(input.cpf);
    if (!cgcCpf) return null;

    await client.query(
        `INSERT INTO pied_partners (
            cgc_cpf, cnpj, cpf, company_name, fantasy_name,
            city, state, cep, contact_name, contact_email, contact_phone, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
         ON CONFLICT (cgc_cpf) DO UPDATE SET
            cnpj          = EXCLUDED.cnpj,
            cpf           = EXCLUDED.cpf,
            company_name  = EXCLUDED.company_name,
            fantasy_name  = EXCLUDED.fantasy_name,
            city          = EXCLUDED.city,
            state         = EXCLUDED.state,
            cep           = EXCLUDED.cep,
            contact_name  = EXCLUDED.contact_name,
            contact_email = EXCLUDED.contact_email,
            contact_phone = EXCLUDED.contact_phone,
            synced_at     = NOW()`,
        [
            cgcCpf,
            input.cnpj,
            input.cpf,
            input.companyName,
            input.fantasyName,
            input.city,
            input.state,
            input.cep,
            input.contactName,
            input.contactEmail,
            input.contactPhone,
        ]
    );

    return cgcCpf;
}
