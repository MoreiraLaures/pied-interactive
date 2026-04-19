
export type PaymentCondition = {
    name: string;
    quantityOfInstallments: number;
    conditionType: string;
    modifierType: string | null;
    value: number | null;
}

export type Payment = {
    type: string;
    showConditionsRule: string;
    condition: PaymentCondition;
    status: string;
    description: string;
    files: string[];
    transactionStatus?: string;
    links?: string[];
}