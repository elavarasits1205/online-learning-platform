
import api from "./Api";

// GET /api/permissions
export const getAllPermissions = async () => {
    const response = await api.get("/permissions");
    return response.data;
};

// GET /api/permissions/:id
export const getPermissionById = async (id) => {
    const response = await api.get(`/permissions/${id}`);
    return response.data;
};

// POST /api/permissions
export const createPermission = async (permission) => {
    const response = await api.post("/permissions", permission);
    return response.data;
};

// PUT /api/permissions/:id
export const updatePermission = async (id, permission) => {
    const response = await api.put(`/permissions/${id}`, permission);
    return response.data;
};

// DELETE /api/permissions/:id
export const deletePermission = async (id) => {
    const response = await api.delete(`/permissions/${id}`);
    return response.data;
};
