import { sankhyaClient } from '../class/sankhya.class';
import { SankhyaPartner, SankhyaPartnerInput } from '../types/sankhya.types';
import { digitsOnly } from '../db/helpers';
import { findCachedByDoc, upsertCached } from '../db/repos/sankhyaPartner.repo';
import { log } from '../db/logger';

export type PartnerRole = 'integrador' | 'cliente';

export type PartnerSourceData = {
    name: string;
    razaoSocial?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    email?: string | null;
    telephone?: string | null;
    cep?: string | null;
    numend?: string | null;
    codcid: number;     // obrigatório — vem do enricher
};

export async function resolvePartner(
    source: PartnerSourceData,
    role: PartnerRole,
    piedCode: string
): Promise<SankhyaPartner> {
    const cgcCpf = digitsOnly(source.cnpj) ?? digitsOnly(source.cpf);
    if (!cgcCpf) {
        throw new Error(`[resolver] sem doc pra ${role} (${source.name})`);
    }

    // 1. cache local
    const cached = await findCachedByDoc(cgcCpf);
    if (cached) {
        return {
            codparc: cached.codparc,
            nomeparc: cached.name,
            tippessoa: cgcCpf.length === 14 ? 'J' : 'F',
            CGC_CPF: cached.cgcCpf,
            CLIENTE: 'S',
            ATIVO: 'S',
            AD_INTEGRADOR: cached.isIntegrador ? 'S' : null,
        };
    }

    // 2. lookup no Sankhya
    let partner = await sankhyaClient.findPartnerByDoc(cgcCpf);
    await log({
        level: 'info', source: 'partner.resolver', piedCode,
        message: partner ? 'Parceiro encontrado no Sankhya' : 'Parceiro não existe no Sankhya, vai criar',
        context: { cgcCpf, role, codparc: partner?.codparc ?? null },
    });

    // 3. se não existe, cria
    if (!partner) {
        const input: SankhyaPartnerInput = {
            NOMEPARC: (source.razaoSocial ?? source.name).slice(0, 60),
            TIPPESSOA: cgcCpf.length === 14 ? 'J' : 'F',
            CLIENTE: 'S',
            ATIVO: 'S',
            CODCID: String(source.codcid),
            CLASSIFICMS: 'C',
            CGC_CPF: cgcCpf,
            AD_INTEGRADOR: role === 'integrador' ? 'S' : 'N',
            RAZAOSOCIAL: source.razaoSocial ?? undefined,
            EMAIL: source.email ?? undefined,
            TELEFONE: digitsOnly(source.telephone) ?? undefined,
            CEP: digitsOnly(source.cep) ?? undefined,
            NUMEND: source.numend ?? undefined,
        };

        const created = await sankhyaClient.createPartner(input);
        partner = {
            codparc: Number(created.codparc),
            nomeparc: input.NOMEPARC,
            tippessoa: input.TIPPESSOA,
            CGC_CPF: cgcCpf,
            CLIENTE: 'S',
            ATIVO: 'S',
            AD_INTEGRADOR: input.AD_INTEGRADOR ?? null,
        };

        await log({
            level: 'info', source: 'partner.resolver', piedCode,
            message: `Parceiro criado no Sankhya (${role})`,
            context: { codparc: partner.codparc, cgcCpf, name: input.NOMEPARC, payload: input },
        });
    }

    // 4. grava cache
    await upsertCached({
        codparc: partner.codparc,
        cgcCpf,
        name: partner.nomeparc,
        isIntegrador: role === 'integrador' || partner.AD_INTEGRADOR === 'S',
    });

    return partner;
}
