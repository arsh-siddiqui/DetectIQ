import apiClient from "./apiClient";

export async function submitScan(content, scanType, inputType = null) {
  // Support for pasted_email object payload
  let payload;
  if (typeof content === 'object') {
    payload = { ...content, scanType };
    if (inputType) payload.inputType = inputType;
  } else {
    payload = { content, scanType };
    if (inputType) payload.inputType = inputType;
  }
  
  const { data } = await apiClient.post("/scan", payload, {
    timeout: 30000
  });
  return data.data;
}

export async function submitEml(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data } = await apiClient.post("/email-forensics/analyze", formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000
  });
  return data.data;
}

export async function getScanHistory() {
  const { data } = await apiClient.get("/users/scans");
  return data.data.scans;
}

export const personalizeScan = async (scanId) => {
  const response = await apiClient.post(`/users/scans/${scanId}/personalize`);
  return response.data;
};

export async function getScanResult(scanId) {
  // Returns the Scan document
  const { data } = await apiClient.get(`/users/scans/${scanId}`);
  return data.data;
}
