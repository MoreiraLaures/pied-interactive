import { Router, Request, Response } from 'express';
import { resumeOrder } from '../services/order.resumer';

const router = Router();

/**
 * POST /reprocess/:code/resume
 *
 * Retoma uma execução failed do flow padrão (ou outro flow registrado).
 * Re-fetcha o pedido do Pied e roda do passo onde parou.
 *
 * Auth: mesmo Bearer do webhook (AUTH_WEBHOOK_PIED) — pra MVP. Pode segregar
 * em token próprio depois se necessário.
 *
 * Códigos de retorno:
 *   200 — Resume completou com sucesso (status='completed')
 *   404 — Não há failure pra esse code, ou flow não encontrado, ou Pied não retornou order
 *   409 — Outro processo está rodando esse code agora
 *   500 — Resume tentou mas falhou de novo (resposta tem o erro novo)
 */
router.post('/reprocess/:code/resume', async (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== process.env.AUTH_WEBHOOK_PIED) {
        return res.status(403).json({ error: 'Token inválido' });
    }

    const { code } = req.params;
    if (!code) {
        return res.status(400).json({ error: 'code é obrigatório na URL' });
    }

    try {
        const result = await resumeOrder(code);

        const httpStatus =
            result.status === 'completed'  ? 200 :
            result.status === 'no_failure' ? 404 :
            result.status === 'no_flow'    ? 404 :
            result.status === 'no_order'   ? 404 :
            result.status === 'locked'     ? 409 :
            result.status === 'failed'     ? 500 :
                                              500;

        return res.status(httpStatus).json(result);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[POST /reprocess/:code/resume]', msg);
        return res.status(500).json({ error: msg });
    }
});

export default router;
