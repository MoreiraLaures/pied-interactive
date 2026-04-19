export type ProductCenter = {
    name: string;
    code: string;
}

export type ProductDimensions = {
    weight_KG?: number;
    width_MM?: number;
    height_MM?: number;
    length_MM?: number;
    volume_M3?: number;
}

export type ValueModifier = {
    increase: { amount: number; type: string };
    decrease: { amount: number; type: string };
}

export type Product = {
    productCode: string;
    type: string;
    name: string;
    quantity: number;
    singlePrice: number;
    totalPrice: number;
    valueModifier: ValueModifier;
    center: ProductCenter;
    dimensions: ProductDimensions;
}