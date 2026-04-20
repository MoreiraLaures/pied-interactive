import axios from 'axios';
import dotenv from 'dotenv';
import {
  SankhyaPartnerInput,
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