import { Order } from '../types/order.types';
import { matchesPadrao, runPadraoFlow } from '../flows/padrao.flow';
import { log } from '../db/logger';

type Flow = {
    name: string;
    matches: (order: Order) => boolean;
    run:     (order: Order) => Promise<void>;
};

const flows: Flow[] = [
    { name: 'padrao', matches: matchesPadrao, run: runPadraoFlow },
    // adicionar novos flows aqui no futuro
];

export async function processOrder(order: Order): Promise<void> {
    for (const flow of flows) {
        if (!flow.matches(order)) continue;
        try {
            await flow.run(order);
        } catch (err) {
            await log({
                level: 'error', source: 'processor', piedCode: order.code,
                message: `Flow '${flow.name}' falhou`,
                context: { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
            });
            // não relança — falha de flow individual não deve derrubar o webhook
        }
        return;  // primeiro flow que bate executa, só um por pedido
    }
}
