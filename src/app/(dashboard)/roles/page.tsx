"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Types ------------------------------------------------------------------

interface Role {
  id: string;
  name: string;
  permissions: string[];
  _count: {
    users: number;
  };
}

type ModalMode = false | "create" | "edit";

interface Alert {
  message: string;
  type: "success" | "error";
}

// ---- Permission options ----------------------------------------------------

const PERMISSION_OPTIONS = [
  "orders:read",
  "orders:write",
  "products:read",
  "products:write",
  "employees:read",
  "employees:write",
  "stock:read",
  "stock:write",
  "purchasing:read",
  "purchasing:write",
  "reports:read",
  "settings:write",
  "cashier:use",
  "attendance:write",
] as const;

function formatPermission(perm: string): string {
  const [resource, action] = perm.split(":");
  const label = `${resource} ${action}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// =============================================================================

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState<ModalMode>(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  const [formName, setFormName] = useState("");
  const [formPerms, setFormPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ---- Fetch roles ---------------------------------------------------------
  const fetchRoles = useCallback(() => {
    setLoading(true);
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data: Role[]) => setRoles(Array.isArray(data) ? data : []))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // ---- Alert auto-dismiss -------------------------------------------------
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4000);
    return () => clearTimeout(t);
  }, [alert]);

  // ---- Modal helpers -------------------------------------------------------
  function openCreate() {
    setFormName("");
    setFormPerms([]);
    setEditingRole(null);
    setShowModal("create");
  }

  function openEdit(role: Role) {
    setFormName(role.name);
    setFormPerms([...role.permissions]);
    setEditingRole(role);
    setShowModal("edit");
  }

  function closeModal() {
    setShowModal(false);
    setEditingRole(null);
  }

  function togglePerm(perm: string) {
    setFormPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  // ---- Save ----------------------------------------------------------------
  async function handleSave() {
    if (!formName.trim()) {
      setAlert({ message: "Role name is required.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      let res: Response;

      if (showModal === "create") {
        res = await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), permissions: formPerms }),
        });
      } else {
        res = await fetch(`/api/roles/${editingRole!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), permissions: formPerms }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save role");
      }

      setAlert({ message: showModal === "create" ? "Role created successfully." : "Role updated successfully.", type: "success" });
      closeModal();
      fetchRoles();
    } catch (e) {
      setAlert({ message: e instanceof Error ? e.message : "An error occurred.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  // ---- Delete --------------------------------------------------------------
  async function handleDelete(role: Role) {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete role");
      }
      setAlert({ message: `Role "${role.name}" deleted.`, type: "success" });
      fetchRoles();
    } catch (e) {
      setAlert({ message: e instanceof Error ? e.message : "An error occurred.", type: "error" });
    }
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage access roles and permissions</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Add Role
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {alert.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3 text-center">Users</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">No roles found.</td>
              </tr>
            ) : (
              roles.map((role) => {
                const visiblePerms = role.permissions.slice(0, 5);
                const hiddenCount = role.permissions.length - visiblePerms.length;
                return (
                  <tr key={role.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{role.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.length === 0 ? (
                          <span className="text-gray-400 text-xs">No permissions</span>
                        ) : (
                          <>
                            {visiblePerms.map((perm) => (
                              <span key={perm} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded font-medium">
                                {perm}
                              </span>
                            ))}
                            {hiddenCount > 0 && (
                              <span className="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded font-medium">
                                +{hiddenCount} more
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        {role._count.users}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(role)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {showModal === "create" ? "Add Role" : "Edit Role"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Cashier"
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Permissions</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPerms([...PERMISSION_OPTIONS])}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300 text-xs">|</span>
                    <button
                      type="button"
                      onClick={() => setFormPerms([])}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 border border-gray-100 rounded-lg p-3 bg-gray-50">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formPerms.includes(perm)}
                        onChange={() => togglePerm(perm)}
                        className="w-3.5 h-3.5 rounded accent-blue-600"
                      />
                      <span className="text-xs text-gray-700">{formatPermission(perm)}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{formPerms.length} permission{formPerms.length !== 1 ? "s" : ""} selected</p>
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
                {saving ? "Saving..." : showModal === "create" ? "Create Role" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
