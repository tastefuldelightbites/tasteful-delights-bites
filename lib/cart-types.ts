export type CartBox = {
  key: string;
  type: 'box';
  count: number;
  label: string;
  cents: number;
  flavors: { id: string; name: string; qty: number }[];
  quantity: number;
};

export type CartItem = {
  key: string;
  type: 'item';
  productId: string;
  name: string;
  option: string;
  cents: number;
  quantity: number;
};

export type CartLine = CartBox | CartItem;

export type CheckoutInput = {
  lines: CartLine[];
  name: string;
  phone: string;
  email: string;
  fulfillment: 'pickup' | 'delivery';
  address: string;
  notes: string;
  dropId: string;
  paymentMethod: string;
  subscribe: boolean;
};

/** Which Drop the order in the bag is for (one Drop per order). */
export type CartDrop = { id: string; name: string; pickup: string };
