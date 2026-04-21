"use client";

import { useState, useEffect, useCallback } from "react";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

type PaymentMethod = "CASH" | "CARD" | "QRIS" | "TRANSFER";
type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

interface Payment {
  id: string;
  createdAt: string;
  method: PaymentMethod;
  amount: number;
  change: number | null;
  reference: string | null;
  status: PaymentStatus;
  order: {
    id: string;
    orderNumber: string;
    total: number;
    cashier: { id: string; name: string } | null;
  };
}

interface Alert {
  message: string;
  type: "success" | "error";
}

const METHOD_BADGE: Record<PaymentMethod, string> = {
  CASH: "bg-green-100 text-green-700",
  CARD: "bg-blue-100 text-blue-700",
  QRIS: "bg-purple-100 text-purple-700",
  TRANSFER: "bg-orange-100 text-orange-700",
};

const STATUS_BADGE: Record<PaymentStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-500",
};

const METHODS: Array<{ label: string; value: PaymentMethod | "" }> = [
  { label: "Semua Metode", value: "" },
  { label: "CASH", value: "CASH" },
  { label: "CARD", value: "CARD" },
  { label: "QRIS", value: "QRIS" },
  { label: "TRANSFER", value: "TRANSFER" },
];

const STATUSES: Array<{ label: string; value: PaymentStatus | "" }> = [
  { label: "Semua Status", value: "" },
  { label: "PENDING", value: "PENDING" },
  { label: "COMPLETED", value: "COMPLETED" },
  { label: "FAILED", value: "FAILED" },
  { label: "REFUNDED", value: "REFUNDED" },
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "">("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  const LIMIT = 20;

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (methodFilter) params.set("method", methodFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/payments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setPayments(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      showAlert("Gagal memuat data pembayaran", "error");
    } finally {
      setLoading(false);
    }
  }, [page, methodFilter, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [methodFilter, statusFilter]);

  // Summary cards — totals by method for current page
  const summaryByMethod = (["CASH", "CARD", "QRIS", "TRANSFER"] as PaymentMethod[]).map(
    (method) => ({
      method,
      total: payments
        .filter((p) => p.method === method && p.status === "COMPLETED")
        .reduce((sum, p) => sum + p.amount, 0),
    })
  );

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Riwayat Pembayaran</h1>

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        {summaryByMethod.map(({ method, total: amt }) => (
          <div key={method} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${METHOD_BADGE[method]}`}
              >
                {method}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatIDR(amt)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total halaman ini</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | "")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
            Memuat data pembayaran...
          </div>
        ) : payments.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Tidak ada data pembayaran
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">No. Order</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Metode</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Jumlah</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Kembalian</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Referensi</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <div>{new Date(p.createdAt).toLocaleDateString("id-ID")}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(p.createdAt).toLocaleTimeString("id-ID")}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                    {p.order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${METHOD_BADGE[p.method]}`}
                    >
                      {p.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.change != null ? formatIDR(p.change) : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {p.reference ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setViewingPayment(p)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Halaman {page} dari {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Detail Pembayaran</h2>
              <button
                onClick={() => setViewingPayment(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">No. Order</p>
                  <p className="font-mono font-semibold text-gray-900">
                    {viewingPayment.order.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Kasir</p>
                  <p className="font-medium text-gray-900">
                    {viewingPayment.order.cashier?.name ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Tanggal</p>
                  <p className="text-gray-900">
                    {new Date(viewingPayment.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Waktu</p>
                  <p className="text-gray-900">
                    {new Date(viewingPayment.createdAt).toLocaleTimeString("id-ID")}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Metode</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${METHOD_BADGE[viewingPayment.method]}`}
                  >
                    {viewingPayment.method}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Order</span>
                  <span className="font-medium">{formatIDR(viewingPayment.order.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Jumlah Bayar</span>
                  <span className="font-bold text-gray-900">
                    {formatIDR(viewingPayment.amount)}
                  </span>
                </div>
                {viewingPayment.change != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Kembalian</span>
                    <span className="font-medium">{formatIDR(viewingPayment.change)}</span>
                  </div>
                )}
                {viewingPayment.reference && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Referensi</span>
                    <span className="font-mono text-xs">{viewingPayment.reference}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-600">Status</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[viewingPayment.status]}`}
                  >
                    {viewingPayment.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setViewingPayment(null)}
                className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
