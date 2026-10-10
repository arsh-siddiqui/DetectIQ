import api from './apiClient';

export const getInvestigations = async (params) => {
  const response = await api.get('/security/investigations', { params });
  return response.data;
};

export const getInvestigationById = async (id) => {
  const response = await api.get(`/security/investigations/${id}`);
  return response.data;
};

export const getIndicators = async (params) => {
  const response = await api.get('/security/indicators', { params });
  return response.data;
};

export const getIndicatorById = async (id) => {
  const response = await api.get(`/security/indicators/${id}`);
  return response.data;
};
