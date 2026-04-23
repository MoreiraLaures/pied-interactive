import axios from 'axios';
import dotenv from 'dotenv';
import {
  SankhyaPartnerInput,
  SankhyaPartner,
  SankhyaCity,
  SankhyaVendedor,
  SankhyaOrderHeaderInput,
  SankhyaOrderItemInput,
  SankhyaLinkOpInput,
  SankhyaConfirmNFInput,
  SankhyaProductionInput,
  SankhyaProductionConfirmInput,
  SankhyaProductionIniciarInput,
  SankhyaMovimentarInput,
} from '../types/sankhya.types';

dotenv.config();

class SankhyaClient {
  private baseUrl = process.env.SANKHYA_SERVICE_URL || 'http://localhost:3030';

  async getPartners() {
    const { data } = await axios.get(`${this.baseUrl}/partners`);
    return data;
  }

  async createPartner(payload: SankhyaPartnerInput) {
    const { data } = await axios.post(`${this.baseUrl}/partners`, payload);
    return data;
  }

  async updatePartner(
  codparc: number,
  patch: Partial<SankhyaPartnerInput>
): Promise<Partial<SankhyaPartner> & { codparc: number }> {
  const { data } = await axios.patch<Partial<SankhyaPartner> & { codparc: number }>(
    `${this.baseUrl}/partners/${codparc}`,
    patch
  );
  return data;
}

  async findPartnerByDoc(doc: string): Promise<SankhyaPartner | null> {
    const digits = doc.replace(/\D/g, '');
    try {
      const { data } = await axios.get<SankhyaPartner>(`${this.baseUrl}/partners/by-doc/${digits}`);
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  }

    async findCityByName(state: string, name: string): Promise<SankhyaCity | null> {
    const url = `${this.baseUrl}/cities/by-name/${state.toUpperCase()}/${encodeURIComponent(name)}`;
    try {
      const { data } = await axios.get<SankhyaCity>(url);
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  }

    async findOrCreateCity(state: string, name: string): Promise<SankhyaCity> {
    const { data } = await axios.post<SankhyaCity>(`${this.baseUrl}/cities`, {
      state: state.toUpperCase(),
      name,
    });
    return data;
  }

    async listVendedores(): Promise<SankhyaVendedor[]> {
    const { data } = await axios.get<{ count: number; vendedores: SankhyaVendedor[] }>(
      `${this.baseUrl}/vendedores`
    );
    return data.vendedores;
  }
async findVendedorByEmail(email: string): Promise<SankhyaVendedor | null> {
    try {
        const { data } = await axios.get<SankhyaVendedor>(
            `${this.baseUrl}/vendedores/by-email/${encodeURIComponent(email)}`
        );
        return data;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
    }
}

  async findVendedorByApelido(apelido: string): Promise<SankhyaVendedor | null> {
    try {
        const { data } = await axios.get<SankhyaVendedor>(
            `${this.baseUrl}/vendedores/by-apelido/${encodeURIComponent(apelido)}`
        );
        return data;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
    }
}


  async createOrderHeader(payload: SankhyaOrderHeaderInput) {
    const { data } = await axios.post(`${this.baseUrl}/orders/header`, payload);
    return data;
  }

  async createOrderItem(payload: SankhyaOrderItemInput) {
    const { data } = await axios.post(`${this.baseUrl}/orders/item`, payload);
    return data;
  }

  async linkOP(payload: SankhyaLinkOpInput) {
    const { data } = await axios.post(`${this.baseUrl}/orders/link-op`, payload);
    return data;
  }

  async confirmNF(payload: SankhyaConfirmNFInput) {
    const { data } = await axios.post(`${this.baseUrl}/orders/confirm`, payload);
    return data;
  }

  async startProduction(payload: SankhyaProductionInput) {
    const { data } = await axios.post(`${this.baseUrl}/production`, payload);
    return data;
  }

  async getProductionAtividades(id: number) {
    const { data } = await axios.get(`${this.baseUrl}/production/atividades/${id}`);
    return data;
  }

  async confirmProduction(payload: SankhyaProductionConfirmInput) {
    const { data } = await axios.post(`${this.baseUrl}/production/confirm`, payload);
    return data;
  }

  async startActivity(payload: SankhyaProductionIniciarInput) {
    const { data } = await axios.post(`${this.baseUrl}/production/iniciar`, payload);
    return data;
  }

  async addRawMaterials(payload: SankhyaMovimentarInput) {
    const { data } = await axios.post(`${this.baseUrl}/production/movimentar`, payload);
    return data;
  }
}

export const sankhyaClient = new SankhyaClient();