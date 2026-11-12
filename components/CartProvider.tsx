'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartDrop, CartLine } from '@/lib/cart-types';

type Ctx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** Adds to the order. Returns false if the customer chose to keep their other order (a different pickup date). */
  add: (line: CartLine, drop: CartDrop) => boolean;
  drop: CartDrop | null;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
  ready: boolean;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = 'tdb_bag_v1';
const DROP_KEY = 'tdb_bag_drop_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [drop, setDrop] = useState<CartDrop | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
      const d = localStorage.getItem(DROP_KEY);
      if (d) setDrop(JSON.parse(d));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
      localStorage.setItem(DROP_KEY, JSON.stringify(lines.length ? drop : null));
    } catch {}
  }, [lines, drop, ready]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

  const value = useMemo<Ctx>(() => ({
    lines,
    ready,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.cents * l.quantity, 0),
    drop,
    add: (line, d) => {
      // One order is for one Drop (one pickup day). Ask before switching.
      if (lines.length > 0 && drop && drop.id !== d.id) {
        const ok = window.confirm(`Your order has items for ${drop.name} (${drop.pickup}).\n\nStart a new order for ${d.name} (${d.pickup}) instead? This removes the items already in your order.`);
        if (!ok) return false;
        setLines([line]);
        setDrop(d);
        return true;
      }
      setDrop(d);
      setLines((ls) => {
        const same = ls.find((l) => l.key === line.key);
        if (same) return ls.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l));
        return [...ls, line];
      });
      return true;
    },
    setQty: (key, qty) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(50, qty)) } : l))),
    remove: (key) => setLines((ls) => ls.filter((l) => l.key !== key)),
    clear: () => setLines([]),
    toast,
    showToast,
  }), [lines, drop, ready, toast, showToast]);

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
