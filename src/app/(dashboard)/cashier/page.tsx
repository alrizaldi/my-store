"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

interface CashierSession {
  id: string;
  status: "OPEN" | "CLOSED";
  startCash: number;
  endCash: number | null;
  openedAt: string;
  summary?: {
    totalOrders: number;
    totalRevenue: number;
    startCash: number;
    expectedCash: number;
    payments: {
      cash: number;
      card: number;
      qris: number;
      transfer: number;
    };
  };
}

interface Alert {
  message: string;
  type: "success" | "error";
}

export default function CashierDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<CashierSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [startCash, setStartCash] = useState("");
  const [alert, setAlert] = useState<Alert | null>(null);

  // State for closing session
  const [closing, setClosing] = useState(false);
  const [endCash, setEndCash] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchOpenSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions?status=OPEN&limit=1");
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const sessionId = json.data[0].id;
        const detailRes = await fetch(`/api/sessions/${sessionId}`);
        const detail = await detailRes.json();
        setSession(detail);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and refresh when returning from POS
  useEffect(() => {
    fetchOpenSession();
  }, [fetchOpenSession]);

  // Refresh when page becomes visible (user returns from POS)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchOpenSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchOpenSession]);

  const openSession = async () => {
    const parsed = parseFloat(startCash);
    if (!startCash || isNaN(parsed) || parsed < 0) {
      showAlert("Masukkan jumlah kas awal yang valid", "error");
      return;
    }
    setOpening(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startCash: parsed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal membuka sesi");
      }
      showAlert("Sesi berhasil dibuka", "success");
      fetchOpenSession();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal membuka sesi", "error");
    } finally {
      setOpening(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    const parsed = parseFloat(endCash);
    if (!endCash || isNaN(parsed) || parsed < 0) {
      showAlert("Masukkan jumlah kas akhir yang valid", "error");
      return;
    }
    setClosing(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED", endCash: parsed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menutup sesi");
      }
      showAlert("Sesi berhasil ditutup", "success");
      setShowCloseModal(false);
      setEndCash("");
      fetchOpenSession();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal menutup sesi", "error");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-gray-400">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Kasir</h1>

      {alert && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            alert.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {alert.message}
        </div>
      )}

      {session ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Status Sesi</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-semibold text-gray-900">BUKA</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Kas Awal</p>
                <p className="font-semibold text-gray-900">
                  {formatIDR(session.startCash)}
                </p>
              </div>
            </div>

            {session.summary && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Total Order</p>
                  <p className="text-xl font-bold text-gray-900">
                    {session.summary.totalOrders}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Total Pendapatan</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatIDR(session.summary.totalRevenue)}
                  </p>
                </div>
              </div>
            )}

            {session.summary && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-2">
                  Rincian Pembayaran
                </p>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-gray-500">Cash</p>
                    <p className="font-semibold text-gray-900">
                      {formatIDR(session.summary.payments.cash)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Card</p>
                    <p className="font-semibold text-gray-900">
                      {formatIDR(session.summary.payments.card)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">QRIS</p>
                    <p className="font-semibold text-gray-900">
                      {formatIDR(session.summary.payments.qris)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Transfer</p>
                    <p className="font-semibold text-gray-900">
                      {formatIDR(session.summary.payments.transfer)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/cashier/pos")}
              className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
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
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              Buka Kasir / POS
            </button>

            {/* Close Session Button */}
            <button
              onClick={() => {
                setEndCash(session.summary?.expectedCash?.toString() || "");
                setShowCloseModal(true);
              }}
              className="w-full mt-2 py-3 bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Tutup Sesi
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-900">Belum Ada Sesi Aktif</h2>
            <p className="text-sm text-gray-500 mt-1">
              Buka sesi terlebih dahulu untuk mulai transaksi
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kas Awal (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={startCash}
              onChange={(e) => setStartCash(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Masukkan jumlah kas awal"
            />
          </div>

          <button
            onClick={openSession}
            disabled={opening}
            className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
{opening ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Membuka Sesi...
              </>
            ) : (
              <>
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Buka Sesi Kasir
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  // Close Session Modal
  if (showCloseModal && session) {
    const sess = session as NonNullable<CashierSession>;
    const expectedCash = sess.summary?.expectedCash || 0;
    const actualEndCash = parseFloat(endCash) || 0;
    const variance = actualEndCash - expectedCash;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tutup Sesi Kasir</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Kas Awal</span>
                <span className="font-medium">{formatIDR(sess.startCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Kas Diterima (Cash)</span>
                <span className="font-medium">{formatIDR(sess.summary?.payments?.cash || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-700 font-medium">Expected Kas Akhir</span>
                <span className="font-bold text-orange-600">{formatIDR(expectedCash)}</span>
              </div>
            </div>

            <div className="text-sm">
              <p className="text-gray-500 font-medium mb-2">Rincian Pembayaran</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-gray-500 text-xs">Cash</p>
                  <p className="font-semibold">{formatIDR(sess.summary?.payments?.cash || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-xs">Card</p>
                  <p className="font-semibold">{formatIDR(sess.summary?.payments?.card || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-xs">QRIS</p>
                  <p className="font-semibold">{formatIDR(sess.summary?.payments?.qris || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-xs">Transfer</p>
                  <p className="font-semibold">{formatIDR(sess.summary?.payments?.transfer || 0)}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kas Akhir Sebenarnya <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={endCash}
                onChange={(e) => setEndCash(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Masukkan jumlah kas akhir"
              />
            </div>

            {endCash && actualEndCash > 0 && (
              <div className={`p-3 rounded-lg border ${
                variance === 0 ? "bg-green-50 border-green-200" : 
                variance > 0 ? "bg-blue-50 border-blue-200" : 
                "bg-red-50 border-red-200"
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Selisih</span>
                  <span className={`font-bold ${
                    variance === 0 ? "text-green-600" : variance > 0 ? "text-blue-600" : "text-red-600"
                  }`}>
                    {variance === 0 ? "Sesuai" : formatIDR(variance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={() => { setShowCloseModal(false); setEndCash(""); }}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleCloseSession}
              disabled={closing || !endCash}
              className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {closing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : "Tutup Sesi"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}