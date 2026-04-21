"use client";

import { useState, useEffect, useCallback } from "react";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

type SessionStatus = "OPEN" | "CLOSED";

interface CashierSession {
  id: string;
  openedAt: string;
  closedAt: string | null;
  startCash: number;
  endCash: number | null;
  status: SessionStatus;
  cashier: { id: string; name: string };
  _count: { orders: number };
}

interface SessionSummary {
  totalOrders: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalQris: number;
}

interface SessionDetail extends CashierSession {
  summary: SessionSummary;
}

interface Alert {
  message: string;
  type: "success" | "error";
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<CashierSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "">("");
  const [viewingSession, setViewingSession] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [endCash, setEndCash] = useState("");
  const [closingSession, setClosingSession] = useState(false);

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/sessions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setSessions(json.data ?? []);
    } catch {
      showAlert("Gagal memuat data sesi kasir", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const openView = async (session: CashierSession) => {
    setEndCash("");
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const detail = await res.json();
      setViewingSession(detail);
    } catch {
      showAlert("Gagal memuat detail sesi", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setViewingSession(null);
    setEndCash("");
  };

  const handleCloseSession = async () => {
    if (!viewingSession) return;
    const parsed = parseFloat(endCash);
    if (!endCash || isNaN(parsed) || parsed < 0) {
      showAlert("Masukkan jumlah kas akhir yang valid", "error");
      return;
    }
    if (
      !window.confirm(
        `Tutup sesi kasir ${viewingSession.cashier.name}? Tindakan ini tidak dapat dibatalkan.`
      )
    )
      return;
    setClosingSession(true);
    try {
      const res = await fetch(`/api/sessions/${viewingSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED", endCash: parsed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menutup sesi");
      }
      showAlert("Sesi berhasil ditutup", "success");
      closeModal();
      fetchSessions();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal menutup sesi", "error");
    } finally {
      setClosingSession(false);
    }
  };

  const statusButtons: Array<{ label: string; value: SessionStatus | "" }> = [
    { label: "Semua", value: "" },
    { label: "OPEN", value: "OPEN" },
    { label: "CLOSED", value: "CLOSED" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sesi Kasir</h1>

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

      {/* Status Filter */}
      <div className="flex gap-2 mb-5">
        {statusButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setStatusFilter(btn.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === btn.value
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
            Memuat data sesi...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Tidak ada sesi ditemukan
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Kasir</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Dibuka</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Ditutup</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Kas Awal</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Kas Akhir</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  Jumlah Order
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.cashier.name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <div>{new Date(s.openedAt).toLocaleDateString("id-ID")}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(s.openedAt).toLocaleTimeString("id-ID")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {s.closedAt ? (
                      <>
                        <div>{new Date(s.closedAt).toLocaleDateString("id-ID")}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(s.closedAt).toLocaleTimeString("id-ID")}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatIDR(s.startCash)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {s.endCash != null ? formatIDR(s.endCash) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{s._count.orders}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        s.status === "OPEN"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openView(s)}
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

      {/* Detail / Loading overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-sm text-gray-600">Memuat detail sesi...</div>
        </div>
      )}

      {/* View Modal */}
      {viewingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Detail Sesi — {viewingSession.cashier.name}
                </h2>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    viewingSession.status === "OPEN"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {viewingSession.status}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Dibuka</p>
                  <p className="text-gray-900">
                    {new Date(viewingSession.openedAt).toLocaleDateString("id-ID")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(viewingSession.openedAt).toLocaleTimeString("id-ID")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Ditutup</p>
                  {viewingSession.closedAt ? (
                    <>
                      <p className="text-gray-900">
                        {new Date(viewingSession.closedAt).toLocaleDateString("id-ID")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(viewingSession.closedAt).toLocaleTimeString("id-ID")}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-gray-700 mb-3">Ringkasan Sesi</h3>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Order</span>
                  <span className="font-medium">{viewingSession.summary.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Pendapatan</span>
                  <span className="font-bold text-gray-900">
                    {formatIDR(viewingSession.summary.totalRevenue)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 space-y-1">
                  <p className="text-xs text-gray-500 font-medium mb-1">Breakdown Pembayaran</p>
                  <div className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      Cash
                    </span>
                    <span>{formatIDR(viewingSession.summary.totalCash)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                      Card
                    </span>
                    <span>{formatIDR(viewingSession.summary.totalCard)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                      QRIS
                    </span>
                    <span>{formatIDR(viewingSession.summary.totalQris)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Kas Awal</p>
                  <p className="font-medium text-gray-900">
                    {formatIDR(viewingSession.startCash)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Kas Akhir</p>
                  <p className="font-medium text-gray-900">
                    {viewingSession.endCash != null ? formatIDR(viewingSession.endCash) : "-"}
                  </p>
                </div>
              </div>

              {/* Close Session Form */}
              {viewingSession.status === "OPEN" && (
                <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-orange-800">Tutup Sesi</p>
                  <div>
                    <label className="block text-xs font-medium text-orange-700 mb-1">
                      Jumlah Kas Akhir (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={endCash}
                      onChange={(e) => setEndCash(e.target.value)}
                      className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      placeholder="Masukkan jumlah kas akhir"
                    />
                  </div>
                  <button
                    onClick={handleCloseSession}
                    disabled={closingSession}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
                  >
                    {closingSession ? "Menutup Sesi..." : "Tutup Sesi Sekarang"}
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={closeModal}
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
