export type SankhyaPartnerInput = {
  // obrigatorio
  NOMEPARC: string;
  TIPPESSOA: 'F' | 'J';
  CLIENTE: 'S' | 'N';
  ATIVO: 'S' | 'N';
  CODCID: string;
  // opc
  CLASSIFICMS?: string;
  CGC_CPF?: string;
  AD_INTEGRADOR?: 'S' | 'N';
  RAZAOSOCIAL?: string;
  EMAIL?: string;
  TELEFONE?: string;
  CEP?: string;
  NUMEND?: string;
  COMPLEMENTO?: string;
  SEXO?: 'M' | 'F';
  DTNASC?: string;
  IDENTINSCESTAD?: string;
};


export type SankhyaOrderHeaderInput = {
  CODPARC: number;
  CODTIPOPER: number;
  DTNEG: string;
  CODEMP: number;
  CODTIPVENDA: number;
  CODNAT: number;
  CODCENCUS: number;
  CODVEND: number;
  AD_NROINTEGRACAO: string;
  AD_CODPARCINT: number;
};

export type SankhyaOrderItemInput = {
  NUNOTA: number;
  CODPROD: number;
  QTDNEG: number;
  VLRUNIT: number;
  VLRTOT: number;
  CONTROLE: string;
  CODVOL: string;
  CODLOCALORIG: number;
  CODTRIB: number;
  CSTIPI: number;
};

export type SankhyaLinkOpInput = {
  IDIPROC: number;
  NUNOTA: number;
  SEQNOTA: number;
};

export type SankhyaConfirmNFInput = { NUNOTA: number };

export type SankhyaProductionInput = {
  planta: number;
  itens: { NUNOTA: number }[];
};

export type SankhyaProductionConfirmInput = { nulop: number };

export type SankhyaProductionFinalizarInput = { IDIATV: number };


export type SankhyaProductionIniciarInput = { IDIATV: number };

export type SankhyaMovimentarInput = {
  idiproc: number;
  idiatv: number;
  operacao: { IDEFX: number; SEQOPER: number };
  materiais: {
    CODPRODMP: number;
    CONTROLEMP: string;
    QTDMOV: number;
    UNIDADE: string;
  }[];
};

export type SankhyaPartner = {
  codparc: number;
  nomeparc: string;
  razaosocial?: string;
  tippessoa: 'F' | 'J';
  CGC_CPF: string;
  CLIENTE: 'S' | 'N';
  AD_INTEGRADOR?: string | null;
  ATIVO: 'S' | 'N';
  CODCID?: string;
  EMAIL?: string;
  TELEFONE?: string;
  CEP?: string;
};

export type SankhyaCity = {
    codcid: number;
    nomecid: string;
    uf: string;
};

export type SankhyaVendedor = {
    codvend: number;
    apelido: string;
    ativo: string;
};

export type SankhyaSuspenderOrdemInput   = { idiproc: number; idproc: number };
export type SankhyaInicializarOrdemInput = { idiproc: number; idproc: number };
