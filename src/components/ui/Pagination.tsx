import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

/**
 * "Showing X–Y of N" + previous/next links. Server component: `hrefForPage`
 * builds each page's URL so callers keep their own query params.
 */
export function Pagination({
  page,
  pageSize,
  total,
  unit,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Thai noun for the counted items, e.g. "ออเดอร์", "งาน". */
  unit: string;
  hrefForPage: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-neutral-500">
        แสดง {firstShown}–{lastShown} จาก {total} {unit}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefForPage(page - 1)}>
              <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                ก่อนหน้า
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled leftIcon={<ChevronLeft className="h-4 w-4" />}>
              ก่อนหน้า
            </Button>
          )}
          <span className="text-sm text-neutral-600">
            หน้า {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefForPage(page + 1)}>
              <Button variant="outline" size="sm" rightIcon={<ChevronRight className="h-4 w-4" />}>
                ถัดไป
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled rightIcon={<ChevronRight className="h-4 w-4" />}>
              ถัดไป
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Reads `?page=` safely, defaulting to 1. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
