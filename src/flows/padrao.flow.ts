import { Order } from '../types/order.types';
import { sankhyaClient } from '../class/sankhya.class';
import { SankhyaPartner, SankhyaPartnerInput } from '../types/sankhya.types';
import { enrichOrderAddresses } from '../services/address.enricher';
import { resolvePartner, PartnerSourceData } from '../services/partner.resolver';
import { resolveVendedor } from '../services/vendedor.resolver';
import { StepRunner } from '../services/step.runner';
import { log } from '../db/logger';
import { pool } from '../db/pool';

const VENDEDOR_PADRAO = 19;

const KIT_CODPROD_HIGH = 18;
const KIT_CODPROD_LOW  = 21;

const PLANTA = 1;

const CABOS_CODPROD = new Set([44, 45, 46, 47]); // olhar pq pode mudar
const CABOS_METROS_POR_UNIDADE = 25;
const CODPROD_X50 = 106; // autobrocante, pode mudar
const MULTIPLICADOR_X50 = 50;

const HEADER_DEFAULTS = {
    CODTIPOPER:  1001, // Pedido de venda
    CODEMP:      1,  
    CODTIPVENDA: 36,  //definir lógica ( ANTECIPADO )
    CODNAT:      1010102, //natureza
    CODCENCUS:   102001, //Centro Resultado
} as const;

const ITEM_DEFAULTS = {
    QTDNEG:       1,
    CODVOL:       'UN',
    CODLOCALORIG: 101,
    CODTRIB:      40,
    CSTIPI:       99,
} as const;

const OPERACAO_DEFAULT = {
    IDEFX:   400,  // verificar
    SEQOPER: 1, // verificar 
} as const;

