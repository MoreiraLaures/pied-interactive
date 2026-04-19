import axios from 'axios';
import dotenv from 'dotenv';
import { PossibleStatus } from '../types/status.types';

dotenv.config();

const config = {
    method: 'get'as const,
    maxBodyLength: Infinity,
    url: 'https://piedadmin.com.br/api/v1/request/order/statuses',
    headers:{
        Authorization: `Bearer ${process.env.PIED_TOKEN}`
    }
};
export async function getStatusFromPied(){
    const response = await axios.request<PossibleStatus[]>(config);
    return response.data;
};

