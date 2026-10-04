export type ProductStatus = 'active' | 'sold_out' | 'expired' | 'shared';

/**
 * Allowed product categories — near-expiry food that can be resold or shared.
 * Keys are stored in the DB (`products.category` CHECK); labels are Thai UI text.
 */
export const PRODUCT_CATEGORIES = {
  produce: 'ผักและผลไม้',
  meat_seafood: 'เนื้อสัตว์และอาหารทะเล',
  dairy: 'นมและผลิตภัณฑ์นม',
  fresh: 'อาหารสดอื่น ๆ',
  frozen: 'อาหารแช่แข็ง',
  bakery: 'เบเกอรี่',
  snacks: 'ขนมและของหวาน',
  ready_meal: 'อาหารสำเร็จรูป',
  beverage: 'เครื่องดื่ม',
  dry: 'อาหารแห้ง',
} as const;

export type ProductCategory = keyof typeof PRODUCT_CATEGORIES;

export const PRODUCT_CATEGORY_KEYS = Object.keys(
  PRODUCT_CATEGORIES
) as ProductCategory[];

export function categoryLabel(key: string): string {
  return (PRODUCT_CATEGORIES as Record<string, string>)[key] ?? key;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  category: ProductCategory;
  originalPrice: number;
  discountPrice: number;
  quantity: number;
  expiryDate: string;
  imageUrl: string;
  status: ProductStatus;
  createdAt: string;
}
