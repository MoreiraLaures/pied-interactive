import { Address, Contact } from './shared.types';



export type Company = {
    address: Address;
    companyName: string;
    fantasyName: string;
    cpf: string | null;
    cnpj: string | null;
    mainContact: Contact;
}