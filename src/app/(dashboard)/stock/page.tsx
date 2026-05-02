"use client";

import { useState, useEffect, useCallback } from "react";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "RETURN";

interface Category {
  id: string;
  name: string;
}

interface StockProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  category: Category | null;
}

interface StockMovement {
  id: string;
  createdAt: string;
  type: MovementType;
  quantity: number;
  notes: string | null;
  product: { id: string; name: string; sku: string };
}

interface Alert {
  message: string;
  type: "success" | "error";
}

interface AdjustForm {
  productId: string;
  productName: string;
  type: MovementType;
  quantity: string;
  notes: string;
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

const MOVEMENT_BADGE: Record<MovementType, string> = {
  IN: "bg-green-100 text-green-800",
  OUT: "bg-red-100 text-red-800",
  ADJUSTMENT: "bg-blue-100 text-blue-800",
  RETURN: "bg-yellow-100 text-yellow-800",
};

export default function StockPage() {
  const [tab, setTab] = useState<"levels" | "movements">("levels");

  // Stock Levels state
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  
  // Stock Levels Pagination
  const [productsPagination, setProductsPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Movements state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  
  // Movements Pagination
  const [movementsPagination, setMovementsPagination] = useState<PaginationState>({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 0,
  });

  // Adjust modal
  const [adjustForm, setAdjustForm] = useState<AdjustForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) return;
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  const fetchProducts = useCallback(async (page: number, limit: number) => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page), 
        limit: String(limit) 
      });
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);
      if (lowStockOnly) params.set("lowStock", "true");
      const res = await fetch(`/api/stock?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setProducts(json.data ?? []);
      setProductsPagination({
        page: json.page,
        limit: json.limit,
        total: json.total,
        totalPages: Math.ceil(json.total / json.limit),
      });
    } catch {
      showAlert("Gagal memuat data stok", "error");
    } finally {
      setLoadingProducts(false);
    }
  }, [search, categoryId, lowStockOnly]);

  const fetchMovements = useCallback(async (page: number, limit: number) => {
    setLoadingMovements(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page), 
        limit: String(limit) 
      });
      const res = await fetch(`/api/stock/movements?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setMovements(json.data ?? []);
      setMovementsPagination({
        page: json.page,
        limit: json.limit,
        total: json.total,
        totalPages: Math.ceil(json.total / json.limit),
      });
    } catch {
      showAlert("Gagal memuat riwayat pergerakan stok", "error");
    } finally {
      setLoadingMovements(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (tab === "levels") {
      fetchProducts(productsPagination.page, productsPagination.limit);
    }
  }, [tab, productsPagination.page, productsPagination.limit, fetchProducts]);

  useEffect(() => {
    if (tab === "movements") {
      fetchMovements(movementsPagination.page, movementsPagination.limit);
    }
  }, [tab, movementsPagination.page, movementsPagination.limit, fetchMovements]);

  // Handle search/filter changes - reset to first page
  useEffect(() => {
    if (tab === "levels") {
      fetchProducts(1, productsPagination.limit);
    }
  }, [search, categoryId, lowStockOnly, tab, fetchProducts, productsPagination.limit]);

  const openAdjustModal = (product: StockProduct) => {
    setAdjustForm({
      productId: product.id,
      productName: product.name,
      type: "IN",
      quantity: "",
      notes: "",
    });
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm) return;
    const qty = parseInt(adjustForm.quantity, 10);
    if (!qty || qty <= 0) {
      showAlert("Kuantitas harus lebih dari 0", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustForm.productId,
          type: adjustForm.type,
          quantity: qty,
          notes: adjustForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menyimpan");
      }
      showAlert("Stok berhasil diperbarui", "success");
      setAdjustForm(null);
      fetchProducts(productsPagination.page, productsPagination.limit);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Gagal menyimpan pergerakan stok", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const stockColor = (product: StockProduct) => {
    if (product.stock === 0) return "text-red-600 font-bold";
    if (product.stock <= product.minStock) return "text-orange-500 font-semibold";
    return "text-green-600 font-semibold";
  };

  // Pagination handlers
  const handleProductsPageChange = (page: number) => {
    if (page >= 1 && page <= productsPagination.totalPages) {
      setProductsPagination(prev => ({ ...prev, page }));
    }
  };

  const handleProductsLimitChange = (limit: number) => {
    setProductsPagination(prev => ({ 
      ...prev, 
      limit,
      page: 1  // Reset to first page when limit changes
    }));
  };

  const handleMovementsPageChange = (page: number) => {
    if (page >= 1 && page <= movementsPagination.totalPages) {
      setMovementsPagination(prev => ({ ...prev, page }));
    }
  };

  const handleMovementsLimitChange = (limit: number) => {
    setMovementsPagination(prev => ({ 
      ...prev, 
      limit,
      page: 1  // Reset to first page when limit changes
    }));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Manajemen Stok</h1>

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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["levels", "movements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t
                ? "bg-white border border-b-white border-gray-200 text-blue-600 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "levels" ? "Level Stok" : "Pergerakan Stok"}
          </button>
        ))}
      </div>

      {tab === "levels" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Cari produk / SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="rounded"
              />
              Stok Rendah Saja
            </label>
            <button
              onClick={() => fetchProducts(1, productsPagination.limit)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              Cari
            </button>
          </div>

          {/* Stock Levels Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
                Memuat data stok...
              </div>
            ) : products.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                Tidak ada produk ditemukan
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">SKU</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Produk</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Kategori</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Stok</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Min. Stok</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Harga Modal</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Harga Jual</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.sku}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-gray-600">{p.category?.name ?? "-"}</td>
                        <td className={`px-4 py-3 text-right ${stockColor(p)}`}>{p.stock}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{p.minStock}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatIDR(p.cost)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatIDR(p.price)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openAdjustModal(p)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                          >
                            Sesuaikan Stok
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <PaginationControls 
                  pagination={productsPagination} 
                  onPageChange={handleProductsPageChange}
                  onLimitChange={handleProductsLimitChange}
                />
              </>
            )}
          </div>
        </>
      )}

      {tab === "movements" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loadingMovements ? (
            <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
              Memuat riwayat pergerakan...
            </div>
          ) : movements.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Belum ada pergerakan stok
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Tanggal/Waktu</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Produk</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Tipe</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Kuantitas</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div>{new Date(m.createdAt).toLocaleDateString("id-ID")}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(m.createdAt).toLocaleTimeString("id-ID")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{m.product.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{m.product.sku}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${MOVEMENT_BADGE[m.type]}`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {m.quantity}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                        {m.notes ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination Controls */}
              <PaginationControls 
                pagination={movementsPagination} 
                onPageChange={handleMovementsPageChange}
                onLimitChange={handleMovementsLimitChange}
              />
            </>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Sesuaikan Stok</h2>
              <button
                onClick={() => setAdjustForm(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produk</label>
                <input
                  type="text"
                  value={adjustForm.productName}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, type: e.target.value as MovementType })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="IN">IN — Barang Masuk</option>
                  <option value="OUT">OUT — Barang Keluar</option>
                  <option value="ADJUSTMENT">ADJUSTMENT — Sesuaikan ke Nilai</option>
                  <option value="RETURN">RETURN — Barang Retur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kuantitas <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan kuantitas"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opsional"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustForm(null)}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}