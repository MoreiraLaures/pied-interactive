/**
 * Cliente mínimo de email via Microsoft Graph (Application permission Mail.Send).
 * Usa OAuth2 client_credentials direto via fetch — sem SDK extra.
 *
 * Token é cacheado em memória até ~30s antes do vencimento.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < cachedToken.expiresAt - 30_000) {
        return cachedToken.token;
    }

    const tenant       = process.env.AZURE_TENANT_ID;
    const clientId     = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (!tenant || !clientId || !clientSecret) {
        throw new Error('[email] AZURE_TENANT_ID, AZURE_CLIENT_ID e AZURE_CLIENT_SECRET são obrigatórios');
    }

    const params = new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    'client_credentials',
        scope:         'https://graph.microsoft.com/.default',
    });

    const res = await fetch(
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    params.toString(),
        },
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`[email] Azure auth falhou: ${res.status} ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
        token:     data.access_token,
        expiresAt: now + data.expires_in * 1000,
    };
    return cachedToken.token;
}

export type SendMailOptions = {
    to:       string[];
    subject:  string;
    bodyHtml: string;
};

export async function sendMail(opts: SendMailOptions): Promise<void> {
    const from = process.env.AZURE_MAIL_FROM;
    if (!from) throw new Error('[email] AZURE_MAIL_FROM não configurado');
    if (!opts.to || opts.to.length === 0) {
        throw new Error('[email] sendMail chamado sem destinatários');
    }

    const token = await getToken();

    const payload = {
        message: {
            subject:      opts.subject,
            body:         { contentType: 'HTML', content: opts.bodyHtml },
            toRecipients: opts.to.map(addr => ({ emailAddress: { address: addr } })),
        },
        saveToSentItems: false,
    };

    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;
    const res = await fetch(url, {
        method:  'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`[email] sendMail falhou: ${res.status} ${text.slice(0, 500)}`);
    }
}

/** Lista de destinatários do .env (MAIL_RECIPIENTS, separados por vírgula). */
export function getRecipients(): string[] {
    const raw = process.env.MAIL_RECIPIENTS ?? '';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}
