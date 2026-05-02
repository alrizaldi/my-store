"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Types ------------------------------------------------------------------

interface Cashier {
  id: string;
  name: string;
}

interface Session {
  id: string;
}

interface Promo {
  id: string;
  name: string;
  code: string | null;
}

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

interface Payment {
  id: string;
  method: string;
  amount: number;
  change: number;
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  notes: string | null;
  createdAt: string;
  cashier: Cashier | null;
  session: Session | null;
  promo: Promo | null;
  items: OrderItem[];
  payments: Payment[];
}

interface Alert {
  message: string;
  type: "success" | "error";
}

// ---- Helpers ----------------------------------------------------------------

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Refund",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const STATUS_FILTER_BUTTONS = [
  {
    value: "",
    label: "Semua",
    active: "bg-gray-800 text-white",
    idle: "bg-white text-gray-600 border border-gray-200 hover:border-gray-400",
  },
  {
    value: "PENDING",
    label: "Pending",
    active: "bg-yellow-500 text-white",
    idle: "bg-white text-yellow-700 border border-yellow-200 hover:border-yellow-400",
  },
  {
    value: "COMPLETED",
    label: "Selesai",
    active: "bg-green-600 text-white",
    idle: "bg-white text-green-700 border border-green-200 hover:border-green-400",
  },
  {
    value: "CANCELLED",
    label: "Dibatalkan",
    active: "bg-red-600 text-white",
    idle: "bg-white text-red-600 border border-red-200 hover:border-red-400",
  },
  {
    value: "REFUNDED",
    label: "Refund",
    active: "bg-gray-600 text-white",
    idle: "bg-white text-gray-500 border border-gray-200 hover:border-gray-400",
  },
];

// =============================================================================

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showDetail, setShowDetail] = useState<Order | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // ---- Fetch ----------------------------------------------------------------

  const fetchOrders = useCallback(
    async (q: string, status: string, p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(LIMIT),
        });
        if (q) params.set("search", q);
        if (status) params.set("status", status);
        const res = await fetch(`/api/orders?${params}`);
        const json = await res.json();
        setOrders(Array.isArray(json.data) ? json.data : []);
        setTotal(typeof json.total === "number" ? json.total : 0);
      } catch {
        setAlert({ message: "Gagal memuat pesanan", type: "error" });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounce search, immediate on status/page change
  useEffect(() => {
    const timer = setTimeout(
      () => {
        fetchOrders(search, statusFilter, page);
      },
      search ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [search, statusFilter, page, fetchOrders]);

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // ---- Auto-dismiss alert --------------------------------------------------

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4000);
    return () => clearTimeout(t);
  }, [alert]);

  // ---- Order actions -------------------------------------------------------

  const handleStatusChange = async (
    orderId: string,
    newStatus: "CANCELLED" | "REFUNDED",
  ) => {
    const label = newStatus === "CANCELLED" ? "membatalkan" : "merefund";
    if (!window.confirm(`Konfirmasi ${label} pesanan ini?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal memperbarui pesanan");
      }
      const updated: Order = await res.json();
      setAlert({
        message:
          newStatus === "CANCELLED"
            ? "Pesanan berhasil dibatalkan"
            : "Pesanan berhasil direfund",
        type: "success",
      });
      // Refresh detail and list
      setShowDetail(updated);
      fetchOrders(search, statusFilter, page);
    } catch (e) {
      setAlert({
        message: e instanceof Error ? e.message : "Gagal memperbarui",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <div>
      {/* Alert */}
      {alert && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            alert.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {alert.message}
        </div>
      )}

      {/* Page header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Manajemen Pesanan
      </h1>

      {/* Search + Status filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Cari nomor pesanan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setStatusFilter(btn.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === btn.value ? btn.active : btn.idle
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  No. Pesanan
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Tanggal
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Kasir
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">
                  Item
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Subtotal
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Diskon
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Total
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Tidak ada pesanan ditemukan
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-blue-600 font-medium text-xs">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {order.cashier?.name ?? (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {order.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatIDR(order.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {order.discount > 0
                        ? `- ${formatIDR(order.discount)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatIDR(order.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setShowDetail(order)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Menampilkan {orders.length} dari {total} pesanan
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Sebelumnya
          </button>
          <span className="px-3 py-1.5 font-medium text-gray-700">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Selanjutnya
          </button>
        </div>
      </div>

      {/* Order Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Detail Pesanan
                </h2>
                <p className="text-sm font-mono text-blue-600">
                  {showDetail.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setShowDetail(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Order info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400 block">Tanggal</span>
                  <span className="font-medium text-gray-900">
                    {formatDateTime(showDetail.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Kasir</span>
                  <span className="font-medium text-gray-900">
                    {showDetail.cashier?.name ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Sesi</span>
                  <span className="font-medium text-gray-900">
                    {showDetail.session?.id
                      ? showDetail.session.id.slice(0, 8) + "..."
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Promo</span>
                  <span className="font-medium text-gray-900">
                    {showDetail.promo
                      ? `${showDetail.promo.name}${showDetail.promo.code ? ` (${showDetail.promo.code})` : ""}`
                      : "—"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block">Status</span>
                  <StatusBadge status={showDetail.status} />
                </div>
              </div>

              {/* Items table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Item Pesanan
                </h3>
                <div className="rounded-lg border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">
                          Produk
                        </th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">
                          Qty
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">
                          Harga Satuan
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">
                          Diskon
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {showDetail.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="px-3 py-2 text-gray-900">
                            {item.product.name}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {formatIDR(item.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right text-green-600">
                            {item.discount > 0
                              ? `- ${formatIDR(item.discount)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {formatIDR(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment info */}
              {showDetail.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Informasi Pembayaran
                  </h3>
                  <div className="space-y-2">
                    {showDetail.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {payment.method}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === "PAID"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {formatIDR(payment.amount)}
                          </div>
                          {payment.change > 0 && (
                            <div className="text-xs text-gray-500">
                              Kembalian: {formatIDR(payment.change)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total summary */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatIDR(showDetail.subtotal)}</span>
                </div>
                {showDetail.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Diskon</span>
                    <span>- {formatIDR(showDetail.discount)}</span>
                  </div>
                )}
                {showDetail.tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Pajak</span>
                    <span>{formatIDR(showDetail.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span>{formatIDR(showDetail.total)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                {showDetail.status === "PENDING" && (
                  <button
                    onClick={() =>
                      handleStatusChange(showDetail.id, "CANCELLED")
                    }
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {actionLoading && (
                      <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    )}
                    Batalkan Pesanan
                  </button>
                )}
                {showDetail.status === "COMPLETED" && (
                  <button
                    onClick={() =>
                      handleStatusChange(showDetail.id, "REFUNDED")
                    }
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {actionLoading && (
                      <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    )}
                    Refund
                  </button>
                )}
                <button
                  onClick={() => setShowDetail(null)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
