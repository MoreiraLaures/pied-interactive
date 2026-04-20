import { pool } from '../db/pool';
import { log } from '../db/logger';
import { pickDoc } from '../db/helpers';
import { upsertPiedPartner } from '../db/repos/piedPartner.repo';
import { upsertPiedOrder, replaceOrderProducts } from '../db/repos/piedOrder.repo';
import { Order } from '../types/order.types';

export type IngestResult = {
    code: string;
    integradorDoc: string | null;
    clienteDoc: string | null;
    productsCount: number;
};

export async function ingestOrder(order: Order): Promise<IngestResult> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Integrador (company)
        const integradorDoc = await upsertPiedPartner(client, {
            cnpj:         order.company?.cnpj ?? null,
            cpf:          order.company?.cpf ?? null,
            companyName:  order.company?.companyName ?? null,
            fantasyName:  order.company?.fantasyName ?? null,
            city:         order.company?.address?.city ?? null,
            state:        order.company?.address?.state ?? null,
            cep:          order.company?.address?.CEP ?? null,
            contactName:  order.company?.mainContact
                            ? `${order.company.mainContact.name ?? ''} ${order.company.mainContact.surname ?? ''}`.trim() || null
                            : null,
            contactEmail: order.company?.mainContact?.email ?? null,
            contactPhone: order.company?.mainContact?.cellphone ?? null,
        });

        // 2. Cliente (invoice) — só se doc diferente do integrador
        const clienteDocCandidate = pickDoc(order.invoice?.cnpj, order.invoice?.cpf);
        const clienteDoc =
            clienteDocCandidate && clienteDocCandidate !== integradorDoc
                ? await upsertPiedPartner(client, {
                      cnpj:         order.invoice?.cnpj ?? null,
                      cpf:          order.invoice?.cpf ?? null,
                      companyName:  order.invoice?.razaoSocial ?? null,
                      fantasyName:  order.invoice?.nomeFantasia ?? null,
                      city:         order.invoice?.address?.city ?? null,
                      state:        order.invoice?.address?.state ?? null,
                      cep:          order.invoice?.address?.CEP ?? null,
                      contactName:  null,
                      contactEmail: order.invoice?.email ?? null,
                      contactPhone: order.invoice?.telephone ?? null,
                  })
                : clienteDocCandidate;

        // 3. Pedido
        await upsertPiedOrder(client, order, integradorDoc, clienteDoc);

        // 4. Produtos (replace-all)
        await replaceOrderProducts(client, order.code, order);

        await client.query('COMMIT');

        await log({
            level: 'info',
            source: 'ingestor',
            piedCode: order.code,
            message: 'Order ingested',
            context: {
                integradorDoc,
                clienteDoc,
                productsCount: order.products?.length ?? 0,
                dealStatus: order.dealStatus,
                requestStatus: order.requestStatus,
            },
        });

        return {
            code: order.code,
            integradorDoc,
            clienteDoc,
            productsCount: order.products?.length ?? 0,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        await log({
            level: 'error',
            source: 'ingestor',
            piedCode: order.code,
            message: 'Ingestion failed',
            context: { error: err instanceof Error ? err.message : String(err) },
        });
        throw err;
    } finally {
        client.release();
    }
}
