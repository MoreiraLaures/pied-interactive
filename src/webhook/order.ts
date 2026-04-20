import {Router , Request , Response } from 'express';
import { WebhookEvent } from '../types/webhook.type';
import { piedClient } from '../class/pied.class';
import { Order } from '../types/order.types';
import { ingestOrder } from '../services/order.ingestor';

const router = Router()

router.post('/webhook', async (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ Mensagem: 'Não Autorizado' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.AUTH_WEBHOOK_PIED) {
        return res.status(403).json({ Mensagem: 'Token inválido' });
    }

    const body: WebhookEvent = req.body;
    const code = body.data.code;
    const orders: Order[] = await piedClient.getOrder(code);

    const ingestResults = [];
    for (const order of orders) {
        const result = await ingestOrder(order);
        ingestResults.push(result);
    }

    console.log('Pedido recebido:', code, 'ingested:', ingestResults);

    return res.status(200).json({ recebido: body, pedido: orders, ingest: ingestResults });
});

export default router
