
import api from "./Api";

// ---------------------------------------------------------
// Response helpers
// ---------------------------------------------------------

const unwrap = (response) => {
    const body = response?.data;

    if (
        body &&
        typeof body === "object" &&
        Object.prototype.hasOwnProperty.call(body, "data")
    ) {
        return body.data;
    }

    return body ?? null;
};

const getErrorMessage = (error) =>
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again.";

const request = async (callback) => {
    try {
        return unwrap(await callback());
    } catch (error) {
        const normalizedError = new Error(getErrorMessage(error));
        normalizedError.statusCode = error?.response?.status;
        normalizedError.response = error?.response;
        throw normalizedError;
    }
};

const withLogoUpload = (payload, logoFile) => {
    if (!logoFile) return payload;

    const formData = new FormData();

    for (const [field, value] of Object.entries(payload)) {
        if (value === undefined) continue;
        formData.append(field, value === null ? "" : String(value));
    }

    formData.append("logo", logoFile);
    return formData;
};

// ---------------------------------------------------------
// Institution API
// Backend mount: /api/institutions
// ---------------------------------------------------------

const BASE_URL = "/institutions";

export const getInstitutions = (params = {}) =>
    request(() => api.get(BASE_URL, { params }));

export const getInstitutionById = (id) => {
    if (id === undefined || id === null || String(id).trim() === "") {
        throw new Error("Institution ID is required.");
    }

    return request(() =>
        api.get(`${BASE_URL}/${encodeURIComponent(String(id))}`)
    );
};

export const createInstitution = (payload, logoFile = null) =>
    request(() => api.post(BASE_URL, withLogoUpload(payload, logoFile)));

export const updateInstitution = (id, payload, logoFile = null) => {
    if (id === undefined || id === null || String(id).trim() === "") {
        throw new Error("Institution ID is required.");
    }

    return request(() =>
        api.put(
            `${BASE_URL}/${encodeURIComponent(String(id))}`,
            withLogoUpload(payload, logoFile)
        )
    );
};

export const deleteInstitution = (id) => {
    if (id === undefined || id === null || String(id).trim() === "") {
        throw new Error("Institution ID is required.");
    }

    return request(() =>
        api.delete(`${BASE_URL}/${encodeURIComponent(String(id))}`)
    );
};

export { getErrorMessage };

const institutionApi = {
    getInstitutions,
    getInstitutionById,
    createInstitution,
    updateInstitution,
    deleteInstitution,
};

export default institutionApi;
