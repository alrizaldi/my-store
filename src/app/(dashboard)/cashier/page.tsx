"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Types ----------------------------------------------------------------

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  categoryId: string | null;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  stock: number;
}

interface Promo {
  id: string;
  code: string | null;
  name: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface CompletedOrder {
  id: string;
  orderNumber: string;
  total: number;
}

// ---- Currency formatter ---------------------------------------------------

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

// ---- Payment methods ------------------------------------------------------

const PAYMENT_METHODS = ["CASH", "CARD", "QRIS", "TRANSFER"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ==========================================================================

export default function CashierPage() {
  // ---- Product / catalog state -------------------------------------------
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ---- Cart state ---------------------------------------------------------
  const [cart, setCart] = useState<CartItem[]>([]);

  // ---- Promo state --------------------------------------------------------
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // ---- Payment state ------------------------------------------------------
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // ---- Success state ------------------------------------------------------
  const [lastOrder, setLastOrder] = useState<CompletedOrder | null>(null);
  const [lastChange, setLastChange] = useState(0);

  // ---- Fetch categories on mount -----------------------------------------
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Category[]) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  // ---- Fetch products when search/category changes -----------------------
  const fetchProducts = useCallback(() => {
    setLoadingProducts(true);
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    if (selectedCategory) params.set("categoryId", selectedCategory);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((res: { data: Product[] }) => setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [search, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  // ---- Cart calculations --------------------------------------------------
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const discount = promo
    ? promo.type === "PERCENTAGE"
      ? Math.min(
          subtotal * (promo.value / 100),
          promo.maxDiscount !== null ? promo.maxDiscount : Infinity
        )
      : promo.value
    : 0;

  const taxable = subtotal - discount;
  const tax = taxEnabled ? taxable * 0.1 : 0;
  const total = taxable + tax;

  const amountPaidNum = parseFloat(amountPaid.replace(/\D/g, "")) || 0;
  const change = paymentMethod === "CASH" ? Math.max(0, amountPaidNum - total) : 0;

  // ---- Cart actions -------------------------------------------------------
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      if (product.stock < 1) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          stock: product.stock,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // ---- Promo actions ------------------------------------------------------
  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromo(null);

    try {
      const res = await fetch(`/api/promos?search=${encodeURIComponent(promoCode.trim())}`);
      const json = await res.json();
      const list: Promo[] = Array.isArray(json.data) ? json.data : [];
      const found = list.find(
        (p) => p.code?.toLowerCase() === promoCode.trim().toLowerCase()
      );

      if (!found) {
        setPromoError("Kode promo tidak ditemukan");
        return;
      }

      const now = new Date();
      const start = new Date(found.startDate);
      const end = new Date(found.endDate);

      if (!found.isActive || now < start || now > end) {
        setPromoError("Promo tidak aktif atau sudah kedaluwarsa");
        return;
      }

      if (found.minOrder !== null && subtotal < found.minOrder) {
        setPromoError(`Minimum belanja ${formatIDR(found.minOrder)}`);
        return;
      }

      setPromo(found);
    } catch {
      setPromoError("Gagal memvalidasi promo");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoCode("");
    setPromoError("");
  };

  // ---- Process Payment ----------------------------------------------------
  const processPayment = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "CASH" && amountPaidNum < total) {
      setPaymentError("Jumlah pembayaran kurang dari total");
      return;
    }

    setProcessing(true);
    setPaymentError("");

    try {
      // 1. Create order
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.qty })),
          promoId: promo?.id ?? undefined,
          taxRate: taxEnabled ? 0.1 : 0,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error ?? "Gagal membuat pesanan");
      }

      const order: CompletedOrder = await orderRes.json();

