"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Types ------------------------------------------------------------------

interface AttendanceUser {
  id: string;
  name: string;
  email: string;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  user: AttendanceUser;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  notes: string | null;
}

interface PaginatedAttendance {
  data: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HOLIDAY";
type ModalMode = false | "create" | "edit";

interface Alert {
  message: string;
  type: "success" | "error";
}

interface FormState {
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  notes: string;
}

// ---- Status config ----------------------------------------------------------

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-green-100 text-green-700" },
  ABSENT: { label: "Absent", className: "bg-red-100 text-red-700" },
  LATE: { label: "Late", className: "bg-yellow-100 text-yellow-700" },
  LEAVE: { label: "Leave", className: "bg-blue-100 text-blue-700" },
  HOLIDAY: { label: "Holiday", className: "bg-gray-100 text-gray-600" },
};

const ALL_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "LEAVE", "HOLIDAY"];

// ---- Helpers ----------------------------------------------------------------

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function calcDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "-";
  const mins = Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
  if (mins < 0) return "-";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toDatetimeLocal(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =============================================================================

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  const [showModal, setShowModal] = useState<ModalMode>(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  const [form, setForm] = useState<FormState>({
    userId: "",
    date: "",
    status: "PRESENT",
    checkIn: "",
    checkOut: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // ---- Fetch employees once ------------------------------------------------
  useEffect(() => {
    fetch("/api/employees?limit=100")
      .then((r) => r.json())
      .then((res: { data: Employee[] }) => setEmployees(Array.isArray(res.data) ? res.data : []))
      .catch(() => setEmployees([]));
  }, []);

  // ---- Fetch attendance when filters/page change --------------------------
  const fetchAttendance = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      month: selectedMonth,
    });
    if (selectedEmployee) params.set("userId", selectedEmployee);

    fetch(`/api/attendance?${params}`)
      .then((r) => r.json())
      .then((res: PaginatedAttendance) => {
        setAttendance(Array.isArray(res.data) ? res.data : []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setAttendance([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, selectedMonth, selectedEmployee]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // ---- Alert auto-dismiss -------------------------------------------------
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4000);
    return () => clearTimeout(t);
  }, [alert]);

  // ---- Monthly summary (from loaded data) ---------------------------------
  const summary = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = attendance.filter((r) => r.status === s).length;
      return acc;
    },
    {} as Record<AttendanceStatus, number>
  );

  // ---- Modal helpers -------------------------------------------------------
  function openCreate() {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    setForm({
      userId: selectedEmployee || employees[0]?.id || "",
      date: dateStr,
      status: "PRESENT",
      checkIn: "",
      checkOut: "",
      notes: "",
    });
    setEditingRecord(null);
    setShowModal("create");
  }

  function openEdit(record: AttendanceRecord) {
    const d = new Date(record.date);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setForm({
      userId: record.userId,
      date: dateStr,
      status: record.status,
      checkIn: toDatetimeLocal(record.checkIn),
      checkOut: toDatetimeLocal(record.checkOut),
      notes: record.notes ?? "",
    });
    setEditingRecord(record);
    setShowModal("edit");
  }

  function closeModal() {
    setShowModal(false);
    setEditingRecord(null);
  }

  // ---- Save ----------------------------------------------------------------
  async function handleSave() {
    if (!form.userId || !form.date) {
      setAlert({ message: "Employee and date are required.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        userId: form.userId,
        date: form.date,
        status: form.status,
        notes: form.notes || undefined,
      };
      if (form.checkIn) body.checkIn = new Date(form.checkIn).toISOString();
      if (form.checkOut) body.checkOut = new Date(form.checkOut).toISOString();

      let res: Response;

      if (showModal === "edit" && editingRecord) {
        // PATCH specific record
        const patchBody: Record<string, unknown> = {
          status: form.status,
          notes: form.notes || undefined,
        };
        if (form.checkIn) patchBody.checkIn = new Date(form.checkIn).toISOString();
        if (form.checkOut) patchBody.checkOut = new Date(form.checkOut).toISOString();

        res = await fetch(`/api/attendance/${editingRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      } else {
        // POST upserts by userId+date
        res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save record");
      }

      setAlert({ message: showModal === "create" ? "Attendance record saved." : "Record updated successfully.", type: "success" });
      closeModal();
      fetchAttendance();
    } catch (e) {
      setAlert({ message: e instanceof Error ? e.message : "An error occurred.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  // ---- Pagination ----------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const start = (page - 1) * LIMIT + 1;
  const end = Math.min(page * LIMIT, total);

  // ---- Render --------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage employee attendance</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Add Record
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {alert.message}
        </div>
      )}

      {/* Monthly summary strip */}
      <div className="grid grid-cols-5 gap-3">
        {ALL_STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className={`rounded-xl border px-4 py-3 ${cfg.className} border-current/20`}>
              <p className="text-xl font-bold">{summary[status]}</p>
              <p className="text-xs font-medium opacity-80 mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedEmployee}
          onChange={(e) => { setSelectedEmployee(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
        {(selectedEmployee || selectedMonth !== currentMonth()) && (
          <button
            onClick={() => { setSelectedEmployee(""); setSelectedMonth(currentMonth()); setPage(1); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Check In</th>
              <th className="px-4 py-3">Check Out</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : attendance.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No attendance records for this period.
                </td>
              </tr>
            ) : (
              attendance.map((record) => {
                const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.PRESENT;
                return (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {record.user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{record.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(record.date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {formatTime(record.checkIn)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {formatTime(record.checkOut)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {calcDuration(record.checkIn, record.checkOut)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(record)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {start}–{end} of {total} records</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {showModal === "create" ? "Add Attendance Record" : "Edit Attendance Record"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Employee */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee <span className="text-red-500">*</span></label>
                <select
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                  disabled={showModal === "edit"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  disabled={showModal === "edit"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                {showModal === "edit" && (
                  <p className="text-xs text-gray-400 mt-1">Date cannot be changed. Add a new record to change the date.</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AttendanceStatus }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>

              {/* Check In */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Check In</label>
                <input
                  type="datetime-local"
                  value={form.checkIn}
                  onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Check Out */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Check Out</label>
                <input
                  type="datetime-local"
                  value={form.checkOut}
                  onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : showModal === "create" ? "Save Record" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
