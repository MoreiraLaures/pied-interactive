import { Order } from '../types/order.types';
import { sankhyaClient } from '../class/sankhya.class';
import { SankhyaVendedor } from '../types/sankhya.types';
import { log } from '../db/logger';

function buildApelido(order: Order): string | null {
    const r = order.responsible;
    if (!r?.name || !r?.surname) return null;
    return `${r.name.trim()} ${r.surname.trim()}`.toUpperCase();
}

export async function resolveVendedor(order: Order): Promise<SankhyaVendedor | null> {
    const email = order.responsible?.email?.trim();
    if (email) {
        const byEmail = await sankhyaClient.findVendedorByEmail(email);
        if (byEmail) {
            await log({
                level: 'info', source: 'vendedor.resolver', piedCode: order.code,
                message: `Vendedor encontrado por email: CODVEND=${byEmail.codvend}`,
                context: { email, codvend: byEmail.codvend, criterio: 'email' },
            });
            return byEmail;
        }
    }

    const apelido = buildApelido(order);
    if (apelido) {
        const byApelido = await sankhyaClient.findVendedorByApelido(apelido);
        if (byApelido) {
            await log({
                level: 'info', source: 'vendedor.resolver', piedCode: order.code,
                message: `Vendedor encontrado por apelido: CODVEND=${byApelido.codvend}`,
                context: { apelido, codvend: byApelido.codvend, criterio: 'apelido' },
            });
            return byApelido;
        }
    }

    await log({
        level: 'warn', source: 'vendedor.resolver', piedCode: order.code,
        message: 'Vendedor não encontrado por email nem apelido — usando fallback',
        context: { email: email ?? null, apelido: apelido ?? null },
    });
    return null;
}
