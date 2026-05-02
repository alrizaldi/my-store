import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDashboardData, type DashboardData } from "@/lib/dashboardService";

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
};

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Refund",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-100 text-gray-600",
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth-token");
  
  let data: DashboardData | null = null;
  let error: string | null = null;

  try {
    // Verify authentication first
    if (!authToken?.value) {
      throw new Error("No authentication token found");
    }

    const payload = await verifyToken(authToken.value);
    if (!payload) {
      throw new Error("Invalid or expired token");
    }

    // Get dashboard data directly using the service function
    data = await getDashboardData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Gagal memuat data dashboard";
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <p className="text-red-600 font-medium">Gagal memuat data</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.salesByDay.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Ringkasan performa toko hari ini</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Today's Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Pesanan Hari Ini</span>
            <span className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.today.orders}</p>
          <p className="text-xs text-gray-400 mt-1">{data.today.customers} transaksi total</p>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Pendapatan Hari Ini</span>
            <span className="p-2 bg-green-50 rounded-lg text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatIDR(data.today.revenue)}</p>
          <p className="text-xs text-gray-400 mt-1">dari pesanan selesai</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Pendapatan Bulan Ini</span>
            <span className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatIDR(data.month.revenue)}</p>
          <p className="text-xs text-gray-400 mt-1">{data.month.orders} pesanan bulan ini</p>
        </div>

        {/* Low Stock */}
        <div className={`bg-white rounded-xl shadow-sm border p-5 ${data.totals.lowStockProducts > 0 ? "border-red-200" : "border-gray-100"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Stok Menipis</span>
            <span className={`p-2 rounded-lg ${data.totals.lowStockProducts > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <p className={`text-3xl font-bold ${data.totals.lowStockProducts > 0 ? "text-red-600" : "text-gray-900"}`}>
            {data.totals.lowStockProducts}
          </p>
          <p className="text-xs text-gray-400 mt-1">produk perlu restock</p>
        </div>
      </div>

      {/* Sales Bar Chart + Recent Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Sales Bar Chart */}
        <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Penjualan 7 Hari Terakhir</h2>
          <div className="flex items-end gap-2 h-40">
            {data.salesByDay.map((day) => {
              const heightPct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex items-end justify-center" style={{ height: "120px" }}>
                    <div
                      className="w-full bg-blue-500 rounded-t-md transition-all group-hover:bg-blue-600"
                      style={{ height: `${Math.max(heightPct, day.revenue > 0 ? 4 : 0)}%` }}
                      title={`${formatIDR(day.revenue)}\n${day.orders} pesanan`}
                    />
                  </div>
                  <span className="text-xs text-gray-400 mt-1">
                    {new Date(day.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Pesanan Terbaru</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pl-5 pr-4">No. Pesanan</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pr-4">Kasir</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pr-4">Total</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pr-4">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pr-5">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-500">Belum ada pesanan</td>
                  </tr>
                ) : (
                  data.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-4 pl-5 pr-4 font-mono text-blue-600 font-medium tracking-tight">{order.orderNumber}</td>
                      <td className="py-4 pr-4 text-gray-700 font-medium">{order.cashier?.name ?? "-"}</td>
                      <td className="py-4 pr-4 text-right font-semibold text-gray-900 tabular-nums">{formatIDR(order.total)}</td>
                      <td className="py-4 pr-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="py-4 pr-5 text-gray-500 text-sm tabular-nums">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Products + Sales Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Produk Terlaris</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pl-5 pr-4">Nama Produk</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pr-4">Terjual</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py tastable-nums py-3 pr-4">Pendapatan</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 pr-5">Rata-rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-500">Belum ada data produk terlaris</td>
                  </tr>
                ) : (
                  data.topProducts.map((product) => (
                    <tr key={product.productId} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-4 pl-5 pr-4 text-gray-800 font-medium">{product.name}</td>
                      <td className="py-4 pr-4 text-right text-gray-700 font-medium tabular-nums">{product.totalSold}<span className="text-gray-500 ml-1">pcs</span></td>
                      <td className="py-4 pr-4 text-right font-semibold text-gray-900 tabular-nums">{formatIDR(product.revenue)}</td>
                      <td className="py-4 pr-5 text-right text-gray-600 tabular-nums">{formatIDR(Math.round(product.revenue / Math.max(1, product.totalSold)))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Tren Penjualan</h2>
          <div className="h-64">
            <div className="flex items-end gap-1 h-5/6">
              {data.salesByDay.map((day, idx) => {
                const heightPct = (day.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="relative w-full flex items-end justify-center" style={{ height: "100%" }}>
                      <div
                        className="w-3/4 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md transition-all group-hover:from-blue-600 group-hover:to-blue-500"
                        style={{ height: `${heightPct}%` }}
                        title={`${formatIDR(day.revenue)} - ${day.orders} orders`}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(day.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}