import { ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/lib/actions/auth';

export const metadata = {
  title: 'บัญชีถูกระงับ — SecondServe',
};

export default function SuspendedPage() {
  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <Card className="shadow-lg border-neutral-200/90">
          <CardHeader>
            <CardTitle>บัญชีนี้ถูกระงับการใช้งาน</CardTitle>
            <CardDescription>
              บัญชีของคุณถูกระงับโดยผู้ดูแลระบบ หากคิดว่าเป็นความผิดพลาด
              กรุณาติดต่อทีมงาน SecondServe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="lg" className="w-full">
                ออกจากระบบ
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
