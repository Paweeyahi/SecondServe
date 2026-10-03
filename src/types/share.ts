export interface Share {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  remaining: number;
  pickupNote: string | null;
  createdAt: string;
}

export type ShareClaimStatus = 'reserved' | 'collected' | 'cancelled';

export const SHARE_CLAIM_STATUS_LABELS: Record<ShareClaimStatus, string> = {
  reserved: 'จองแล้ว รอรับของ',
  collected: 'รับของแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

/** Max pieces one person may reserve from a single donation (mirrors claim_share()). */
export const MAX_CLAIM_QUANTITY = 5;
