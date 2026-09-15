import apiClient from "./apiClient";

export async function fetchProfile() {
  const { data } = await apiClient.get("/users/profile");
  return data.data.user;
}

export async function updateProfileRemote(patch) {
  const { data } = await apiClient.put("/users/profile", patch);
  return data.data.user;
}

export async function changePasswordRemote(payload) {
  const { data } = await apiClient.put("/users/password", payload);
  return data;
}

export async function fetchDashboard() {
  const { data } = await apiClient.get("/users/dashboard");
  return data.data;
}

export async function fetchScanHistory(page = 1, limit = 20) {
  const { data } = await apiClient.get("/users/scans", { params: { page, limit } });
  return data.data.scans;
}

export async function fetchProgress() {
  const { data } = await apiClient.get("/users/progress");
  return data.data;
}

export async function toggleBookmarkRemote(articleId) {
  await apiClient.post(`/users/articles/${articleId}/bookmark`);
}

export async function toggleLikeRemote(articleId) {
  await apiClient.post(`/users/articles/${articleId}/like`);
}

export async function markArticleReadRemote(articleId) {
  await apiClient.post(`/users/articles/${articleId}/read`);
}
