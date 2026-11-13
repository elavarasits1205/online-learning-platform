import api from "./Api";

const BASE_URL = "/roles";

export const getAllRoles = async () => {
  const response = await api.get(BASE_URL);
  return response.data?.data ?? response.data;
};

export const getRoleById = async (id) => {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data?.data ?? response.data;
};

export const createRole = async (role) => {
  const response = await api.post(BASE_URL, role);
  return response.data?.data ?? response.data;
};

export const updateRole = async (id, role) => {
  const response = await api.put(`${BASE_URL}/${id}`, role);
  return response.data?.data ?? response.data;
};

export const deleteRole = async (id) => {
  const response = await api.delete(`${BASE_URL}/${id}`);
  return response.data?.data ?? response.data;
};