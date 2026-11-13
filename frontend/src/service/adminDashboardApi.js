import api from "./Api";

async function getData(path, { fresh = false } = {}) {
    const response = await api.get(`/admin/dashboard/${path}`, fresh
        ? {
            params: { _refresh: Date.now() },
            headers: { "Cache-Control": "no-cache" },
        }
        : undefined);
    return response?.data?.data ?? {};
}

export const adminDashboardApi = {
    getSummary: (options) => getData("summary", options),
    getWidgets: (options) => getData("widgets", options)
};
