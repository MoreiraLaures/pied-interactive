import { Order } from '../types/order.types';
import { sankhyaClient } from '../class/sankhya.class';
import { SankhyaVendedor } from '../types/sankhya.types';
import { log } from '../db/logger';

function buildApelido(order: Order): string {
    const r = order.responsible;
    if (!r?.name || !r?.surname) {
        throw new Error(`[vendedor.resolver] responsible incompleto pra ${order.code}`);
    }
    return `${r.name.trim()} ${r.surname.trim()}`.toUpperCase();
}

export async function resolveVendedor(order: Order): Promise<SankhyaVendedor> {
    const apelido = buildApelido(order);

    await log({
        level: 'info', source: 'vendedor.resolver', piedCode: order.code,
        message: `Buscando vendedor por apelido "${apelido}"`,
        context: { apelido },
    });

    const vendedor = await sankhyaClient.findVendedorByApelido(apelido);
    if (!vendedor) {
        throw new Error(`[vendedor.resolver] vendedor "${apelido}" não encontrado no Sankhya (cadastrar manualmente) — pedido ${order.code}`);
    }

    await log({
        level: 'info', source: 'vendedor.resolver', piedCode: order.code,
        message: `Vendedor encontrado: CODVEND=${vendedor.codvend}`,
        context: { apelido, codvend: vendedor.codvend, ativo: vendedor.ativo },
    });

    return vendedor;
}
