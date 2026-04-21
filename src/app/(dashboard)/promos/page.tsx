"use client";

import { useState, useEffect, useCallback } from "react";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

type PromoType = "PERCENTAGE" | "FIXED";

interface Promo {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  type: PromoType;
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count: { orders: number };
}

interface Alert {
  message: string;
  type: "success" | "error";
}

interface PromoForm {
  name: string;
  description: string;
  code: string;
  type: PromoType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const emptyForm: PromoForm = {
  name: "",
  description: "",
  code: "",
  type: "PERCENTAGE",
  value: "",
  minOrder: "",
  maxDiscount: "",
  startDate: "",
  endDate: "",
  isActive: true,
};

function formatPromoValue(promo: Promo): string {
  if (promo.type === "PERCENTAGE") return `${promo.value}%`;
  return formatIDR(promo.value);
}

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [validationError, setValidationError] = useState("");

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promos?limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setPromos(json.data ?? []);
    } catch {
      showAlert("Gagal memuat daftar promo", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const openCreate = () => {
    setEditingPromo(null);
    setForm(emptyForm);
    setValidationError("");
    setShowModal(true);
  };

  const openEdit = (promo: Promo) => {
    setEditingPromo(promo);
    setForm({
      name: promo.name,
      description: promo.description ?? "",
      code: promo.code ?? "",
      type: promo.type,
      value: String(promo.value),
      minOrder: promo.minOrder != null ? String(promo.minOrder) : "",
      maxDiscount: promo.maxDiscount != null ? String(promo.maxDiscount) : "",
      startDate: promo.startDate.slice(0, 10),
      endDate: promo.endDate.slice(0, 10),
      isActive: promo.isActive,
    });
    setValidationError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPromo(null);
    setForm(emptyForm);
    setValidationError("");
  };

  const validate = (): boolean => {
    const val = parseFloat(form.value);
    if (!form.name.trim()) {
      setValidationError("Nama promo wajib diisi");
      return false;
    }
    if (!form.value || isNaN(val) || val <= 0) {
      setValidationError("Nilai promo harus lebih dari 0");
      return false;
    }
    if (form.type === "PERCENTAGE" && (val < 1 || val > 100)) {
      setValidationError("Nilai persentase harus antara 1-100");
      return false;
    }
    if (!form.startDate) {
      setValidationError("Tanggal mulai wajib diisi");
      return false;
    }
    if (!form.endDate) {
      setValidationError("Tanggal akhir wajib diisi");
      return false;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setValidationError("Tanggal akhir tidak boleh sebelum tanggal mulai");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || undefined,
        code: form.code || undefined,
        type: form.type,
        value: parseFloat(form.value),
        minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive,
      };
      let res: Response;
      if (editingPromo) {
        res = await fetch(`/api/promos/${editingPromo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/promos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menyimpan");
      }
      showAlert(editingPromo ? "Promo berhasil diperbarui" : "Promo berhasil dibuat", "success");
      closeModal();
      fetchPromos();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal menyimpan promo", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (promo: Promo) => {
    if (!window.confirm(`Hapus promo "${promo.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/promos/${promo.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menghapus");
      }
      showAlert("Promo berhasil dihapus", "success");
      fetchPromos();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal menghapus promo", "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Promo</h1>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Tambah Promo
        </button>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
            Memuat data promo...
          </div>
        ) : promos.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Belum ada promo
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Kode</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Tipe</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Nilai</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Min. Order</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Periode</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  Digunakan
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-gray-400 truncate max-w-xs">{p.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.code ? (
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {p.code}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.type === "PERCENTAGE"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {p.type === "PERCENTAGE" ? "PERSEN" : "NOMINAL"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatPromoValue(p)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.minOrder != null ? formatIDR(p.minOrder) : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <div className="text-xs">
                      {new Date(p.startDate).toLocaleDateString("id-ID")}
                    </div>
                    <div className="text-xs text-gray-400">
                      s/d {new Date(p.endDate).toLocaleDateString("id-ID")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{p._count.orders}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => openEdit(p)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPromo ? "Edit Promo" : "Tambah Promo"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {validationError && (
                  <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm">
                    {validationError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama promo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Deskripsi singkat (opsional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kode Kupon
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Opsional, harus unik"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipe <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as PromoType })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PERCENTAGE">PERCENTAGE (%)</option>
                      <option value="FIXED">FIXED (Rp)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nilai <span className="text-red-500">*</span>
                      {form.type === "PERCENTAGE" && (
                        <span className="text-gray-400 font-normal"> (1-100)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={form.type === "PERCENTAGE" ? "100" : undefined}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={form.type === "PERCENTAGE" ? "Contoh: 10" : "Contoh: 5000"}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min. Order (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.minOrder}
                      onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Opsional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maks. Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.maxDiscount}
                      onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Opsional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Mulai <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Akhir <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded"
                    />
                    Promo Aktif
                  </label>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : editingPromo ? "Perbarui" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
