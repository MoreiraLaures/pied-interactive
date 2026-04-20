export function digitsOnly(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const d = String(raw).replace(/\D/g, '');
    return d.length === 0 ? null : d;
}

export function pickDoc(cnpj?: string | null, cpf?: string | null): string | null {
    return digitsOnly(cnpj) ?? digitsOnly(cpf);
}

export function parseDate(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}
