'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface CartLine {
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  maxQuantity: number;
}

export interface CartSnapshot {
  storeId: string | null;
  storeName: string | null;
  lines: CartLine[];
}

export interface AddItemInput {
  storeId: string;
  storeName: string;
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  originalPrice: number;
  maxQuantity: number;
}

type AddResult = 'added' | 'different_store' | 'no_stock';

interface CartContextValue extends CartSnapshot {
  count: number;
  itemsTotal: number;
  addItem: (input: AddItemInput, opts?: { replaceStore?: boolean }) => AddResult;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'secondserve_cart_v1';
const EMPTY: CartSnapshot = { storeId: null, storeName: null, lines: [] };

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as CartSnapshot;
    if (!parsed || !Array.isArray(parsed.lines)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartSnapshot>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode / quota — cart stays in memory only */
    }
  }, [state, hydrated]);

  const addItem = useCallback<CartContextValue['addItem']>((input, opts) => {
    if (input.maxQuantity <= 0) return 'no_stock';

    let result: AddResult = 'added';
    setState((prev) => {
      const differentStore =
        prev.storeId !== null && prev.storeId !== input.storeId && prev.lines.length > 0;

      if (differentStore && !opts?.replaceStore) {
        result = 'different_store';
        return prev;
      }

      const base =
        differentStore || prev.storeId === null
          ? { storeId: input.storeId, storeName: input.storeName, lines: [] as CartLine[] }
          : prev;

      const existing = base.lines.find((l) => l.productId === input.productId);
      const nextLines = existing
        ? base.lines.map((l) =>
            l.productId === input.productId
              ? { ...l, quantity: Math.min(l.quantity + 1, l.maxQuantity) }
              : l
          )
        : [
            ...base.lines,
            {
              productId: input.productId,
              name: input.name,
              imageUrl: input.imageUrl,
              unitPrice: input.unitPrice,
              originalPrice: input.originalPrice,
              quantity: 1,
              maxQuantity: input.maxQuantity,
            },
          ];

      return { storeId: input.storeId, storeName: input.storeName, lines: nextLines };
    });
    return result;
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setState((prev) => {
      const lines = prev.lines
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, Math.min(quantity, l.maxQuantity)) }
            : l
        )
        .filter((l) => l.quantity > 0);
      return lines.length === 0 ? EMPTY : { ...prev, lines };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setState((prev) => {
      const lines = prev.lines.filter((l) => l.productId !== productId);
      return lines.length === 0 ? EMPTY : { ...prev, lines };
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.lines.reduce((n, l) => n + l.quantity, 0);
    const itemsTotal = state.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    return { ...state, count, itemsTotal, addItem, setQuantity, removeItem, clear };
  }, [state, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
