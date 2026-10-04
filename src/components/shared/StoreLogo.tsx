import Image from 'next/image';

const SIZES = {
  xs: 'h-5 w-5 text-[10px] rounded-md',
  sm: 'h-8 w-8 text-xs rounded-lg',
  md: 'h-12 w-12 text-base rounded-xl',
  lg: 'h-16 w-16 text-xl rounded-2xl',
} as const;
const PX = { xs: 20, sm: 32, md: 48, lg: 64 } as const;

/** A store's logo, or its first letter on brand green when none is set. */
export function StoreLogo({
  name,
  logoUrl,
  size = 'sm',
  className = '',
}: {
  name: string;
  logoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const box = `relative flex flex-shrink-0 items-center justify-center overflow-hidden ${SIZES[size]} ${className}`;
  if (logoUrl) {
    return (
      <span className={`${box} bg-white ring-1 ring-neutral-200`}>
        <Image src={logoUrl} alt={`โลโก้ ${name}`} fill sizes={`${PX[size]}px`} className="object-cover" />
      </span>
    );
  }
  return (
    <span className={`${box} bg-forest-100 font-bold text-forest-800`} aria-hidden="true">
      {name.trim().charAt(0) || '?'}
    </span>
  );
}
