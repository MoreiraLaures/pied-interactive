import { Order } from '../types/order.types';
import { sankhyaClient } from '../class/sankhya.class';
import { SankhyaPartnerInput } from '../types/sankhya.types';
import { enrichOrderAddresses } from '../services/address.enricher';
import { resolvePartner, PartnerSourceData } from '../services/partner.resolver';
import { resolveVendedor } from '../services/vendedor.resolver';
import { log } from '../db/logger';
import { pool } from '../db/pool';

const VENDEDOR_PADRAO = 19;

const KIT_CODPROD_HIGH = 18;
const KIT_CODPROD_LOW  = 21;

const PLANTA = 1;

const CABOS_CODPROD = new Set([44, 45, 46, 47]);
const CABOS_METROS_POR_UNIDADE = 25;
const CODPROD_X50 = 106;
const MULTIPLICADOR_X50 = 50;

const HEADER_DEFAULTS = {
    CODTIPOPER:  1001,
    CODEMP:      1,
    CODTIPVENDA: 19,
    CODNAT:      1010102,
    CODCENCUS:   102001,
} as const;

const ITEM_DEFAULTS = {
    QTDNEG:       1,
    CODVOL:       'UN',
    CODLOCALORIG: 101,
    CODTRIB:      40,
    CSTIPI:       99,
} as const;

const OPERACAO_DEFAULT = {
    IDEFX:   400,
    SEQOPER: 1,
} as const;

export function matchesPadrao(order: Order): boolean {
    return (
        order.requestStatus === 'teste' &&
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

export async function runPadraoFlow(order: Order): Promise<void> {
    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Iniciando flow Padrão (Kit Personalizado)',
        context: { totalPower: order.totalPower, totalValue: order.totalValue, finalValue: order.finalValue },
    });

    await enrichOrderAddresses(order);

    const integradorSrc = companyToSource(order);
    const integrador    = await resolvePartner(integradorSrc, 'integrador', order.code);

    const clienteSrc = invoiceToSource(order);
    const sameDoc =
        (integradorSrc.cnpj || integradorSrc.cpf || '').replace(/\D/g, '')
        === (clienteSrc.cnpj || clienteSrc.cpf || '').replace(/\D/g, '');
    const cliente = sameDoc ? integrador : await resolvePartner(clienteSrc, 'cliente', order.code);

    const ensureFlags: Partial<SankhyaPartnerInput> = { CLIENTE: 'S', ATIVO: 'S' };
    await sankhyaClient.updatePartner(integrador.codparc, ensureFlags);
    if (!sameDoc) {
        await sankhyaClient.updatePartner(cliente.codparc, ensureFlags);
    }

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Flags garantidas nos parceiros (CLIENTE=S, ATIVO=S)',
        context: {
            codparcCliente: cliente.codparc,
            codparcInteg:   integrador.codparc,
            mergedWithIntegrador: sameDoc,
        },
    });

    const vendedor = await resolveVendedor(order);
    const codvend  = vendedor?.codvend ?? VENDEDOR_PADRAO;

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `CODVEND resolvido: ${codvend}`,
        context: { codvend, matched: vendedor !== null, fallback: vendedor === null },
    });

    const headerInput = {
        CODPARC:          cliente.codparc,
        ...HEADER_DEFAULTS,
        DTNEG:            formatDateBR(new Date()),
        CODVEND:          codvend,
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

    await sankhyaClient.createOrderItem(itemInput);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Item criado: CODPROD=${codprod}, VLR=${valor}`,
        context: { itemInput, totalPower: order.totalPower },
    });

    await sankhyaClient.confirmNF({ NUNOTA: nunota });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'NF confirmada',
        context: { nunota, codparcCliente: cliente.codparc, codparcInteg: integrador.codparc },
    });

    const producao = await sankhyaClient.startProduction({
        planta: PLANTA,
        itens:  [{ NUNOTA: nunota }],
    });
    const nulop = Number(producao.nulop);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Produção criada, NULOP=${nulop}`,
        context: { nulop, planta: PLANTA, nunota },
    });

    const confirmProd = await sankhyaClient.confirmProduction({ nulop });
    const idiproc = Number(confirmProd.ordens[0]);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Produção confirmada, IDIPROC=${idiproc}`,
        context: { nulop, idiproc, ordens: confirmProd.ordens, ordensIniciadas: confirmProd.ordensIniciadas },
    });

    const atividadesResp = await sankhyaClient.getProductionAtividades(idiproc);
    const primeiraAtividade = atividadesResp.atividades[0];
    if (!primeiraAtividade) {
        throw new Error(`[padrao] nenhuma atividade retornada para IDIPROC=${idiproc}`);
    }
    const idiatv = Number(primeiraAtividade.IDIATV);

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Atividade resolvida, IDIATV=${idiatv}`,
        context: { idiproc, idiatv, atividade: primeiraAtividade },
    });

    await sankhyaClient.startActivity({ IDIATV: idiatv });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: `Atividade iniciada, IDIATV=${idiatv}`,
        context: { idiproc, idiatv },
    });

    const materiais = order.products.map(buildMaterial);

    await sankhyaClient.addRawMaterials({
        idiproc,
        idiatv,
        operacao:  { ...OPERACAO_DEFAULT },
        materiais,
    });

    await log({
        level: 'info', source: 'flow.padrao', piedCode: order.code,
        message: 'Matérias-primas movimentadas — fluxo Padrão completo',
        context: { idiproc, idiatv, materiais },
    });

    await pool.query(
        `INSERT INTO sankhya_orders (nunota, codparc, pied_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (nunota) DO NOTHING`,
        [nunota, cliente.codparc, order.code]
    );
}
