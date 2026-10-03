export type DeliveryType = 'pickup' | 'delivery';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'ready'
  | 'rider_assigned'
  | 'picked_up'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'รอร้านยืนยัน',
  confirmed: 'ร้านยืนยันแล้ว',
  ready: 'เตรียมสินค้าเสร็จแล้ว',
  rider_assigned: 'ไรเดอร์รับงานแล้ว',
  picked_up: 'ไรเดอร์รับสินค้าแล้ว',
  delivering: 'กำลังจัดส่ง',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
};

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  consumerId: string;
  storeId: string;
  riderId: string | null;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  deliveryFee: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  items?: OrderItem[];
}
