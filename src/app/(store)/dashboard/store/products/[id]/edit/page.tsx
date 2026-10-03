import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/store/ProductForm';
import { getCurrentStore, getStoreProduct } from '@/lib/queries/store';
import { SectionTitle } from '@/components/ui/PageHeader';

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const store = await getCurrentStore();
  if (!store) notFound();

  const product = await getStoreProduct(store.id, params.id);
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <SectionTitle>แก้ไขสินค้า</SectionTitle>
      <ProductForm mode="edit" product={product} />
    </div>
  );
}
