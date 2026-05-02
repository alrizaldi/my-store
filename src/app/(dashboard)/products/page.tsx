"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Types ------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  category: Category | null;
}

interface Alert {
  message: string;
  type: "success" | "error";
}

type ModalMode = false | "create" | "edit";

// Pagination state
interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---- Types ------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  category: Category | null;
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

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
      }`}
    >
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        {stock}
      </span>
    );
  }
  if (stock <= minStock) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        {stock}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      {stock}
    </span>
  );
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
        dari <span className="font-semibold text-gray-800">{pagination.total}</span> produk
      </div>
      
      <div className="flex flex-wrap items-center space-y-2 sm:space-y-0 sm:space-x-3">
        <div className="flex items-center">
          <span className="mr-2 text-sm text-gray-600">Per halaman:</span>
          <select
            value={pagination.limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[10, 20, 50, 100].map(size => (
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

// ---- Default form state -----------------------------------------------------

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 0,
  imageUrl: "",
};

// =============================================================================

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showModal, setShowModal] = useState<ModalMode>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // ---- Fetch helpers --------------------------------------------------------

  const fetchProducts = useCallback(
    async (q: string, cat: string, page: number, limit: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          showAll: "true",
          page: String(page),
          limit: String(limit),
        });
        if (q) params.set("search", q);
        if (cat) params.set("categoryId", cat);
        const res = await fetch(`/api/products?${params}`);
        const json = await res.json();

        setProducts(Array.isArray(json.data) ? json.data : []);
        setPagination({
          page: json.page,
          limit: json.limit,
          total: json.total,
          totalPages: Math.ceil(json.total / json.limit),
        });
      } catch {
        setAlert({ message: "Gagal memuat produk", type: "error" });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ---- Initial fetch --------------------------------------------------------

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  // ---- Debounced search / filter with pagination -------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      // Reset to first page when search or category changes
      fetchProducts(search, selectedCategory, 1, pagination.limit);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, fetchProducts]);

  // ---- Fetch products when page or limit changes ----------------------------

  useEffect(() => {
    fetchProducts(search, selectedCategory, pagination.page, pagination.limit);
  }, [
    pagination.page,
    pagination.limit,
    search,
    selectedCategory,
    fetchProducts,
  ]);

  // ---- Auto-dismiss alert --------------------------------------------------

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4000);
    return () => clearTimeout(t);
  }, [alert]);

  // ---- Modal helpers --------------------------------------------------------

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowModal("create");
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      categoryId: product.categoryId ?? "",
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      minStock: product.minStock,
      imageUrl: product.imageUrl ?? "",
    });
    setShowModal("edit");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm);
  };

  // ---- Save (create / edit) ------------------------------------------------

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.price) {
      setAlert({ message: "SKU, nama, dan harga wajib diisi", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || null,
        price: form.price,
        cost: form.cost,
        stock: form.stock,
        minStock: form.minStock,
        imageUrl: form.imageUrl.trim() || undefined,
      };

      let res: Response;
      if (showModal === "create") {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/products/${editingProduct!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menyimpan");
      }

      setAlert({
        message:
          showModal === "create"
            ? "Produk berhasil ditambahkan"
            : "Produk berhasil diperbarui",
        type: "success",
      });
      closeModal();
      // Refresh current page after save
      fetchProducts(
        search,
        selectedCategory,
        pagination.page,
        pagination.limit,
      );
    } catch (e) {
      setAlert({
        message: e instanceof Error ? e.message : "Gagal menyimpan",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete (deactivate) -------------------------------------------------

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Nonaktifkan produk "${product.name}"?`)) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menghapus");
      }
      setAlert({ message: "Produk berhasil dinonaktifkan", type: "success" });
      // Refresh current page after delete
      fetchProducts(
        search,
        selectedCategory,
        pagination.page,
        pagination.limit,
      );
    } catch (e) {
      setAlert({
        message: e instanceof Error ? e.message : "Gagal menghapus",
        type: "error",
      });
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page }));
    }
  };

  const handleLimitChange = (limit: number) => {
    setPagination((prev) => ({
      ...prev,
      limit,
      page: 1, // Reset to first page when limit changes
    }));
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
        Manajemen Produk
      </h1>

      {/* Filters + Add button */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Cari produk atau SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Semua Kategori</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          + Tambah Produk
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  SKU
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Nama
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Kategori
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Harga
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  HPP
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">
                  Stok
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
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Tidak ada produk ditemukan
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.category?.name ?? (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatIDR(product.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {formatIDR(product.cost)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge
                        stock={product.stock}
                        minStock={product.minStock}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge isActive={product.isActive} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(product)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        {product.isActive && (
                          <button
                            onClick={() => handleDelete(product)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Nonaktifkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <PaginationControls 
          pagination={pagination} 
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {showModal === "create" ? "Tambah Produk" : "Edit Produk"}
              </h2>
              <button
                onClick={closeModal}
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

            <div className="px-6 py-4 space-y-4">
              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sku: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: PRD-001"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama produk"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Deskripsi produk (opsional)"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— Tanpa Kategori —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price + Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Harga Jual <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    min={0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HPP
                  </label>
                  <input
                    type="number"
                    value={form.cost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cost: e.target.value }))
                    }
                    min={0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Stock + Min Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stok
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stock: e.target.value }))
                    }
                    min={0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stok Minimum
                  </label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, minStock: e.target.value }))
                    }
                    min={0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5"
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Gambar
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
