import {Router , Request , Response } from 'express';


import { WebhookEvent } from '../types/webhook.type';
import { piedClient } from '../class/pied.class';
import { Order } from '../types/order.types';

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
    const orders: Order[] = await piedClient.getOrder(code)
    
    console.log('Pedido recebido:', code, orders);

    return res.status(200).json({ recebido: body, pedido: orders });
});

export default router