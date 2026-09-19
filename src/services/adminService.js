import apiClient from "./apiClient";

export async function fetchAdminStats() {
  const { data } = await apiClient.get("/admin/stats");
  return data.data;
}

export async function fetchAdminAnalytics() {
  const { data } = await apiClient.get("/admin/analytics");
  return data.data;
}

export async function fetchAdminUsers(params = {}) {
  const { data } = await apiClient.get("/admin/users", { params });
  return data.data.users;
}

export async function updateAdminUserRemote(id, patch) {
  const { data } = await apiClient.put(`/admin/users/${id}`, patch);
  return data.data.user;
}

export async function deleteAdminUserRemote(id) {
  await apiClient.delete(`/admin/users/${id}`);
}
