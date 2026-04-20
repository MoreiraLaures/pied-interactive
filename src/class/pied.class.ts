import axios from 'axios';
import { Order, OrderApiResponse } from '../types/order.types';
import dotenv from 'dotenv';
dotenv.config();

class PiedClient {
    private baseUrl = 'https://piedadmin.com.br/api/v1';
    private defaultPageSize = 500;

    private get headers() {
        return { Authorization: `Bearer ${process.env.PIED_TOKEN}` };
    }

    async getOrder(code: string): Promise<Order[]> {
        const { data } = await axios.get<OrderApiResponse>(
            `${this.baseUrl}/requests/order/1/1?code=${code}`,
            { headers: this.headers, maxBodyLength: Infinity }
        );
        return data.data.items;
    }

    async getOrdersPage(
        page: number,
        pageSize: number,
        lastUpdateAfter: string
    ): Promise<OrderApiResponse> {
        const url = `${this.baseUrl}/requests/order/${page}/${pageSize}?lastUpdateAfter=${lastUpdateAfter}`;
        const { data } = await axios.get<OrderApiResponse>(url, {
            headers: this.headers,
            maxBodyLength: Infinity,
        });
        return data;
    }

    async getOrdersSince(
        daysBack: number ,
        pageSize: number = this.defaultPageSize
    ): Promise<Order[]> {
        const lastUpdateAfter = this.daysAgoISO(daysBack);
        console.log(`[PIED] since=${lastUpdateAfter}`);

        const first = await this.getOrdersPage(0, pageSize, lastUpdateAfter);
        const totalItems = first.data.totalItems ?? first.data.items.length;
        console.log(`[PIED] total=${totalItems}`);

        const totalPages = Math.ceil(totalItems / pageSize);
        const all: Order[] = [...first.data.items];

        for (let page = 1; page < totalPages; page++) {
            try {
                const r = await this.getOrdersPage(page, pageSize, lastUpdateAfter);
                console.log(`[PIED] page=${page + 1}/${totalPages} items=${r.data.items.length}`);
                all.push(...r.data.items);
            } catch (err) {
                const msg = axios.isAxiosError(err) ? err.response?.status : (err as Error).message;
                console.error(`[PIED][ERR] page=${page} ${msg}`);
            }
        }

        console.log(`[PIED] fetched=${all.length}`);
        return all;
    }

    private daysAgoISO(days: number): string {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
    }
}

export const piedClient = new PiedClient();
