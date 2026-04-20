import { Contact } from './shared.types';
import { Company } from './partner.type';
import { Payment } from './payment.types';
import { Product , OrderStructure } from './products.type';
import { Address } from './shared.types';



export type Invoice = {
    razaoSocial: string;
    nomeFantasia?: string;
    temInscricaoEstadual: string;
    temInscricaoSuframa: string;
    cpf?: string;
    cnpj?: string;
    ie?: string;
    rg?: string;
    telephone: string;
    email: string;
    originalInvoiceValue: number;
    requestedInvoiceValue?: number;
    serviceToAddInvoiceValue?: number;
    address: Address;
}

export type Freight = {
    type: string;
    timeRestriction: string;
    truckPossible: string;
    zoneType: string;
    address: Address;
    price: number;
    integrationData: {
        id: string | null;
        name: string | null;
        providerName: string | null;
    };
}

export type Order = {
    id: string;
    name: string;
    code: string;
    kind: string;
    totalPower: number;
    discount: number;
    surcharge: number;
    differenceWithPaymentConditionApplied: number;
    responsible: Contact | null;
    company: Company;
    addedBy: Contact;
    structure: OrderStructure;
    stockStatus: string;
    dealStatus: string;
    requestStatus: string;
    notes: string;
    originalValue: number;
    totalValue: number;
    finalValue: number;
    files: string[];
    customForm: unknown[];
    payment: Payment;
    products: Product[];
    removed: boolean;
    profitMargin: number;
    customData: unknown[];
    billingDate: string | null;
    apiSent: boolean;
    apiSentUpdated: string;
    invoice: Invoice;
    freight: Freight;
    budgetCreated: string;
    orderCreated: string;
}

export type OrderApiResponse = {
    error: string | null;
    data: { 
        items: Order[];
        totalItems: number;
    };
}