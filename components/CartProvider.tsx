'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/lib/cart-types';

type Ctx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
  ready: boolean;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = 'tdb_bag_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {}
  }, [lines, ready]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

  const value = useMemo<Ctx>(() => ({
    lines,
    ready,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.cents * l.quantity, 0),
    add: (line) => setLines((ls) => {
      const same = ls.find((l) => l.key === line.key);
      if (same) return ls.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l));
      return [...ls, line];
    }),
    setQty: (key, qty) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(50, qty)) } : l))),
    remove: (key) => setLines((ls) => ls.filter((l) => l.key !== key)),
    clear: () => setLines([]),
    toast,
    showToast,
  }), [lines, ready, toast, showToast]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </CartContext.Provider>
  );
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
}
