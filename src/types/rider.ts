export type VehicleType = 'motorcycle' | 'bicycle' | 'car';
export type RiderStatus = 'available' | 'busy' | 'offline';

export interface Rider {
  id: string;
  vehicleType: VehicleType;
  licensePlate: string;
  status: RiderStatus;
  /** Admin approval gate for claiming delivery jobs. */
  verified: boolean;
  createdAt: string;
}
