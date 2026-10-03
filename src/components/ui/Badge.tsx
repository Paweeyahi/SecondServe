import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'forest'
    | 'consumer'
    | 'store'
    | 'rider'
    | 'admin'
    | 'warning'
    | 'danger'
    | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className = '',
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs font-semibold',
    md: 'px-3 py-1 text-sm font-semibold',
  };

  const variantStyles = {
    default: 'bg-neutral-100 text-neutral-800 border-neutral-200',
    forest: 'bg-forest-100 text-forest-800 border-forest-200',
    consumer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    store: 'bg-amber-100 text-amber-900 border-amber-200',
    rider: 'bg-sky-100 text-sky-900 border-sky-200',
    admin: 'bg-purple-100 text-purple-900 border-purple-200',
    warning: 'bg-yellow-100 text-yellow-900 border-yellow-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    outline: 'border border-neutral-300 bg-transparent text-neutral-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
