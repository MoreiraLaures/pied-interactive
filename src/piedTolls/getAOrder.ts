import axios from 'axios';
import dotenv from 'dotenv';
import { OrderApiResponse } from '../types/order.types'
import { Router } from 'express';

dotenv.config()



export async function GetAOrder(code: string): Promise<OrderApiResponse> {
    const config = {
        method: 'get' as const,
        maxBodyLength: Infinity,
        url: `https://piedadmin.com.br/api/v1/requests/order/1/1?code=${code}`,
        headers: {
            Authorization: `Bearer ${process.env.PIED_TOKEN}`
        }
    };

    const response = await axios(config);
    return response.data as OrderApiResponse;
};

export default Router