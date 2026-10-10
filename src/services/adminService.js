import apiClient from "./apiClient";

export async function fetchAdminStats() {
  const { data } = await apiClient.get("/admin/stats");
  return data.data;
}

export async function fetchAdminAnalytics() {
  const { data } = await apiClient.get("/admin/analytics");
  return data.data;
}

export async function fetchAdminThreatFeeds() {
  const { data } = await apiClient.get("/admin/threat-feeds");
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

export async function fetchAdminVulnerabilities() {
  const { data } = await apiClient.get("/admin/vulnerabilities");
  return data.data.vulnerabilities;
}

export async function createAdminVulnerability(payload) {
  const { data } = await apiClient.post("/admin/vulnerabilities", payload);
  return data.data.vulnerability;
}

export async function updateAdminVulnerability(id, payload) {
  const { data } = await apiClient.put(`/admin/vulnerabilities/${id}`, payload);
  return data.data.vulnerability;
}

export async function toggleAdminVulnerability(id) {
  const { data } = await apiClient.patch(`/admin/vulnerabilities/${id}/toggle`);
  return data.data.vulnerability;
}

export async function deleteAdminVulnerability(id) {
  await apiClient.delete(`/admin/vulnerabilities/${id}`);
}
