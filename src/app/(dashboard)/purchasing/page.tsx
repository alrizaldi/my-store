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

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Pagination controls component
function PaginationControls({
  pagination,
  onPageChange,
  onLimitChange
}: {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const pageNumbers = [];
  const delta = 2; // How many pages to show around current page

  // First page
  if (pagination.page > delta + 1) {
    pageNumbers.push(1);
    if (pagination.page > delta + 2) {
      pageNumbers.push(-1); // Ellipsis indicator
    }
  }

  // Pages around current page
  for (let i = Math.max(1, pagination.page - delta); i <= Math.min(pagination.totalPages, pagination.page + delta); i++) {
    pageNumbers.push(i);
  }

  // Last page
  if (pagination.page < pagination.totalPages - delta) {
    if (pagination.page < pagination.totalPages - delta - 1) {
      pageNumbers.push(-1); // Ellipsis indicator
    }
    pageNumbers.push(pagination.totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 px-4 border-t border-gray-200 bg-gray-50/50">
      <div className="text-sm text-gray-600 mb-3 sm:mb-0">
        Menampilkan <span className="font-semibold text-gray-800">{(pagination.page - 1) * pagination.limit + 1}</span> hingga{" "}
        <span className="font-semibold text-gray-800">
          {Math.min(pagination.page * pagination.limit, pagination.total)}
        </span>{" "}
        dari <span className="font-semibold text-gray-800">{pagination.total}</span> item
      </div>
      
      <div className="flex flex-wrap items-center space-y-2 sm:space-y-0 sm:space-x-3">
        <div className="flex items-center">
          <span className="mr-2 text-sm text-gray-600">Per halaman:</span>
          <select
            value={pagination.limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[10, 20, 30, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pagination.page === 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
            }`}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Sebelumnya
          </button>
          
          <div className="flex items-center space-x-1 mx-1">
            {pageNumbers.map((num, idx) => (
              num === -1 ? (
                <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={num}
                  onClick={() => onPageChange(num)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    num === pagination.page
                      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {num}
                </button>
              )
            ))}
          </div>
          
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pagination.page === pagination.totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
            }`}
          >
            Berikutnya
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
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
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

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

  const fetchOrders = useCallback(async (page: number, limit: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page), 
        limit: String(limit) 
      });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/purchasing?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setOrders(json.data ?? []);
      setPagination({
        page: json.page,
        limit: json.limit,
        total: json.total,
        totalPages: Math.ceil(json.total / json.limit),
      });
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
    fetchFormData();
  }, [fetchFormData]);

  useEffect(() => {
    // Reset to first page when status filter changes
    fetchOrders(1, pagination.limit);
  }, [statusFilter, fetchOrders, pagination.limit]);

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
      fetchOrders(pagination.page, pagination.limit);
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
      fetchOrders(pagination.page, pagination.limit);
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

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page }));
    }
  };

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({ 
      ...prev, 
      limit,
      page: 1  // Reset to first page when limit changes
    }));
  };

  // Trigger fetch when pagination changes
  useEffect(() => {
    fetchOrders(pagination.page, pagination.limit);
  }, [pagination.page, pagination.limit, fetchOrders]);

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
          <>
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
            
            {/* Pagination Controls */}
            <PaginationControls 
              pagination={pagination} 
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          </>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Item Pembelian</label>
                  <div className="space-y-3">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <select
                            value={item.productId}
                            onChange={(e) => updateItem(idx, "productId", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Pilih Produk</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Qty"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Harga"
                          />
                        </div>
                        <div className="col-span-2">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="w-full border border-red-300 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="mt-2 text-blue-600 text-sm hover:text-blue-800"
                  >
                    + Tambah Item
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium">
                      {formatIDR(subtotal)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pajak (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formTax}
                      onChange={(e) => setFormTax(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Pajak (%)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pajak</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium">
                      {formatIDR(taxAmount)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium font-semibold">
                      {formatIDR(total)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Catatan tambahan (opsional)"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Detail Purchase Order</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Informasi Umum</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="w-32 text-gray-500">No. PO</span>
                      <span className="font-medium">{editingOrder.poNumber}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-gray-500">Tanggal</span>
                      <span className="font-medium">
                        {new Date(editingOrder.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-gray-500">Supplier</span>
                      <span className="font-medium">{editingOrder.supplier.name}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-gray-500">Status</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[editingOrder.status]}`}
                      >
                        {editingOrder.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Jumlah</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium">{formatIDR(editingOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pajak</span>
                      <span className="font-medium">{formatIDR(editingOrder.tax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-semibold">{formatIDR(editingOrder.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Daftar Item</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">Produk</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Harga</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingOrder.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.product.name}</div>
                          <div className="text-xs text-gray-500">{item.product.sku}</div>
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatIDR(item.unitCost)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatIDR(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editingOrder.notes && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Catatan</h3>
                  <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {editingOrder.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Tutup
              </button>
              {editingOrder.status === "ORDERED" && (
                <button
                  onClick={() => markReceived(editingOrder.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
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