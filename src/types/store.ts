export interface Store {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  /** Flat fee the store charges for rider delivery (0 = free / pickup only). */
  deliveryFee: number;
  /** Admin approval gate for public listing. */
  verified: boolean;
  createdAt: string;
}
