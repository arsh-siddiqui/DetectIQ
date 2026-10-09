import apiClient from "./apiClient";

export async function registerUser({ name, email, password, accountRole }) {
  const { data } = await apiClient.post("/auth/register", { name, email, password, accountRole });
  if (data?.data?.token) {
    try {
      localStorage.setItem("detectiq_token", data.data.token);
    } catch {
      // localStorage may fail in restricted sandboxes
    }
  }
  return data.data.user;
}

export async function loginUser({ email, password }) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  if (data?.data?.token) {
    try {
      localStorage.setItem("detectiq_token", data.data.token);
    } catch {
      // localStorage may fail in restricted sandboxes
    }
  }
  return data.data.user;
}

export async function logoutUser() {
  try {
    localStorage.removeItem("detectiq_token");
  } catch {
    // ignore
  }
  await apiClient.post("/auth/logout");
}

export async function getCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data.data.user;
}
