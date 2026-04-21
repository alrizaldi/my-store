"use client";

import { useState, useEffect, useCallback } from "react";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

type POStatus = "PENDING" | "ORDERED" | "RECEIVED" | "CANCELLED";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  cost: number;
}

interface POItem {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  total: number;
  product: { id: string; name: string; sku: string };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  createdAt: string;
  status: POStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  supplier: Supplier;
  items: POItem[];
}

interface FormItem {
  productId: string;
  quantity: string;
  unitCost: string;
}

interface Alert {
  message: string;
  type: "success" | "error";
}

const STATUS_BADGE: Record<POStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  ORDERED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function PurchasingPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<POStatus | "">("");
  const [showModal, setShowModal] = useState<false | "create" | "view">(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [formSupplier, setFormSupplier] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([
    { productId: "", quantity: "", unitCost: "" },
  ]);
  const [formTax, setFormTax] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/purchasing?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setOrders(json.data ?? []);
    } catch {
      showAlert("Gagal memuat purchase order", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchFormData = useCallback(async () => {
    try {
      const [suppRes, prodRes] = await Promise.all([
        fetch("/api/suppliers?isActive=true&limit=100"),
        fetch("/api/products?showAll=true&limit=100"),
      ]);
      if (suppRes.ok) {
        const s = await suppRes.json();
        setSuppliers(s.data ?? []);
      }
      if (prodRes.ok) {
        const p = await prodRes.json();
        setProducts(p.data ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  const openCreate = () => {
    setFormSupplier("");
    setFormItems([{ productId: "", quantity: "", unitCost: "" }]);
    setFormTax("");
    setFormNotes("");
    setShowModal("create");
  };

  const openView = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setShowModal("view");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOrder(null);
  };

  const addItem = () => {
    setFormItems([...formItems, { productId: "", quantity: "", unitCost: "" }]);
  };

  const removeItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof FormItem, value: string) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-fill unit cost from product
    if (field === "productId" && value) {
      const prod = products.find((p) => p.id === value);
      if (prod) updated[idx].unitCost = String(prod.cost);
    }
    setFormItems(updated);
  };

  const calcSubtotal = () =>
    formItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.unitCost) || 0;
      return sum + qty * cost;
    }, 0);

  const calcTax = () => {
    const taxPct = parseFloat(formTax) || 0;
    return (calcSubtotal() * taxPct) / 100;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplier) {
      showAlert("Pilih supplier terlebih dahulu", "error");
      return;
    }
    const items = formItems
      .filter((i) => i.productId && i.quantity && i.unitCost)
      .map((i) => ({
        productId: i.productId,
        quantity: parseInt(i.quantity, 10),
        unitCost: parseFloat(i.unitCost),
      }));
    if (items.length === 0) {
      showAlert("Tambahkan minimal satu item", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: formSupplier,
          items,
          tax: parseFloat(formTax) || undefined,
          notes: formNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal membuat PO");
      }
      showAlert("Purchase order berhasil dibuat", "success");
      closeModal();
      fetchOrders();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal membuat purchase order", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const markReceived = async (id: string) => {
    if (!window.confirm("Tandai purchase order ini sebagai DITERIMA?")) return;
    try {
      const res = await fetch(`/api/purchasing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RECEIVED" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal memperbarui status");
      }
      showAlert("Status berhasil diperbarui ke DITERIMA", "success");
      closeModal();
      fetchOrders();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal memperbarui status", "error");
    }
  };

  const subtotal = calcSubtotal();
  const taxAmount = calcTax();
  const total = subtotal + taxAmount;

  const statusButtons: Array<{ label: string; value: POStatus | "" }> = [
    { label: "Semua", value: "" },
    { label: "PENDING", value: "PENDING" },
    { label: "ORDERED", value: "ORDERED" },
    { label: "RECEIVED", value: "RECEIVED" },
    { label: "CANCELLED", value: "CANCELLED" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Order</h1>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Buat PO
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

      {/* Status Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
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
            Memuat purchase orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Tidak ada purchase order ditemukan
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">No. PO</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Supplier</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Items</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Subtotal</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Pajak</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Total</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                    {o.poNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(o.createdAt).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{o.supplier.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{o.items.length}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatIDR(o.subtotal)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatIDR(o.tax)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(o.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[o.status]}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => openView(o)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                      >
                        Lihat
                      </button>
                      {o.status === "ORDERED" && (
                        <button
                          onClick={() => markReceived(o.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                        >
                          Diterima
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showModal === "create" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Buat Purchase Order</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Items</label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-blue-600 text-sm hover:text-blue-700 font-medium"
                    >
                      + Tambah Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formItems.map((item, idx) => {
                      const qty = parseFloat(item.quantity) || 0;
                      const cost = parseFloat(item.unitCost) || 0;
                      const lineTotal = qty * cost;
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-lg"
                        >
                          <div className="col-span-5">
                            <select
                              value={item.productId}
                              onChange={(e) => updateItem(idx, "productId", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Pilih Produk</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                              placeholder="Qty"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              value={item.unitCost}
                              onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                              placeholder="Harga Satuan"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-1 text-right text-xs text-gray-500">
                            {lineTotal > 0 ? formatIDR(lineTotal) : "-"}
                          </div>
                          <div className="col-span-1 text-center">
                            {formItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pajak (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formTax}
                      onChange={(e) => setFormTax(e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal:</span>
                        <span>{formatIDR(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Pajak:</span>
                        <span>{formatIDR(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                        <span>Total:</span>
                        <span>{formatIDR(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    placeholder="Opsional"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
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
                  {submitting ? "Menyimpan..." : "Buat PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showModal === "view" && editingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Detail PO — {editingOrder.poNumber}
                </h2>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[editingOrder.status]}`}
                >
                  {editingOrder.status}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Supplier:</span>
                  <p className="font-medium text-gray-900">{editingOrder.supplier.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tanggal:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(editingOrder.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Items</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">Produk</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Harga Satuan
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingOrder.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-3 py-2 text-gray-900">{item.product.name}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {formatIDR(item.unitCost)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          {formatIDR(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatIDR(editingOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Pajak</span>
                  <span>{formatIDR(editingOrder.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-2">
                  <span>Total</span>
                  <span>{formatIDR(editingOrder.total)}</span>
                </div>
              </div>

              {editingOrder.notes && (
                <div>
                  <span className="text-sm text-gray-500">Catatan:</span>
                  <p className="text-sm text-gray-700 mt-1">{editingOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Tutup
              </button>
              {(editingOrder.status === "PENDING" || editingOrder.status === "ORDERED") && (
                <button
                  onClick={() => markReceived(editingOrder.id)}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                >
                  Tandai Diterima
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
