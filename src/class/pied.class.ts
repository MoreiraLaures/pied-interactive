import axios from 'axios';
import { Order, OrderApiResponse } from '../types/order.types';
import dotenv from 'dotenv'
dotenv.config()


class PiedClient {
    private baseUrl = 'https://piedadmin.com.br/api/v1';

    private get headers() {
        return { Authorization: `Bearer ${process.env.PIED_TOKEN}` };
    };
     async getOrder(code: string): Promise<Order[]> {
    const response = await axios({
            method: 'get',
            maxBodyLength: Infinity,
            url: `${this.baseUrl}/requests/order/1/1?code=${code}`,
            headers: this.headers
        });
    
    const result: OrderApiResponse = response.data;
    return result.data.items;
    };
    
}

export const piedClient = new PiedClient();