import { ProductForm } from '@/components/store/ProductForm';
import { SectionTitle } from '@/components/ui/PageHeader';

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <SectionTitle>เพิ่มสินค้าใหม่</SectionTitle>
      <ProductForm mode="create" />
    </div>
  );
}
