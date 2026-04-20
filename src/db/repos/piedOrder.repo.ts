import { PoolClient } from 'pg';
import { Order } from '../../types/order.types';
import { parseDate } from '../helpers';

export async function upsertPiedOrder(
    client: PoolClient,
    order: Order,
    integradorDoc: string | null,
    clienteDoc: string | null
): Promise<void> {
    await client.query(
        `INSERT INTO pied_orders (
            pied_id, code, name, kind,
            deal_status, stock_status, request_status,
            total_power, original_value, final_value,
            payment_type, payment_status,
            integrador_doc, cliente_doc,
            order_created, budget_created, last_update, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
         ON CONFLICT (code) DO UPDATE SET
            pied_id        = EXCLUDED.pied_id,
            name           = EXCLUDED.name,
            kind           = EXCLUDED.kind,
            deal_status    = EXCLUDED.deal_status,
            stock_status   = EXCLUDED.stock_status,
            request_status = EXCLUDED.request_status,
            total_power    = EXCLUDED.total_power,
            original_value = EXCLUDED.original_value,
            final_value    = EXCLUDED.final_value,
            payment_type   = EXCLUDED.payment_type,
            payment_status = EXCLUDED.payment_status,
            integrador_doc = EXCLUDED.integrador_doc,
            cliente_doc    = EXCLUDED.cliente_doc,
            order_created  = EXCLUDED.order_created,
            budget_created = EXCLUDED.budget_created,
            last_update    = EXCLUDED.last_update,
            synced_at      = NOW()`,
        [
            order.id,
            order.code,
            order.name,
            order.kind,
            order.dealStatus,
            order.stockStatus,
            order.requestStatus,
            order.totalPower,
            order.originalValue,
            order.finalValue,
            order.payment?.type ?? null,
            order.payment?.status ?? null,
            integradorDoc,
            clienteDoc,
            parseDate(order.orderCreated),
            parseDate(order.budgetCreated),
            parseDate(order.apiSentUpdated),
        ]
    );
}

export async function replaceOrderProducts(
    client: PoolClient,
    orderCode: string,
    order: Order
): Promise<void> {
    await client.query(`DELETE FROM pied_order_products WHERE order_code = $1`, [orderCode]);

    for (const p of order.products ?? []) {
        await client.query(
            `INSERT INTO pied_order_products (
                order_code, product_code, type, name,
                quantity, single_price, total_price
             ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [orderCode, p.productCode, p.type, p.name, p.quantity, p.singlePrice, p.totalPrice]
        );
    }
}
