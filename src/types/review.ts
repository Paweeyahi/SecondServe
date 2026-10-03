export type ReviewTarget = 'store' | 'rider';

export interface Review {
  id: string;
  orderId: string;
  consumerId: string;
  storeId: string | null;
  riderId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}