      // 2. Create payment
      const paymentRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          method: paymentMethod,
          amount: paymentMethod === "CASH" ? amountPaidNum : total,
        }),
      });

      if (!paymentRes.ok) {
        const err = await paymentRes.json();
        throw new Error(err.error ?? "Gagal memproses pembayaran");
      }

      setLastOrder(order);
      setLastChange(change);
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setProcessing(false);
    }
  };

  // ---- Reset after success ------------------------------------------------
  const resetAll = () => {
    setCart([]);
    setPromo(null);
    setPromoCode("");
    setPromoError("");
    setTaxEnabled(false);
    setPaymentMethod("CASH");
    setAmountPaid("");
    setPaymentError("");
    setLastOrder(null);
    setLastChange(0);
  };

  // ---- Success screen -----------------------------------------------------
  if (lastOrder) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Pesanan Selesai!</h2>
          <p className="text-gray-500 text-sm mb-4">Pembayaran berhasil diproses</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">No. Pesanan</span>
              <span className="font-mono font-semibold text-blue-600">{lastOrder.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">{formatIDR(lastOrder.total)}</span>
            </div>
            {paymentMethod === "CASH" && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Dibayar</span>
                  <span className="font-semibold text-gray-900">{formatIDR(amountPaidNum)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-700 font-medium">Kembalian</span>
                  <span className="font-bold text-green-600 text-base">{formatIDR(lastChange)}</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={resetAll}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Pesanan Baru
          </button>
        </div>
      </div>
    );
  }

  // ---- Main POS layout ----------------------------------------------------
  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* ============================================================
          LEFT: Product catalog
      ============================================================ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
          <button
            onClick={() => setSelectedCategory("")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === ""
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
            }`}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {loadingProducts ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Tidak ada produk ditemukan
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-2">
              {products.map((product) => {
                const inCart = cart.find((i) => i.productId === product.id);
                const isLowStock = product.stock <= product.minStock;
                const outOfStock = product.stock === 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`relative bg-white rounded-xl border p-3 text-left transition-all ${
                      outOfStock
                        ? "opacity-50 cursor-not-allowed border-gray-100"
                        : inCart
                        ? "border-blue-400 ring-1 ring-blue-400 shadow-sm"
                        : "border-gray-100 hover:border-blue-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Stock badge */}
                    <span
                      className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        outOfStock
                          ? "bg-red-100 text-red-600"
                          : isLowStock
                          ? "bg-orange-100 text-orange-600"
                          : "bg-green-100 text-green-600"
                      }`}
                    >
                      {outOfStock ? "Habis" : `${product.stock}`}
                    </span>

                    {/* In-cart badge */}
                    {inCart && (
                      <span className="absolute top-2 left-2 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {inCart.qty}
                      </span>
                    )}

                    <div className="mt-4 mb-1">
                      <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
                        {product.name}
                      </p>
                    </div>
                    <p className="text-blue-600 font-bold text-sm">{formatIDR(product.price)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          RIGHT: Cart + Payment
      ============================================================ */}
      <div className="w-96 flex-shrink-0 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Keranjang</h2>
            {cart.length > 0 && (
              <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              Hapus Semua
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 py-12">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm">Keranjang kosong</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="px-4 py-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{formatIDR(item.price)} / pcs</p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.productId, -1)}
                    className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-gray-900">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.productId, 1)}
                    disabled={item.qty >= item.stock}
                    className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-600 flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div className="w-20 text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatIDR(item.price * item.qty)}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bottom panel: totals + payment */}
        <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-3">
          {/* Promo */}
          <div>
            {promo ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-green-700">{promo.code} diterapkan</p>
                  <p className="text-xs text-green-600">{promo.name}</p>
                </div>
                <button onClick={removePromo} className="text-green-600 hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kode promo"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={applyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {promoLoading ? "..." : "Terapkan"}
                </button>
              </div>
            )}
            {promoError && <p className="text-xs text-red-500 mt-1">{promoError}</p>}
          </div>

          {/* Totals breakdown */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon</span>
                <span>- {formatIDR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-gray-500">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span>Pajak (10%)</span>
              </label>
              <span>{taxEnabled ? formatIDR(tax) : "-"}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{formatIDR(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5">Metode Pembayaran</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    paymentMethod === method
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Amount paid (CASH only) */}
          {paymentMethod === "CASH" && (
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-medium">Jumlah Dibayar</label>
              <input
                type="number"
                placeholder="Masukkan jumlah"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                min={0}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {amountPaidNum >= total && total > 0 && (
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-500">Kembalian</span>
                  <span className="text-green-600 font-bold">{formatIDR(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {paymentError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {paymentError}
            </p>
          )}

          {/* Process button */}
          <button
            onClick={processPayment}
            disabled={
              cart.length === 0 ||
              processing ||
              (paymentMethod === "CASH" && amountPaidNum < total)
            }
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Proses Pembayaran
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
