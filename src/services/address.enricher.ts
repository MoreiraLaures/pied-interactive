import { Order } from '../types/order.types';
import { Address } from '../types/shared.types';
import { sankhyaClient } from '../class/sankhya.class';
import { log } from '../db/logger';

const cityCache = new Map<string, number>();
const cacheKey = (state: string, normalizedName: string) =>
    `${state.toUpperCase()}|${normalizedName}`;

function normalizeCityName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

async function resolveAddressCodcid(addr: Address | undefined, piedCode: string): Promise<void> {
    if (!addr || !addr.city || !addr.state) return;
    if (addr.codcid != null) return;

    const normalizedName = normalizeCityName(addr.city);
    const key = cacheKey(addr.state, normalizedName);

    const cached = cityCache.get(key);
    if (cached != null) {
        addr.codcid = cached;
        return;
    }

    const start = Date.now();
    try {
        const city = await sankhyaClient.findOrCreateCity(addr.state, normalizedName);
        const durationMs = Date.now() - start;

        addr.codcid = city.codcid;
        cityCache.set(key, city.codcid);

        await log({
            level: 'info', source: 'address.enricher', piedCode,
            message: 'Cidade resolvida (find-or-create)',
            context: {
                rawCity: addr.city,
                normalizedName,
                state: addr.state,
                codcid: city.codcid,
                durationMs,
            },
        });
    } catch (err) {
        await log({
            level: 'error', source: 'address.enricher', piedCode,
            message: 'Erro ao resolver/criar cidade',
            context: {
                rawCity: addr.city,
                normalizedName,
                state: addr.state,
                durationMs: Date.now() - start,
                error: err instanceof Error ? err.message : String(err),
            },
        });
        throw err;
    }
}

export async function enrichOrderAddresses(order: Order): Promise<void> {
    await resolveAddressCodcid(order.company?.address, order.code);
    await resolveAddressCodcid(order.invoice?.address, order.code);
    await resolveAddressCodcid(order.freight?.address, order.code);
}
