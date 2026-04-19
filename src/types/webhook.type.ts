import { Contact } from './shared.types';
import { Company } from './partner.type';
import { Payment } from './payment.types';

export type WebhookOrderData = {
    id: string;
    name: string;
    code: string;
    kind: string;
    type: string;
    totalPower: number;
    dealStatus: string;
    stockStatus: string;
    originalValue: number;
    finalValue: number;
    differenceWithPaymentConditionApplied: number;
    responsible: Contact | null;
    company: Company;
    products: { name: string; quantity: number }[];
    payment: Payment;
    lastUpdate: string;
    tags: string[];
}

export type WebhookEvent = {
    event: string;
    data: WebhookOrderData;
}