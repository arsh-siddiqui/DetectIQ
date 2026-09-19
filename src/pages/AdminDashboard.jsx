import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import Pagination from "../components/ui/Pagination";
import { useToast } from "../context/ToastContext";
import useDebounce from "../hooks/useDebounce";
import { fetchAdminStats, fetchAdminAnalytics, fetchAdminUsers, updateAdminUserRemote, deleteAdminUserRemote } from "../services/adminService";

const PAGE_SIZE = 4;

const emptyUser = { name: "", email: "", accountRole: "Student", status: "Active" };

// Colors for the pie chart
const riskColors = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#3B82F6",
  safe: "#10B981"
};

export default function AdminDashboard() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 200);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(emptyUser);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, label }

  const { toast } = useToast();

  // Data states
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const fetchAllUsers = async () => {
        let all = [];
        let p = 1;
        const limit = 100;
        while (true) {
          const chunk = await fetchAdminUsers({ limit, page: p });
          all = all.concat(chunk);
          if (chunk.length < limit) break;
          p++;
        }
        return all;
      };

      const results = await Promise.allSettled([
        fetchAdminStats(),
        fetchAdminAnalytics(),
        fetchAllUsers()
      ]);

      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setAnalytics(results[1].value);
      if (results[2].status === "fulfilled") setUsers(results[2].value);

      if (results.some(r => r.status === "rejected")) {
        toast("Some admin data failed to load.", "warning");
      }
    } catch (err) {
      toast("Failed to load admin data.", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

  const activeList = filteredUsers;
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const pagedList = useMemo(
    () => activeList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [activeList, page]
  );

  const openAdd = () => {
    setEditingId(null);
    setFormValues(emptyUser);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id || item.id);
    setFormValues(item);
    setFormOpen(true);
  };

  const submitForm = async () => {
    try {
      if (!formValues.name) {
        toast("Name is required.", "warning");
        return;
      }
      if (editingId) {
        await updateAdminUserRemote(editingId, formValues);
        toast("User updated.", "success");
      } else {
        toast("Please use the registration page to add users.", "warning");
        return;
      }
      setFormOpen(false);
      loadData();
    } catch (err) {
      toast("Failed to save changes.", "danger");
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteAdminUserRemote(deleteTarget.id);
      toast("User deleted.", "success");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || err.message || "Failed to delete.", "danger");
      setDeleteTarget(null);
    }
  };

  // Derived Stats
  const displayStats = [
    { label: "Total Users", value: stats?.totalUsers || 0, change: "--", icon: "Users" },
    { label: "Scans Today", value: stats?.scansToday || 0, change: "--", icon: "Activity" }
  ];

  // Derived Analytics
  let monthlyData = [];
  if (analytics?.userGrowth && analytics?.scanGrowth) {
    const months = new Set([
      ...analytics.userGrowth.map(u => u._id),
      ...analytics.scanGrowth.map(s => s._id)
    ]);
    monthlyData = Array.from(months).sort().map(month => {
      const ug = analytics.userGrowth.find(u => u._id === month);
      const sg = analytics.scanGrowth.find(s => s._id === month);
      return { month, users: ug?.count || 0, scans: sg?.count || 0 };
    });
  }

  const riskPieData = (analytics?.riskDistribution || []).map(r => ({
    name: r._id || "Unknown",
    value: r.count,
    color: riskColors[r._id] || "#94A3B8"
  }));

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-faint">Loading admin dashboard...</div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Admin Dashboard</h1>
          <p className="text-sm text-ink-light mt-1">Manage users and monitor platform health.</p>
        </div>
        <Badge tone="primary" icon={Icons.ShieldCheck}>Admin Access</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {displayStats.map((s, i) => {
          const Icon = Icons[s.icon] || Icons.BarChart3;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-secondary">{s.change}</span>
                </div>
                <div className="text-xl font-extrabold text-ink">{s.value}</div>
                <div className="text-xs text-ink-light mt-1">{s.label}</div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-bold text-ink mb-4">Growth Overview</h3>
          <div className="h-64">
            {monthlyData.length < 2 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Icons.Activity className="w-8 h-8 text-ink-faint mb-2" />
                <p className="text-sm font-semibold text-ink-light">Limited data available</p>
                <p className="text-xs text-ink-faint mt-1 max-w-[250px]">Growth trends will appear as more activity is recorded.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }} />
                  <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 12 }} />
                  <Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2.5} dot={false} name="Users" animationDuration={1200} />
                  <Line type="monotone" dataKey="scans" stroke="#14B8A6" strokeWidth={2.5} dot={false} name="Scans" animationDuration={1200} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-ink mb-4">Scan Risk Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} animationDuration={1200}>
                  {riskPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* CRUD tables */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-primary text-white">
              Users
            </button>
          </div>
          <div className="flex gap-3">
            <SearchBar
              value={searchInput}
              onChange={(v) => {
                setSearchInput(v);
                setPage(1);
              }}
              placeholder="Search users..."
              className="w-full sm:w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint uppercase border-b border-slate-100">
                <th className="pb-3 font-semibold">Name</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedList.map((u) => (
                <tr key={u._id}>
                  <td className="py-3">
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-xs text-ink-faint">{u.email}</div>
                  </td>
                  <td className="py-3 text-ink-light">{u.accountRole || u.role}</td>
                  <td className="py-3">
                    <Badge tone={u.status === "Active" ? "success" : "danger"}>{u.status || "Active"}</Badge>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-slate-100 text-ink-faint mr-1">
                      <Icons.Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: u._id, label: u.name })}
                      className="p-2 rounded-lg hover:bg-red-50 text-danger"
                    >
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {pagedList.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-ink-faint">No users match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>

      {/* Add / Edit modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Edit User" : "Add User"} size="sm">
        <div className="space-y-4">
          <Input label="Name" value={formValues.name || ""} onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))} />
          <div>
            <span className="block text-sm font-medium text-ink mb-1.5">Account Role</span>
            <div className="grid grid-cols-3 gap-2">
              {["Student", "Professional", "Business"].map((r) => (
                <button
                  key={r}
                  onClick={() => setFormValues((v) => ({ ...v, accountRole: r }))}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    formValues.accountRole === r ? "border-primary bg-primary-50 text-primary" : "border-slate-200 text-ink-light"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink mb-1.5">Status</span>
            <div className="grid grid-cols-2 gap-2">
              {["Active", "Suspended"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFormValues((v) => ({ ...v, status: s }))}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    formValues.status === s ? "border-primary bg-primary-50 text-primary" : "border-slate-200 text-ink-light"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full mt-2" onClick={submitForm}>
            {editingId ? "Save Changes" : "Add User"}
          </Button>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" size="sm">
        {deleteTarget && (
          <div>
            <p className="text-sm text-ink-light leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.label}</span>? This can't be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
