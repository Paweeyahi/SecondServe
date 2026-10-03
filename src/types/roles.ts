export type UserRole = 'consumer' | 'store' | 'rider' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  suspended: boolean;
  createdAt: string;
}
