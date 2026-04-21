"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Types ------------------------------------------------------------------

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roleId: string;
  role: Role | null;
  createdAt: string;
}

interface PaginatedEmployees {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
}

type ModalMode = false | "create" | "edit";

interface Alert {
  message: string;
  type: "success" | "error";
}

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  roleId: string;
  isActive: boolean;
}

// ---- Role badge color map ---------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  cashier: "bg-green-100 text-green-700",
  kasir: "bg-green-100 text-green-700",
  staff: "bg-gray-100 text-gray-700",
};

function roleBadgeClass(roleName: string): string {
  const key = roleName.toLowerCase();
  for (const [k, v] of Object.entries(ROLE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-indigo-100 text-indigo-700";
}

// =============================================================================

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [showModal, setShowModal] = useState<ModalMode>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    phone: "",
    roleId: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // ---- Fetch roles once on mount -------------------------------------------
  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data: Role[]) => setRoles(Array.isArray(data) ? data : []))
      .catch(() => setRoles([]));
  }, []);

  // ---- Fetch employees whenever filters/page change -----------------------
  const fetchEmployees = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
    });
    if (search) params.set("search", search);
    if (roleFilter) params.set("roleId", roleFilter);

    fetch(`/api/employees?${params}`)
      .then((r) => r.json())
      .then((res: PaginatedEmployees) => {
        setEmployees(Array.isArray(res.data) ? res.data : []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setEmployees([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  // ---- Alert auto-dismiss -------------------------------------------------
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4000);
    return () => clearTimeout(t);
  }, [alert]);

  // ---- Modal helpers -------------------------------------------------------
  function openCreate() {
    setForm({ name: "", email: "", password: "", phone: "", roleId: roles[0]?.id ?? "", isActive: true });
    setEditingEmployee(null);
    setShowModal("create");
  }

  function openEdit(emp: Employee) {
    setForm({
      name: emp.name,
      email: emp.email,
      password: "",
      phone: emp.phone ?? "",
      roleId: emp.roleId,
      isActive: emp.isActive,
    });
    setEditingEmployee(emp);
    setShowModal("edit");
  }

  function closeModal() {
    setShowModal(false);
    setEditingEmployee(null);
  }

  // ---- Save (create or edit) -----------------------------------------------
  async function handleSave() {
    if (!form.name.trim() || !form.roleId) {
      setAlert({ message: "Name and role are required.", type: "error" });
      return;
    }
    if (showModal === "create" && (!form.email.trim() || !form.password)) {
      setAlert({ message: "Email and password are required for new employees.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      let res: Response;

      if (showModal === "create") {
        res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            phone: form.phone.trim() || undefined,
            roleId: form.roleId,
          }),
        });
      } else {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          roleId: form.roleId,
          isActive: form.isActive,
        };
        if (form.password) body.password = form.password;

        res = await fetch(`/api/employees/${editingEmployee!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save employee");
      }

      setAlert({ message: showModal === "create" ? "Employee created successfully." : "Employee updated successfully.", type: "success" });
      closeModal();
      fetchEmployees();
    } catch (e) {
      setAlert({ message: e instanceof Error ? e.message : "An error occurred.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  // ---- Deactivate employee -------------------------------------------------
  async function handleDeactivate(emp: Employee) {
    if (!window.confirm(`Deactivate employee "${emp.name}"? They will not be able to log in.`)) return;

    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to deactivate employee");
      }
      setAlert({ message: `"${emp.name}" has been deactivated.`, type: "success" });
      fetchEmployees();
    } catch (e) {
      setAlert({ message: e instanceof Error ? e.message : "An error occurred.", type: "error" });
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
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff accounts and roles</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Add Employee
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {alert.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">No employees found.</td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    {emp.role ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadgeClass(emp.role.name)}`}>
                        {emp.role.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No role</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(emp)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      {emp.isActive && (
                        <button
                          onClick={() => handleDeactivate(emp)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Deactivate
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

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {start}–{end} of {total} employees</span>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {showModal === "create" ? "Add Employee" : "Edit Employee"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name"
                />
              </div>

              {/* Email (create only) */}
              {showModal === "create" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password {showModal === "create" && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={showModal === "edit" ? "Leave blank to keep current" : "Password"}
                />
                {showModal === "edit" && (
                  <p className="text-xs text-gray-400 mt-1">Leave blank to keep current password.</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+62..."
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  value={form.roleId}
                  onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Active toggle (edit only) */}
              {showModal === "edit" && (
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">Active Status</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative inline-flex w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-blue-600" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              )}
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
                {saving ? "Saving..." : showModal === "create" ? "Create Employee" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
