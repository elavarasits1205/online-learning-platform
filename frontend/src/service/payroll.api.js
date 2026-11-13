import api from "./Api";

const BASE = "/payroll";

export const validatePayrollId = (id, field = "ID") => {
  const value = String(id ?? "").trim();

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${field} must be a valid positive BIGINT string.`);
  }

  return value;
};

const unwrap = (response) => {
  const body = response?.data;

  if (body?.success === false) {
    throw new Error(body.message || "Payroll request failed.");
  }

  return body?.data ?? body;
};

const request = async (method, url, data, config) => {
  const response = await api.request({
    method,
    url,
    ...(data !== undefined ? { data } : {}),
    ...config,
  });

  return unwrap(response);
};

const list = async (url, params = {}) => {
  const result = await request("get", url, undefined, { params });

  if (Array.isArray(result)) {
    return { rows: result, pagination: null };
  }

  return {
    rows: Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.rows)
        ? result.rows
        : [],
    pagination: result?.pagination ?? null,
  };
};

const resource = (path) => ({
  getAll: (params = {}) => list(`${BASE}/${path}`, params),

  getById: (id) =>
    request("get", `${BASE}/${path}/${validatePayrollId(id)}`),

  create: (payload) =>
    request("post", `${BASE}/${path}`, payload),

  update: (id, payload) =>
    request(
      "put",
      `${BASE}/${path}/${validatePayrollId(id)}`,
      payload
    ),

  remove: (id) =>
    request("delete", `${BASE}/${path}/${validatePayrollId(id)}`),
});

export const compensationApi = resource("compensations");
export const referralSettingsApi = {
  getAll: async () => {
    const result = await request("get", `${BASE}/referral-settings`);
    return Array.isArray(result) ? result : [];
  },
  save: (payload) => request("put", `${BASE}/referral-settings`, payload),
};
export const payrollPeriodApi = resource("periods");
payrollPeriodApi.calculate = (id) =>
  request(
    "post",
    `${BASE}/periods/${validatePayrollId(id, "Payroll period ID")}/calculate`,
    {}
  );
export const instructorPayrollApi = resource("instructor-payrolls");
export const courseEarningApi = resource("course-earnings");
export const paymentApi = resource("payments");

export const payrollReportApi = {
  getAll: (params = {}) =>
    request("get", `${BASE}/reports`, undefined, { params }),
};

export const instructorPayrollSelfApi = {
  getOverview: () =>
    request("get", `${BASE}/instructor/overview`),

  getCourseEarnings: (params = {}) =>
    list(`${BASE}/instructor/course-earnings`, params),

  getPayrollHistory: (params = {}) =>
    list(`${BASE}/instructor/payroll-history`, params),

  getPaymentHistory: (params = {}) =>
    list(`${BASE}/instructor/payment-history`, params),

  getPayslip: (payrollId) =>
    request(
      "get",
      `${BASE}/instructor/payslip/${validatePayrollId(
        payrollId,
        "Payroll ID"
      )}`
    ),
};

const extractRows = (result, keys = []) => {
  if (Array.isArray(result)) return result;

  for (const key of keys) {
    if (Array.isArray(result?.[key])) return result[key];
  }

  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;

  return [];
};

export const payrollDropdownApi = {
  async getInstructors(params = {}) {
    const result = await request(
      "get",
      "/admin/instructors",
      undefined,
      { params }
    );

    return extractRows(result, ["instructors", "rows"]);
  },

  async getCourses(params = {}) {
    const result = await request(
      "get",
      "/admin/courses",
      undefined,
      { params }
    );

    return extractRows(result, ["courses", "rows"]);
  },

  async getInstructorCourses(params = {}) {
    const result = await request(
      "get",
      `${BASE}/compensations/instructor-courses`,
      undefined,
      { params }
    );

    return extractRows(result, ["courses", "rows"]);
  },

  async getCompensations(params = {}) {
    const result = await request(
      "get",
      `${BASE}/compensations`,
      undefined,
      { params }
    );

    return extractRows(result, ["compensations", "rows"]);
  },

  async getPeriods(params = {}) {
    const result = await request(
      "get",
      `${BASE}/periods`,
      undefined,
      { params }
    );

    return extractRows(result, ["periods", "rows"]);
  },

  async getPayrolls(params = {}) {
    const result = await request(
      "get",
      `${BASE}/instructor-payrolls`,
      undefined,
      { params }
    );

    return extractRows(result, ["payrolls", "rows"]);
  },
};

const payrollApi = {
  compensation: compensationApi,
  periods: payrollPeriodApi,
  instructorPayrolls: instructorPayrollApi,
  courseEarnings: courseEarningApi,
  payments: paymentApi,
  reports: payrollReportApi,
  instructor: instructorPayrollSelfApi,
  dropdowns: payrollDropdownApi,
};

export default payrollApi;
