import { PoolClient } from 'pg';
import { pool } from '../pool';

export type SankhyaPartnerCacheRow = {
    codparc: number;
    cgcCpf: string;
    name: string;
    isIntegrador: boolean;
};

export async function findCachedByDoc(cgcCpf: string): Promise<SankhyaPartnerCacheRow | null> {
    const { rows } = await pool.query<{ codparc: number; cgc_cpf: string; name: string; is_integrador: boolean }>(
        `SELECT codparc, cgc_cpf, name, is_integrador
           FROM sankhya_partners
          WHERE cgc_cpf = $1
          LIMIT 1`,
        [cgcCpf]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return { codparc: r.codparc, cgcCpf: r.cgc_cpf, name: r.name, isIntegrador: r.is_integrador };
}

export async function upsertCached(
    row: SankhyaPartnerCacheRow,
    client?: PoolClient
): Promise<void> {
    const runner = client ?? pool;
    await runner.query(
        `INSERT INTO sankhya_partners (codparc, cgc_cpf, name, is_integrador, synced_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (codparc) DO UPDATE SET
            cgc_cpf       = EXCLUDED.cgc_cpf,
            name          = EXCLUDED.name,
            is_integrador = sankhya_partners.is_integrador OR EXCLUDED.is_integrador,
            synced_at     = NOW()`,
        [row.codparc, row.cgcCpf, row.name, row.isIntegrador]
    );
}
