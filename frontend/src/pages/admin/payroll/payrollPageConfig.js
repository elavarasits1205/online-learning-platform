import {
  compensationApi,
  payrollPeriodApi,
  instructorPayrollApi,
  courseEarningApi,
  paymentApi,
  payrollDropdownApi,
} from "../../../service/payroll.api";

// ============================================================
// HELPERS
// ============================================================

const money = (value, code = "INR") => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "-";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code || "INR"} ${amount.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-IN");
};

const field = (name, label, type = "text", extra = {}) => ({
  name,
  label,
  type,
  ...extra,
});

const labelize = (value) =>
  String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const enumOptions = (values) =>
  values.map((value) => ({
    value,
    label: labelize(value),
  }));

const enumSelect = (name, label, values, extra = {}) =>
  field(name, label, "select", {
    options: enumOptions(values),
    optionValue: "value",
    optionLabel: "label",
    ...extra,
  });

const createOnly = (definition) => ({
  ...definition,
  visibleWhen: (_form, mode) => mode === "create",
});

const editOnly = (definition) => ({
  ...definition,
  visibleWhen: (_form, mode) => mode === "edit",
});

const instructorName = (row) => {
  const fullName = [
    row.first_name ?? row.firstName,
    row.last_name ?? row.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    row.instructor_name ||
    fullName ||
    row.name ||
    row.username ||
    row.email ||
    row.instructor_username ||
    row.instructor_code ||
    row.id
  );
};

// ============================================================
// ENUM VALUES (must match PostgreSQL check constraints)
// ============================================================

const COMPENSATION_TYPES = [
  "FIXED",
  "COMMISSION",
  "FIXED_PLUS_COMMISSION",
];

const PERIOD_STATUSES = [
  "OPEN",
  "PROCESSING",
  "PROCESSED",
  "APPROVED",
  "CLOSED",
];

const INSTRUCTOR_PAYROLL_STATUSES = [
  "DRAFT",
  "CALCULATED",
  "APPROVED",
  "PAID",
  "CANCELLED",
];

const PAYMENT_METHODS = ["BANK_TRANSFER", "UPI", "OTHER"];

const PAYMENT_STATUSES = [
  "INITIATED",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
];

const usesFixedAmount = (type) =>
  ["FIXED", "FIXED_PLUS_COMMISSION"].includes(
    type
  );

const usesCommission = (type) =>
  ["COMMISSION", "FIXED_PLUS_COMMISSION"].includes(type);

// ============================================================
// DROPDOWN FIELD DEFINITIONS
// ============================================================

const instructorSelect = {
  name: "instructor_id",
  label: "Instructor",
  type: "select",
  required: true,
  roles: ["ADMIN"],

  loadOptions: async () => {
    return payrollDropdownApi.getInstructors({
      page: 1,
      limit: 100,
    });
  },

  optionValue: "id",
  optionLabel: (row) =>
    `${row.instructor_code || ""} - ${instructorName(row)}`,
};

const courseSelect = {
  name: "course_id",
  label: "Course",
  type: "select",
  required: true,

  loadOptions: async () => {
    return payrollDropdownApi.getCourses({
      page: 1,
      limit: 100,
    });
  },

  optionValue: "id",
  optionLabel: (row) =>
    `${row.course_code || ""} - ${
      row.course_title ||
      row.title ||
      row.name ||
      row.id
    }`,
};

const compensationCourseSelect = {
  ...courseSelect,
  loadOptionsForUser: async ({ isAdmin }) => {
    if (isAdmin) {
      return payrollDropdownApi.getCourses({ page: 1, limit: 100 });
    }

    return payrollDropdownApi.getInstructorCourses({ page: 1, limit: 100 });
  },
};

const periodSelect = {
  name: "payroll_period_id",
  label: "Payroll Period",
  type: "select",
  required: true,

  loadOptions: async () => {
    return payrollDropdownApi.getPeriods({
      page: 1,
      limit: 100,
    });
  },

  optionValue: "id",
  optionLabel: (row) =>
    `${row.period_code || row.id} (${
      formatDate(row.period_start)
    } - ${formatDate(row.period_end)})`,
};

