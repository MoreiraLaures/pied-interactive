import { Order } from '../types/order.types';
import { sankhyaClient } from '../class/sankhya.class';
import { enrichOrderAddresses } from '../services/address.enricher';
import { resolvePartner, PartnerSourceData } from '../services/partner.resolver';
import { log } from '../db/logger';
import { pool } from '../db/pool';
import { CODTIPOPER, CODEMP, CODTIPVENDA, CODNAT, CODCENCUS } from '../config';

// TODO: virar lógica dinâmica de detecção de vendedor
const VENDEDOR_PADRAO = 19;

// constantes do item Kit Personalizado
const KIT_CODPROD_HIGH = 18;   // totalPower >= 75
const KIT_CODPROD_LOW  = 21;   // totalPower < 75

const ITEM_DEFAULTS = {
    QTDNEG:       1,
    CODVOL:       'UN',
    CODLOCALORIG: 101,
    CODTRIB:      40,
    CSTIPI:       99,
} as const;

export function matchesPadrao(order: Order): boolean {
    return (
        order.requestStatus === 'Padrão' &&
        order.dealStatus    === 'Padrão' &&
        order.kind          === 'Kit Personalizado'
    );
}

function companyToSource(order: Order): PartnerSourceData {
    const c = order.company;
    if (!c?.address?.codcid) {
        throw new Error(`[padrao] company.codcid não resolvido pra ${order.code}`);
    }
    return {
        name:        c.companyName,
        razaoSocial: c.companyName,
        cnpj:        c.cnpj,
        cpf:         c.cpf,
        email:       c.mainContact?.email,
        telephone:   c.mainContact?.cellphone,
        cep:         c.address?.CEP,
        numend:      c.address?.number,
        codcid:      c.address.codcid,
    };
}

function invoiceToSource(order: Order): PartnerSourceData {
    const i = order.invoice;
    if (!i?.address?.codcid) {
        throw new Error(`[padrao] invoice.codcid não resolvido pra ${order.code}`);
    }
    return {
        name:        i.razaoSocial,
        razaoSocial: i.razaoSocial,
        cnpj:        i.cnpj ?? null,
        cpf:         i.cpf ?? null,
        email:       i.email,
        telephone:   i.telephone,
        cep:         i.address?.CEP,
        numend:      i.address?.number,
        codcid:      i.address.codcid,
    };
}

function formatDateBR(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function pickCodprod(totalPower: number): number {
    return totalPower >= 75 ? KIT_CODPROD_HIGH : KIT_CODPROD_LOW;
}

export async function runPadraoFlow(order: Order): Promise<void> {
    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Iniciando flow Padrão (Kit Personalizado)',
        context: { totalPower: order.totalPower, totalValue: order.totalValue, finalValue: order.finalValue },
    });

    // 1. enrich addresses (resolve codcid via Sankhya)
    await enrichOrderAddresses(order);

    // 2. resolver parceiros (find or create no Sankhya)
    const integradorSrc = companyToSource(order);
    const integrador    = await resolvePartner(integradorSrc, 'integrador', order.code);

    const clienteSrc = invoiceToSource(order);
    const sameDoc =
        (integradorSrc.cnpj || integradorSrc.cpf || '').replace(/\D/g, '')
        === (clienteSrc.cnpj || clienteSrc.cpf || '').replace(/\D/g, '');
    const cliente = sameDoc ? integrador : await resolvePartner(clienteSrc, 'cliente', order.code);

    // 3. createOrderHeader
    const headerInput = {
        CODPARC:          cliente.codparc,
        CODTIPOPER,
        DTNEG:            formatDateBR(new Date()),
        CODEMP,
        CODTIPVENDA,
        CODNAT,
        CODCENCUS,
        CODVEND:          VENDEDOR_PADRAO,
        AD_NROINTEGRACAO: order.code,
        AD_CODPARCINT:    integrador.codparc,
    };

    const header = await sankhyaClient.createOrderHeader(headerInput);
    const nunota = Number(header.nunota);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Header criado, NUNOTA=${nunota}`,
        context: { nunota, headerInput },
    });

    // 4. createOrderItem (item único representando o kit)
    const codprod = pickCodprod(order.totalPower);
    const valor   = order.finalValue;     // <— CONFIRMAR )

    const itemInput = {
        NUNOTA:   nunota,
        CODPROD:  codprod,
        VLRUNIT:  valor,
        VLRTOT:   valor,
        CONTROLE: order.code,
        ...ITEM_DEFAULTS,
    };

    await sankhyaClient.createOrderItem(itemInput);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Item criado: CODPROD=${codprod}, VLR=${valor}`,
        context: { itemInput, totalPower: order.totalPower },
    });

    // 5. confirmNF
    await sankhyaClient.confirmNF({ NUNOTA: nunota });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'NF confirmada — fluxo Padrão completo',
        context: { nunota, codparcCliente: cliente.codparc, codparcInteg: integrador.codparc },
    });

    // 6. rastreabilidade
    await pool.query(
        `INSERT INTO sankhya_orders (nunota, codparc, pied_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (nunota) DO NOTHING`,
        [nunota, cliente.codparc, order.code]
    );
}
