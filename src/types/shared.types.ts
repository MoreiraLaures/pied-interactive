export type Address = {
    CEP: string;
    patio: string;
    neighborhood: string;
    city: string;
    state: string;
    number: string;
    complement?: string;
    patioType?: string;
    patioFormatted?: string;
}

export type Contact = {
    name: string;
    surname: string;
    cellphone: string;
    email: string;
}