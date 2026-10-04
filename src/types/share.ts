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

/** Hours a reservation is held before run_expiry_jobs() cancels it. */
export const CLAIM_HOLD_HOURS = 24;

/** When a reservation will be auto-cancelled: hold window or food expiry, whichever is first. */
export function claimPickupDeadline(claimedAt: string, productExpiry: string | null | undefined): Date {
  const hold = new Date(claimedAt).getTime() + CLAIM_HOLD_HOURS * 3_600_000;
  const expiry = productExpiry ? new Date(productExpiry).getTime() : Infinity;
  return new Date(Math.min(hold, expiry));
}
