import { piedClient } from '../class/pied.class';
import { Order } from '../types/order.types';

export type ScrapeResult = {
    totalFetched: number;
    durationMs: number;
    orders: Order[];
}

export async function scrapeOrders(daysBack: number = 45): Promise<ScrapeResult> {
    const start = Date.now();
    const orders = await piedClient.getOrdersSince(daysBack);
    return {
        totalFetched: orders.length,
        durationMs: Date.now() - start,
        orders,
    };
}