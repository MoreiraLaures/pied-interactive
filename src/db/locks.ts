import { PoolClient } from 'pg';

function hashCode(s: string): bigint {
    let h = 5381n;
    for (const c of s) {
        h = ((h << 5n) + h) ^ BigInt(c.charCodeAt(0));
    }
    return BigInt.asIntN(63, h);
}


export async function tryLockPiedCode(client: PoolClient, code: string): Promise<boolean> {
    const key = hashCode(code);
    const { rows } = await client.query<{ ok: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS ok',
        [key.toString()]
    );
    return rows[0]?.ok === true;
}
