import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Brand page banner: Deep -> Forest Green gradient, Leaf Green accent line.
 * Used at the top of every workspace and consumer page so the app reads
 * as one product (brand palette: tailwind.config.ts `forest` / `leaf`).
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  avatar,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Custom leading visual (e.g. a store logo); replaces `icon`. */
  avatar?: ReactNode;
  /** Optional right-side slot (buttons, badges). */
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 via-forest-800 to-forest-700 p-5 text-white shadow-sm sm:p-6">
      {/* Decorative leaf-green glow, purely visual */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-leaf-500/25 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {avatar ??
            (Icon && (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Icon className="h-5 w-5" />
              </div>
            ))}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-forest-100">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-leaf-500 via-leaf-600 to-transparent" aria-hidden="true" />
    </div>
  );
}

/** Section heading inside a page: Leaf Green accent bar + Deep Green text. */
export function SectionTitle({
  children,
  subtitle,
  action,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="border-l-4 border-leaf-600 pl-3">
        <h2 className="text-lg font-bold leading-tight text-forest-900">{children}</h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