export function matchesPadrao(order: Order): boolean {
    return (
        order.requestStatus === 'teste' && // a definir status
        order.dealStatus    === 'teste' &&
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

function buildMaterial(p: { productCode: string; quantity: number }) {
    const codprod = Number(p.productCode);
    if (CABOS_CODPROD.has(codprod)) {
        return {
            CODPRODMP:  codprod,
            CONTROLEMP: '',
            QTDMOV:     p.quantity * CABOS_METROS_POR_UNIDADE,
            UNIDADE:    'MT',
        };
    }
    if (codprod === CODPROD_X50) {
        return {
            CODPRODMP:  codprod,
            CONTROLEMP: '',
            QTDMOV:     p.quantity * MULTIPLICADOR_X50,
            UNIDADE:    'UN',
        };
    }
    return {
        CODPRODMP:  codprod,
        CONTROLEMP: '',
        QTDMOV:     p.quantity,
        UNIDADE:    'UN',
    };
}

/**
 * Flow Padrão (Kit Personalizado) — agora dividido em 14 steps rastreados em
 * integration_log_steps. Cada step.run(name, index, fn):
 *   - se já completou nessa execução (resume) → retorna payload salvo, pula fn
 *   - senão executa fn, salva payload, marca completed/failed
 *
 * Erros propagam — o processor (caller) marca a integration_log como failed
 * e trata notificação por email.
 */
export async function runPadraoFlow(order: Order, integrationId: number): Promise<void> {
    const steps = new StepRunner(integrationId, order.code);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Iniciando flow Padrão (Kit Personalizado)',
        context: {
            integrationId,
            totalPower: order.totalPower,
            totalValue: order.totalValue,
            finalValue: order.finalValue,
        },
    });

    // ─── STEP 1: enriquece endereços (resolve codcid via /cities) ──────────
    const codcids = await steps.run('enrich_addresses', 1, async () => {
        await enrichOrderAddresses(order);
        return {
            company: order.company?.address?.codcid ?? null,
            invoice: order.invoice?.address?.codcid ?? null,
            freight: order.freight?.address?.codcid ?? null,
        };
    });
    // re-aplica payload na order (importante no resume — order foi re-fetchada e perdeu codcid)
    if (order.company?.address && codcids.company !== null) order.company.address.codcid = codcids.company;
    if (order.invoice?.address && codcids.invoice !== null) order.invoice.address.codcid = codcids.invoice;
    if (order.freight?.address && codcids.freight !== null) order.freight.address.codcid = codcids.freight;

    const integradorSrc = companyToSource(order);
    const clienteSrc    = invoiceToSource(order);
    const sameDoc =
        (integradorSrc.cnpj || integradorSrc.cpf || '').replace(/\D/g, '')
        === (clienteSrc.cnpj || clienteSrc.cpf || '').replace(/\D/g, '');

    // ─── STEP 2: resolve parceiro integrador (cache → Sankhya → cria) ──────
    const integrador = await steps.run<SankhyaPartner>('resolve_partner_integrador', 2, async () => {
        return await resolvePartner(integradorSrc, 'integrador', order.code);
    });

    // ─── STEP 3: resolve parceiro cliente (ou reusa integrador se mesmo doc) ──
    const cliente = await steps.run<SankhyaPartner>('resolve_partner_cliente', 3, async () => {
        if (sameDoc) return integrador;
        return await resolvePartner(clienteSrc, 'cliente', order.code);
    });

    // ─── STEP 4: garante CLIENTE=S, ATIVO=S nos parceiros ──────────────────
    await steps.run('update_partner_flags', 4, async () => {
        const ensureFlags: Partial<SankhyaPartnerInput> = { CLIENTE: 'S', ATIVO: 'S' };
        await sankhyaClient.updatePartner(integrador.codparc, ensureFlags);
        if (!sameDoc) {
            await sankhyaClient.updatePartner(cliente.codparc, ensureFlags);
        }
        return {
            updatedIntegrador: integrador.codparc,
            updatedCliente:    sameDoc ? null : cliente.codparc,
        };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Flags garantidas nos parceiros (CLIENTE=S, ATIVO=S)',
        context: {
            codparcCliente: cliente.codparc,
            codparcInteg:   integrador.codparc,
            mergedWithIntegrador: sameDoc,
        },
    });

    // ─── STEP 5: resolve vendedor (email → apelido → fallback) ─────────────
    const codvend = await steps.run<number>('resolve_vendedor', 5, async () => {
        const vendedor = await resolveVendedor(order);
        return vendedor?.codvend ?? VENDEDOR_PADRAO;
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `CODVEND resolvido: ${codvend}`,
        context: { codvend, fallback: codvend === VENDEDOR_PADRAO },
    });

    // ─── STEP 6: cria cabeçalho de pedido no Sankhya ───────────────────────
    const headerInput = {
        CODPARC:          cliente.codparc,
        ...HEADER_DEFAULTS,
        DTNEG:            formatDateBR(new Date()),
        CODVEND:          codvend,
        AD_NROINTEGRACAO: order.code,
        AD_CODPARCINT:    integrador.codparc,
    };

    const { nunota } = await steps.run<{ nunota: number }>('create_order_header', 6, async () => {
        const header = await sankhyaClient.createOrderHeader(headerInput);
        return { nunota: Number(header.nunota) };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Header criado, NUNOTA=${nunota}`,
        context: { nunota, headerInput },
    });

    // ─── STEP 7: cria item do pedido ───────────────────────────────────────
    const codprod = pickCodprod(order.totalPower);
    const valor   = order.finalValue;

    const itemInput = {
        NUNOTA:   nunota,
        CODPROD:  codprod,
        VLRUNIT:  valor,
        VLRTOT:   valor,
        CONTROLE: order.code,
        ...ITEM_DEFAULTS,
    };

    await steps.run('create_order_item', 7, async () => {
        await sankhyaClient.createOrderItem(itemInput);
        return { nunota, codprod, valor };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Item criado: CODPROD=${codprod}, VLR=${valor}`,
        context: { itemInput, totalPower: order.totalPower },
    });

    // ─── STEP 8: confirma a NF ─────────────────────────────────────────────
    await steps.run('confirm_nf', 8, async () => {
        await sankhyaClient.confirmNF({ NUNOTA: nunota });
        return { nunota };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'NF confirmada',
        context: { nunota, codparcCliente: cliente.codparc, codparcInteg: integrador.codparc },
    });

    // ─── STEP 9: cria OP (LancamentoOrdemProducaoSP.lancarOPPeloItemDoPedido) ──
    const { nulop } = await steps.run<{ nulop: number }>('start_production', 9, async () => {
        const producao = await sankhyaClient.startProduction({
            planta: PLANTA,
            itens:  [{ NUNOTA: nunota }],
        });
        return { nulop: Number(producao.nulop) };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Produção criada, NULOP=${nulop}`,
        context: { nulop, planta: PLANTA, nunota },
    });

    // ─── STEP 10: confirma OP → IDIPROC ────────────────────────────────────
    const confirmProd = await steps.run<{ ordens: number[]; ordensIniciadas: unknown }>(
        'confirm_production',
        10,
        async () => {
            const r = await sankhyaClient.confirmProduction({ nulop });
            return { ordens: r.ordens, ordensIniciadas: r.ordensIniciadas };
        },
    );
    const idiproc = Number(confirmProd.ordens[0]);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Produção confirmada, IDIPROC=${idiproc}`,
        context: { nulop, idiproc, ordens: confirmProd.ordens, ordensIniciadas: confirmProd.ordensIniciadas },
    });

    // ─── STEP 11: lista atividades, pega primeira IDIATV ───────────────────
    const { idiatv, atividade } = await steps.run<{ idiatv: number; atividade: unknown }>(
        'list_activities',
        11,
        async () => {
            const atividadesResp = await sankhyaClient.getProductionAtividades(idiproc);
            const primeira = atividadesResp.atividades[0];
            if (!primeira) {
                throw new Error(`[padrao] nenhuma atividade retornada para IDIPROC=${idiproc}`);
            }
            return { idiatv: Number(primeira.IDIATV), atividade: primeira };
        },
    );

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Atividade resolvida, IDIATV=${idiatv}`,
        context: { idiproc, idiatv, atividade },
    });

    // ─── STEP 12: inicia atividade ─────────────────────────────────────────
    await steps.run('start_activity', 12, async () => {
        await sankhyaClient.startActivity({ IDIATV: idiatv });
        return { idiatv };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Atividade iniciada, IDIATV=${idiatv}`,
        context: { idiproc, idiatv },
    });

    // ─── STEP 13: movimenta matérias-primas ────────────────────────────────
    const materiais = order.products.map(buildMaterial);

    await steps.run('add_raw_materials', 13, async () => {
        await sankhyaClient.addRawMaterials({
            idiproc,
            idiatv,
            operacao:  { ...OPERACAO_DEFAULT },
            materiais,
        });
        return { count: materiais.length, idiproc, idiatv };
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Matérias-primas movimentadas — fluxo Padrão completo',
        context: { idiproc, idiatv, materiais },
    });

    // ─── STEP 14: persiste linha em sankhya_orders (idempotência) ─────────
    await steps.run('persist_sankhya_order', 14, async () => {
        await pool.query(
            `INSERT INTO sankhya_orders (nunota, codparc, pied_code)
             VALUES ($1, $2, $3)
             ON CONFLICT (pied_code) DO NOTHING`,
            [nunota, cliente.codparc, order.code],
        );
        return { nunota, codparc: cliente.codparc };
    });
}