const payrollSelect = {
  name: "instructor_payroll_id",
  label: "Instructor Payroll",
  type: "select",
  required: true,
  fullWidth: true,

  helperText: "Select the instructor payroll record.",

  loadOptions: async () => {
    return payrollDropdownApi.getPayrolls({
      page: 1,
      limit: 100,
    });
  },

  optionValue: "id",
  optionLabel: (row) =>
    `${row.payroll_number || `Payroll #${row.id}`} - ${instructorName(
      row
    )} - ${row.period_code || "No period"} (${row.status || "-"}) - ${money(
      row.net_amount,
      row?.currency_code
    )}`,
};

const approvedPayrollSelect = {
  ...payrollSelect,
  label: "Approved Instructor Payroll",
  helperText: "Only approved payrolls can be paid. Amount and currency are taken from the selected payroll.",
  loadOptions: async () => {
    return payrollDropdownApi.getPayrolls({
      page: 1,
      limit: 100,
      status: "APPROVED",
    });
  },
};

const compensationSelect = {
  name: "compensation_id",
  label: "Compensation",
  type: "select",
  required: true,

  helperText:
    "Select the compensation that matches the payroll instructor and course.",

  loadOptions: async () => {
    return payrollDropdownApi.getCompensations({
      page: 1,
      limit: 100,
    });
  },

  optionValue: "id",
  optionLabel: (row) =>
    `${instructorName(row)} - ${
      row.course_title || row.course_code || "Course"
    } - ${row.compensation_type || "Compensation"}`,
};

// ============================================================
// FILTER DEFINITIONS
// ============================================================

const instructorFilter = {
  name: "instructorId",
  label: "Instructor",
  type: "select",
  loadOptions: instructorSelect.loadOptions,
  optionValue: "id",
  optionLabel: instructorSelect.optionLabel,
};

const courseFilter = {
  name: "courseId",
  label: "Course",
  type: "select",
  loadOptions: courseSelect.loadOptions,
  optionValue: "id",
  optionLabel: courseSelect.optionLabel,
};

const periodFilter = {
  name: "periodId",
  label: "Payroll Period",
  type: "select",
  loadOptions: periodSelect.loadOptions,
  optionValue: "id",
  optionLabel: periodSelect.optionLabel,
};

const periodIdFilter = {
  ...periodFilter,
  name: "periodId",
};

const payrollFilter = {
  name: "payrollId",
  label: "Instructor Payroll",
  type: "select",
  loadOptions: payrollSelect.loadOptions,
  optionValue: "id",
  optionLabel: payrollSelect.optionLabel,
};

const compensationFilter = {
  name: "compensationId",
  label: "Compensation",
  type: "select",
  loadOptions: compensationSelect.loadOptions,
  optionValue: "id",
  optionLabel: compensationSelect.optionLabel,
};

const statusFilter = (name, label, values) => ({
  name,
  label,
  type: "select",
  options: enumOptions(values),
  optionValue: "value",
  optionLabel: "label",
});

const activeFilter = {
  name: "isActive",
  label: "Active Status",
  type: "select",
  options: [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ],
  optionValue: "value",
  optionLabel: "label",
};

// ============================================================
// PAGE CONFIGURATION
// ============================================================

export const payrollPageConfig = {
  // ==========================================================
  // COMPENSATION MANAGEMENT
  // ==========================================================

  compensation: {
    title: "Compensation Management",

    description:
      "Administrators configure course pay. Student referral discounts and instructor referral incentives are managed from the Referral Master menu.",

    api: compensationApi,

    mutationRoles: ["ADMIN"],

    permissions: {
      view: "PAYROLL_COMPENSATION_VIEW",
      create: "PAYROLL_COMPENSATION_CREATE",
      update: "PAYROLL_COMPENSATION_UPDATE",
      delete: "PAYROLL_COMPENSATION_DELETE",
    },

    fields: [
      createOnly(instructorSelect),
      createOnly(compensationCourseSelect),

      enumSelect(
        "compensation_type",
        "Compensation Type",
        COMPENSATION_TYPES,
        {
          required: true,
          defaultValue: "FIXED",
          helperText:
            "Only the amount fields required by this type are shown.",
        }
      ),

      field("fixed_amount", "Fixed Amount", "number", {
        min: 0,
        visibleWhen: (form) =>
          usesFixedAmount(form.compensation_type),
        requiredWhen: (form) =>
          usesFixedAmount(form.compensation_type),
      }),

      field(
        "commission_percentage",
        "Commission Percentage",
        "number",
        {
          min: 0,
          visibleWhen: (form) =>
            usesCommission(form.compensation_type),
          requiredWhen: (form) =>
            usesCommission(form.compensation_type),
        }
      ),

      field("currency_code", "Currency Code", "text", {
        required: true,
        defaultValue: "INR",
      }),

      field("effective_from", "Effective From", "date", {
        required: true,
      }),

      field("effective_until", "Effective Until", "date", {
        validate: (value, form) => {
          if (
            value &&
            form.effective_from &&
            new Date(value) < new Date(form.effective_from)
          ) {
            return "Effective Until must not be before Effective From.";
          }

          return "";
        },
      }),

      field("is_active", "Active", "boolean", {
        defaultValue: true,
      }),

      field("notes", "Notes", "textarea"),
    ],

    columns: [
      { field: "instructor_code", label: "Instructor Code" },
      { field: "instructor_name", label: "Instructor" },
      { field: "course_code", label: "Course Code" },
      { field: "course_title", label: "Course" },
      { field: "compensation_type", label: "Compensation Type" },

      {
        field: "fixed_amount",
        label: "Fixed Amount",
        render: (value, row) =>
          money(value, row?.currency_code),
      },

      {
        field: "commission_percentage",
        label: "Commission %",
        render: (value) =>
          value === null || value === undefined
            ? "-"
            : `${value}%`,
      },

      { field: "currency_code", label: "Currency" },

      {
        field: "effective_from",
        label: "Effective From",
        render: (value) => formatDate(value),
      },

      {
        field: "effective_until",
        label: "Effective Until",
        render: (value) => formatDate(value),
      },

      {
        field: "is_active",
        label: "Status",
        render: (value) => (value ? "Active" : "Inactive"),
      },
    ],

    filters: [
      { ...instructorFilter, roles: ["ADMIN"] },
      {
        ...courseFilter,
        loadOptionsForUser: compensationCourseSelect.loadOptionsForUser,
      },
      activeFilter,
    ],
  },

  // ==========================================================
  // PAYROLL PERIODS
  // ==========================================================

  period: {
    title: "Payroll Periods",

    description:
      "Create a payroll period, then calculate course earnings and consolidated instructor payroll from that period's row.",

    api: payrollPeriodApi,

    permissions: {
      view: "PAYROLL_PERIOD_VIEW",
      create: "PAYROLL_PERIOD_CREATE",
      update: "PAYROLL_PERIOD_UPDATE",
      delete: "PAYROLL_PERIOD_DELETE",
    },

    rowWorkflowAction: {
      label: "Calculate Payroll",
      columnLabel: "Payroll Action",
      permissions: [
        "PAYROLL_PERIOD_UPDATE",
        "PAYROLL_EARNING_CREATE",
        "PAYROLL_INSTRUCTOR_CREATE",
      ],
      getId: (row) => row.id,
      getLabel: (row) => {
        if (row?.payroll_review_locked || ["APPROVED", "CLOSED"].includes(row?.status)) {
          return "Locked";
        }
        if (row?.is_active === false) return "Inactive";
        if (row?.status === "PROCESSING") return "Calculating...";
        return row?.status === "PROCESSED" || row?.has_payroll
          ? "Recalculate Payroll"
          : "Calculate Payroll";
      },
      isDisabled: (row) =>
        row?.is_active === false ||
        ["PROCESSING", "APPROVED", "CLOSED"].includes(row?.status) ||
        Boolean(row?.payroll_review_locked),
      run: (periodId) => payrollPeriodApi.calculate(periodId),
      confirmTitle: "Calculate payroll for this period?",
      confirmMessage: (row) =>
        `${row?.period_code || "This period"} (${formatDate(row?.period_start)} – ${formatDate(row?.period_end)}): calculate eligible course earnings and create or refresh each instructor's consolidated payroll. Existing unapproved calculations will be refreshed.`,
      successMessage: (result) => {
        const incentiveTotal = Number(result.total_incentives || 0);
        const incentiveNote =
          incentiveTotal > 0
            ? ` Referral incentives included: ${incentiveTotal}.`
            : "";

        return `${result.payroll_count || 0} instructor payrolls and ${result.course_earning_count || 0} course earnings calculated for ${result.period_code || "the selected period"}.${incentiveNote}`;
      },
    },

    canEditRow: (row) => row?.status === "OPEN" && !row?.has_payroll,
    canDeleteRow: (row) => row?.status === "OPEN" && !row?.has_payroll,

    fields: [
      field("period_code", "Period Code", "text", {
        required: true,
      }),

      field("period_start", "Period Start", "date", {
        required: true,
      }),

      field("period_end", "Period End", "date", {
        required: true,
        validate: (value, form) => {
          if (
            value &&
            form.period_start &&
            new Date(value) < new Date(form.period_start)
          ) {
            return "Period End must not be before Period Start.";
          }

          return "";
        },
      }),

      field("is_active", "Active", "boolean", {
        defaultValue: true,
      }),
    ],

    columns: [
      { field: "period_code", label: "Period Code" },

      {
        field: "period_start",
        label: "Start Date",
        render: (value) => formatDate(value),
      },

      {
        field: "period_end",
        label: "End Date",
        render: (value) => formatDate(value),
      },

      { field: "status", label: "Status" },

      { field: "processed_by_username", label: "Processed By" },

      {
        field: "is_active",
        label: "Active",
        render: (value) => (value ? "Yes" : "No"),
      },
    ],

    filters: [
      periodIdFilter,
      statusFilter("status", "Status", PERIOD_STATUSES),
      activeFilter,
    ],
  },

  // ==========================================================
  // INSTRUCTOR PAYROLL
  // ==========================================================

  instructorPayroll: {
    title: "Instructor Payroll",

    description:
      "Review consolidated course earnings and automatically calculated student incentives. Enter any approved deductions, then approve the payroll for payment.",

    api: instructorPayrollApi,

    permissions: {
      view: "PAYROLL_INSTRUCTOR_VIEW",
      create: "PAYROLL_INSTRUCTOR_CREATE",
      update: "PAYROLL_INSTRUCTOR_UPDATE",
      delete: "PAYROLL_INSTRUCTOR_DELETE",
    },

    allowCreate: false,
    allowDelete: false,
    canEditRow: (row) => row?.status === "CALCULATED",

    fields: [
      editOnly(field("total_deductions", "Total Deductions", "number", {
        min: 0,
        defaultValue: 0,
        helperText: "Cannot exceed course earnings plus the automatically calculated student incentive.",
      })),

      editOnly(
        enumSelect(
          "status",
          "Status",
          ["DRAFT", "CALCULATED", "APPROVED", "CANCELLED"],
          {
            defaultValue: "CALCULATED",
            helperText:
              "Review the automatically calculated incentive and deductions. Approved payrolls can then be paid.",
          }
        )
      ),
    ],

    columns: [
      { field: "payroll_number", label: "Payroll Number" },
      { field: "period_code", label: "Period" },
      { field: "instructor_code", label: "Instructor Code" },
      { field: "instructor_name", label: "Instructor" },

      {
        field: "total_earnings",
        label: "Course Earnings",
        render: (value, row) =>
          money(value, row?.currency_code),
      },

      {
        field: "incentive_amount",
        label: "Referral Enrollment Incentive",
        render: (value, row) =>
          money(value, row?.currency_code),
      },

      {
        field: "total_deductions",
        label: "Total Deductions",
        render: (value, row) =>
          money(value, row?.currency_code),
      },

      {
        field: "net_amount",
        label: "Net Amount",
        render: (value, row) =>
          money(value, row?.currency_code),
      },

      { field: "status", label: "Status" },
    ],

    filters: [
      instructorFilter,
      periodFilter,
      statusFilter(
        "status",
        "Status",
        INSTRUCTOR_PAYROLL_STATUSES
      ),
    ],
  },

  // ==========================================================
  // COURSE EARNINGS
  // ==========================================================

  courseEarning: {
    title: "Course Earnings",

    description:
      "System-calculated course earnings and referral incentives for eligible paid enrollments attributed to each instructor.",

    api: courseEarningApi,

    permissions: {
      view: "PAYROLL_EARNING_VIEW",
      create: "PAYROLL_EARNING_CREATE",
      update: "PAYROLL_EARNING_UPDATE",
      delete: "PAYROLL_EARNING_DELETE",
    },

    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,

    fields: [],

    columns: [
      { field: "payroll_number", label: "Payroll Number" },
      { field: "instructor_code", label: "Instructor Code" },
      { field: "instructor_name", label: "Instructor" },
      { field: "course_code", label: "Course Code" },
      { field: "course_title", label: "Course" },
      { field: "compensation_type", label: "Compensation Type" },
      { field: "earning_type", label: "Earning Type" },

      { field: "eligible_student_count", label: "Eligible Referred Enrollments" },

      {
        field: "gross_course_revenue",
        label: "Gross Course Revenue",
        render: (value, row) => money(value, row?.currency_code),
      },
      {
        field: "eligible_course_revenue",
        label: "Eligible Revenue",
        render: (value, row) => money(value, row?.currency_code),
      },
      {
        field: "fixed_amount",
        label: "Fixed",
        render: (value, row) => money(value, row?.currency_code),
      },
      {
        field: "commission_amount",
        label: "Commission",
        render: (value, row) => money(value, row?.currency_code),
      },
      {
        field: "student_amount",
        label: "Referral Enrollment Incentive",
        render: (value, row) => money(value, row?.currency_code),
      },

      {
        field: "total_earning",
        label: "Total Course Compensation",
        render: (value, row) =>
          money(value, row?.currency_code),
      },
    ],

    filters: [
      instructorFilter,
      courseFilter,
      payrollFilter,
      compensationFilter,
    ],
  },

  // ==========================================================
  // PAYMENT MANAGEMENT
  // ==========================================================

  payment: {
    title: "Payment Management",

    description:
      "Record manual salary transfers. The payable amount and currency come from the approved payroll.",

    api: paymentApi,

    permissions: {
      view: "PAYROLL_PAYMENT_VIEW",
      create: "PAYROLL_PAYMENT_CREATE",
      update: "PAYROLL_PAYMENT_UPDATE",
      delete: "PAYROLL_PAYMENT_DELETE",
    },

    allowDelete: false,
    canEditRow: (row) => row?.status !== "SUCCESS",

    fields: [
      createOnly(approvedPayrollSelect),

      createOnly(enumSelect("payment_method", "Payment Method", PAYMENT_METHODS, {
        required: true,
        defaultValue: "BANK_TRANSFER",
      })),

      editOnly(
        enumSelect("status", "Payment Status", PAYMENT_STATUSES, {
          defaultValue: "INITIATED",
        })
      ),

      field("payment_gateway", "Payment Gateway"),

      field("bank_reference", "Bank / Transaction Reference", "text", {
        requiredWhen: (form) => form.status === "SUCCESS",
        helperText: "Required when recording a successful salary transfer.",
      }),

      field("failure_reason", "Failure Reason", "textarea", {
        visibleWhen: (form) => form.status === "FAILED",
        requiredWhen: (form) => form.status === "FAILED",
      }),
    ],

    columns: [
      { field: "payment_number", label: "Payment Number" },
      { field: "payroll_number", label: "Payroll Number" },
      { field: "instructor_code", label: "Instructor Code" },
      { field: "instructor_name", label: "Instructor" },
      { field: "period_code", label: "Period" },
      { field: "payment_method", label: "Payment Method" },

      {
        field: "amount",
        label: "Amount",
        render: (value, row) =>
          money(value, row?.currency_code),
      },

      { field: "currency_code", label: "Currency" },
      { field: "status", label: "Payment Status" },
      { field: "bank_reference", label: "Bank Reference" },
    ],

    filters: [
      statusFilter("status", "Payment Status", PAYMENT_STATUSES),
      payrollFilter,
      instructorFilter,
    ],
  },
};
