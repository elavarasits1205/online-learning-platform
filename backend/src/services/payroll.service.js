
const repository = require("../repositories/payroll.repository");

class PayrollError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

const VALID_ID = /^[1-9]\d*$/;

const COMPENSATION_TYPES = [
    "FIXED",
    "COMMISSION",
    "FIXED_PLUS_COMMISSION"
];

const PERIOD_STATUSES = [
    "OPEN",
    "PROCESSING",
    "PROCESSED",
    "APPROVED",
    "CLOSED"
];

const INSTRUCTOR_PAYROLL_STATUSES = [
    "DRAFT",
    "CALCULATED",
    "APPROVED",
    "PAID",
    "CANCELLED"
];

const PAYMENT_METHODS = ["BANK_TRANSFER", "UPI", "OTHER"];

const PAYMENT_STATUSES = [
    "INITIATED",
    "PROCESSING",
    "SUCCESS",
    "FAILED",
    "CANCELLED"
];

const INSTRUCTOR_PAYROLL_TRANSITIONS = {
    DRAFT: ["DRAFT", "CANCELLED"],
    CALCULATED: ["CALCULATED", "APPROVED", "CANCELLED"],
    // PAID is only set by the successful payment transaction.
    APPROVED: ["APPROVED", "CANCELLED"],
    PAID: ["PAID"],
    CANCELLED: ["CANCELLED"]
};

const PAYMENT_TRANSITIONS = {
    INITIATED: ["INITIATED", "PROCESSING", "SUCCESS", "FAILED", "CANCELLED"],
    PROCESSING: ["PROCESSING", "SUCCESS", "FAILED", "CANCELLED"],
    SUCCESS: ["SUCCESS"],
    // A retry is a new payment record so each transfer attempt remains auditable.
    FAILED: ["FAILED", "CANCELLED"],
    CANCELLED: ["CANCELLED"]
};

const COMPENSATION_TYPE_FIELDS = {
    FIXED: ["fixed_amount"],
    COMMISSION: ["commission_percentage"],
    FIXED_PLUS_COMMISSION: ["fixed_amount", "commission_percentage"]
};

const validId = (value, field = "ID") => {
    if (typeof value !== "string" || !VALID_ID.test(value)) {
        throw new PayrollError(`${field} must be a valid positive BIGINT string.`);
    }
    return value;
};

const normalizeEnum = (value, allowed, field) => {
    if (value === undefined || value === null || value === "") return undefined;

    const normalized = String(value).trim().toUpperCase();

    if (!allowed.includes(normalized)) {
        throw new PayrollError(
            `${field} must be one of: ${allowed.join(", ")}.`
        );
    }

    return normalized;
};

const assertStatusTransition = (current, next, transitions, label) => {
    if (!next || !current || next === current) return;

    const allowed = transitions[current] || [];

    if (!allowed.includes(next)) {
        throw new PayrollError(
            `Cannot change ${label} status from ${current} to ${next}.`,
            409
        );
    }
};

const isValidDate = (value) => {
    if (!value) return false;
    return !Number.isNaN(new Date(value).getTime());
};

const getUserId = (user) => {
    const id = user?.id ?? user?.sub;
    if (id === undefined || id === null) {
        throw new PayrollError("Authenticated user ID not found.", 401);
    }
    return validId(String(id), "User ID");
};

const hasRole = (user, role) => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.some((r) =>
        String(typeof r === "string" ? r : r?.code).toUpperCase() === role
    );
};

const isAdmin = (user) => hasRole(user, "ADMIN");
const isInstructor = (user) => hasRole(user, "INSTRUCTOR");

const PAYROLL_RESOURCE_CODES = {
    compensation: "PAYROLL_COMPENSATION",
    period: "PAYROLL_PERIOD",
    instructorPayroll: "PAYROLL_INSTRUCTOR",
    courseEarning: "PAYROLL_EARNING",
    payment: "PAYROLL_PAYMENT",
};

const hasPermission = (user, code) => {
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    return permissions.some((permission) =>
        String(
            typeof permission === "string"
                ? permission
                : permission?.code ?? permission?.permission_code
        )
            .trim()
            .toUpperCase() === code
    );
};

const assertCompensationPermission = (user, action) => {
    if (!isAdmin(user)) {
        throw new PayrollError(
            "Only administrators can manage instructor course compensation.",
            403
        );
    }
    assertPayrollPermission(user, "compensation", action);
};

const assertPayrollPermission = (user, type, action) => {
    if (isAdmin(user)) return;

    const prefix = PAYROLL_RESOURCE_CODES[type];
    const permissionCode = prefix ? `${prefix}_${action}` : "";
    if (!permissionCode || !hasPermission(user, permissionCode)) {
        throw new PayrollError("Payroll permission denied.", 403);
    }
};

const assertPayrollReadPermission = (user, type) => {
    if (isAdmin(user)) return;

    if (
        isInstructor(user) &&
        ["instructorPayroll", "courseEarning", "payment"].includes(type)
    ) {
        if (
            hasPermission(user, "INSTRUCTOR_SELF_PAYROLL_VIEW") ||
            hasPermission(user, `${PAYROLL_RESOURCE_CODES[type]}_VIEW`)
        ) {
            return;
        }

        throw new PayrollError("Instructor payroll view permission denied.", 403);
    }

    assertPayrollPermission(user, type, "VIEW");
};

const assertPayrollMutationRole = (user) => {
    if (isInstructor(user) && !isAdmin(user)) {
        throw new PayrollError(
            "Instructor payroll access is read-only. Contact an administrator for changes.",
            403
        );
    }
};

const getInstructorId = async (user) => {
    if (!isInstructor(user)) {
        throw new PayrollError("Instructor access required.", 403);
    }

    const instructorId = await repository.getInstructorIdByUserId(
        getUserId(user)
    );

    if (!instructorId) {
        throw new PayrollError("Instructor profile not found.", 404);
    }

    return instructorId;
};

const validateResource = (type, body, creating = true, existing = null) => {
    const data = { ...body };

    const numberFields = [
        "fixed_amount",
        "commission_percentage",
        "total_earnings",
        "incentive_amount",
        "total_deductions",
        "net_amount",
        "gross_course_revenue",
        "eligible_course_revenue",
        "rate_percentage",
        "rate_amount",
        "commission_amount",
        "student_amount",
        "total_earning",
        "amount"
    ];

    const integerFields = ["eligible_student_count"];

    for (const field of numberFields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
            const value = Number(data[field]);
            if (!Number.isFinite(value) || value < 0) {
                throw new PayrollError(`${field} must be a valid non-negative number.`);
            }
            data[field] = value;
        } else if (data[field] === "") {
            data[field] = null;
        }
    }

    for (const field of integerFields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
            const value = Number(data[field]);
            if (!Number.isInteger(value) || value < 0) {
                throw new PayrollError(`${field} must be a non-negative integer.`);
            }
            data[field] = value;
        } else if (data[field] === "") {
            data[field] = 0;
        }
    }

    if (type === "compensation") {
        if (creating) {
            for (const field of [
                "instructor_id",
                "course_id",
                "compensation_type",
                "currency_code",
                "effective_from"
            ]) {
                if (data[field] === undefined || data[field] === null || data[field] === "") {
                    throw new PayrollError(`${field} is required.`);
                }
            }
        }

        if (data.instructor_id !== undefined) {
            data.instructor_id = validId(String(data.instructor_id), "instructor_id");
        }
        if (data.course_id !== undefined) {
            data.course_id = validId(String(data.course_id), "course_id");
        }

        if (data.compensation_type !== undefined) {
            const compensationType = normalizeEnum(
                data.compensation_type,
                COMPENSATION_TYPES,
                "compensation_type"
            );

            if (compensationType) data.compensation_type = compensationType;
            else delete data.compensation_type;
        }

        const compensationType =
            data.compensation_type ?? existing?.compensation_type;

        if (!compensationType) {
            throw new PayrollError("compensation_type is required.");
        }

        const merged = { ...(existing || {}), ...data };
        const typeFields = COMPENSATION_TYPE_FIELDS[compensationType] || [];

        for (const field of typeFields) {
            if (
                merged[field] === undefined ||
                merged[field] === null ||
                merged[field] === ""
            ) {
                throw new PayrollError(
                    `${field} is required for ${compensationType} compensation.`
                );
            }
        }

        // Clear amount fields that no longer apply when the compensation
        // type changes, so editing a record cannot leave stale values.
        for (const field of ["fixed_amount", "commission_percentage"]) {
            if (!typeFields.includes(field)) {
                data[field] = null;
            }
        }

        if (
            data.commission_percentage !== undefined &&
            data.commission_percentage !== null &&
            data.commission_percentage > 100
        ) {
            throw new PayrollError("commission_percentage cannot exceed 100.");
        }

        const effectiveFrom = data.effective_from ?? existing?.effective_from;
        const effectiveUntil = data.effective_until ?? existing?.effective_until;

        if (effectiveFrom && !isValidDate(effectiveFrom)) {
            throw new PayrollError("effective_from must be a valid date.");
        }

        if (effectiveUntil && !isValidDate(effectiveUntil)) {
            throw new PayrollError("effective_until must be a valid date.");
        }

        if (
            effectiveFrom &&
            effectiveUntil &&
            new Date(effectiveUntil) < new Date(effectiveFrom)
        ) {
            throw new PayrollError(
                "effective_until must not be before effective_from."
            );
        }
    }

    if (type === "period") {
        if (creating) {
            for (const field of ["period_code", "period_start", "period_end"]) {
                if (!data[field]) throw new PayrollError(`${field} is required.`);
            }
        }

        if (data.status !== undefined) {
            const status = normalizeEnum(data.status, PERIOD_STATUSES, "status");

            if (status) data.status = status;
            else delete data.status;
        }

        if (creating) data.status = "OPEN";

        if (data.period_start && !isValidDate(data.period_start)) {
            throw new PayrollError("period_start must be a valid date.");
        }

        if (data.period_end && !isValidDate(data.period_end)) {
            throw new PayrollError("period_end must be a valid date.");
        }

        if (
            data.period_start &&
            data.period_end &&
            new Date(data.period_start) > new Date(data.period_end)
        ) {
            throw new PayrollError("period_end must not be before period_start.");
        }

        // Processing metadata must be set by a controlled backend workflow.
        delete data.processed_by;
        delete data.processed_at;
    }

    if (type === "instructorPayroll") {
        if (creating) {
            for (const field of [
                "payroll_period_id",
                "instructor_id",
                "payroll_number",
                "currency_code"
            ]) {
                if (!data[field]) throw new PayrollError(`${field} is required.`);
            }
        }

        if (data.payroll_period_id !== undefined) {
            data.payroll_period_id = validId(
                String(data.payroll_period_id),
                "payroll_period_id"
            );
        }

        if (data.instructor_id !== undefined) {
            data.instructor_id = validId(
                String(data.instructor_id),
                "instructor_id"
            );
        }

        delete data.approved_at;
        delete data.approved_by;
        delete data.paid_at;

        if (creating) {
            data.total_earnings = data.total_earnings ?? 0;
            data.incentive_amount = data.incentive_amount ?? 0;
            data.total_deductions = data.total_deductions ?? 0;
            data.net_amount =
                data.total_earnings + data.incentive_amount - data.total_deductions;
            data.status = "DRAFT";
        } else {
            if (data.status !== undefined) {
                const status = normalizeEnum(
                    data.status,
                    INSTRUCTOR_PAYROLL_STATUSES,
                    "status"
                );

                if (status) {
                    assertStatusTransition(
                        existing?.status,
                        status,
                        INSTRUCTOR_PAYROLL_TRANSITIONS,
                        "instructor payroll"
                    );
                    data.status = status;
                } else {
                    delete data.status;
                }
            }

            if (
                data.total_earnings !== undefined ||
                data.total_deductions !== undefined
            ) {
                const earnings = Number(
                    data.total_earnings ?? existing?.total_earnings ?? 0
                );
                const deductions = Number(
                    data.total_deductions ?? existing?.total_deductions ?? 0
                );
                data.net_amount = earnings - deductions;
            }
        }
    }

    if (type === "courseEarning") {
        if (creating) {
            for (const field of [
                "instructor_payroll_id",
                "course_id",
                "compensation_id",
                "total_earning"
            ]) {
                if (data[field] === undefined || data[field] === null || data[field] === "") {
                    throw new PayrollError(`${field} is required.`);
                }
            }
        }

        for (const field of [
            "instructor_payroll_id",
            "course_id",
            "compensation_id"
        ]) {
            if (data[field] !== undefined) {
                data[field] = validId(String(data[field]), field);
            }
        }

        if (data.earning_type !== undefined) {
            const earningType = normalizeEnum(
                data.earning_type,
                COMPENSATION_TYPES,
                "earning_type"
            );

            if (earningType) data.earning_type = earningType;
            else delete data.earning_type;
        }

        if (
            data.rate_percentage !== undefined &&
            data.rate_percentage !== null &&
            data.rate_percentage > 100
        ) {
            throw new PayrollError("rate_percentage cannot exceed 100.");
        }

        // Instructor ID is derived from the selected payroll record.
        delete data.instructor_id;
    }

    if (type === "payment") {
        if (creating) {
            for (const field of ["instructor_payroll_id", "payment_method"]) {
                if (data[field] === undefined || data[field] === null || data[field] === "") {
                    throw new PayrollError(`${field} is required.`);
                }
            }
        }

        if (data.instructor_payroll_id !== undefined) {
            data.instructor_payroll_id = validId(
                String(data.instructor_payroll_id),
                "instructor_payroll_id"
            );
        }

        if (data.payment_method !== undefined) {
            const method = normalizeEnum(
                data.payment_method,
                PAYMENT_METHODS,
                "payment_method"
            );

            if (method) data.payment_method = method;
            else delete data.payment_method;
        }

        if (data.amount !== undefined && data.amount !== null && data.amount <= 0) {
            throw new PayrollError("Payment amount must be greater than zero.");
        }

        // Timestamps must be set by the payment workflow.
        delete data.processed_at;
        delete data.failed_at;

        if (creating) {
            data.status = "INITIATED";
            data.initiated_at = new Date();
            delete data.failure_reason;
        } else if (data.status !== undefined) {
            const status = normalizeEnum(data.status, PAYMENT_STATUSES, "status");

            if (status) {
                assertStatusTransition(
                    existing?.status,
                    status,
                    PAYMENT_TRANSITIONS,
                    "payment"
                );
                data.status = status;
            } else {
                delete data.status;
            }
        }

        if (
            data.status === "FAILED" &&
            !String(data.failure_reason ?? existing?.failure_reason ?? "").trim()
        ) {
            throw new PayrollError("Provide a failure reason when recording an unsuccessful transfer.");
        }
    }

    return data;
};

const getAll = async (type, query, user) => {
    const filters = { ...query };
    assertPayrollReadPermission(user, type);

    if (
        type === "compensation" &&
        isInstructor(user) &&
        !isAdmin(user)
    ) {
        filters.instructorId = await getInstructorId(user);
    } else if (
        type !== "period" &&
        isInstructor(user) &&
        !isAdmin(user)
    ) {
        const instructorId = await getInstructorId(user);
        filters.instructorId = instructorId;
        filters.selfService = true;
    } else if (filters.instructorId) {
        filters.instructorId = validId(
            String(filters.instructorId),
            "instructorId"
        );
    }

    if (filters.courseId) {
        filters.courseId = validId(String(filters.courseId), "courseId");
    }
    if (filters.periodId) {
        filters.periodId = validId(String(filters.periodId), "periodId");
    }
    if (filters.payrollId) {
        filters.payrollId = validId(String(filters.payrollId), "payrollId");
    }

    return repository.getAll(type, filters);
};

const getById = async (type, id, user) => {
    id = validId(String(id));
    assertPayrollReadPermission(user, type);

    if (
        isInstructor(user) &&
        !isAdmin(user) &&
        type !== "period"
    ) {
        const instructorId = await getInstructorId(user);

        if (type === "compensation") {
            const record = await repository.getByIdForInstructor(
                type,
                id,
                instructorId
            );

            if (!record) throw new PayrollError("Record not found.", 404);
            return record;
        }

        const record = await repository.getByIdForInstructor(
            type,
            id,
            instructorId
        );

        if (!record) throw new PayrollError("Record not found.", 404);
        return record;
    }

    const record = await repository.getById(type, id);
    if (!record) throw new PayrollError("Record not found.", 404);

    return record;
};

const create = async (type, body, user) => {
    assertPayrollMutationRole(user);

    if (type === "compensation") {
        assertCompensationPermission(user, "CREATE");
    } else {
        assertPayrollPermission(user, type, "CREATE");
    }

    if (type === "courseEarning") {
        throw new PayrollError(
            "Course earnings are generated by payroll period calculation and cannot be entered manually.",
            409
        );
    }
    if (type === "instructorPayroll") {
        throw new PayrollError(
            "Instructor payrolls are generated from calculated course earnings.",
            409
        );
    }

    const userId = getUserId(user);
    const instructorId =
        isInstructor(user) &&
        !isAdmin(user) &&
        type === "compensation"
            ? await getInstructorId(user)
            : null;
    const data = validateResource(
        type,
        instructorId ? { ...body, instructor_id: instructorId } : body,
        true
    );

    if (type === "period") {
        return repository.createPayrollPeriod(data, userId);
    }

    if (type === "compensation") {
        if (instructorId) data.instructor_id = instructorId;
        const assigned = await repository.isCourseAssignedToInstructor(
            data.course_id,
            data.instructor_id
        );

        if (!assigned) {
            throw new PayrollError(
                "Course compensation can only be configured for a course assigned to the selected instructor.",
                409
            );
        }
    }

    if (type === "payment") {
        const payroll = await repository.getById(
            "instructorPayroll",
            data.instructor_payroll_id
        );

        if (!payroll) {
            throw new PayrollError("Instructor payroll not found.", 404);
        }

        if (
            isInstructor(user) &&
            !isAdmin(user) &&
            String(payroll.instructor_id) !==
                String(await getInstructorId(user))
        ) {
            throw new PayrollError("Payroll record not found.", 404);
        }

        if (payroll.status !== "APPROVED") {
            throw new PayrollError(
                "Payment can only be initiated for an approved payroll.",
                409
            );
        }

        return repository.initiatePayrollPayment(data, userId);
    }

    return repository.create(type, data, userId);
};

const update = async (type, id, body, user) => {
    assertPayrollMutationRole(user);

    if (type === "compensation") {
        assertCompensationPermission(user, "UPDATE");
    } else {
        assertPayrollPermission(user, type, "UPDATE");
    }

    id = validId(String(id));
    const userId = getUserId(user);
    const instructorId =
        isInstructor(user) &&
        !isAdmin(user) &&
        type !== "period"
            ? await getInstructorId(user)
            : null;
    const existing = instructorId
        ? await repository.getByIdForInstructor(type, id, instructorId)
        : await repository.getById(type, id);

    if (!existing) throw new PayrollError("Record not found.", 404);

    if (type === "courseEarning") {
        throw new PayrollError(
            "Calculated course earnings are read-only. Recalculate the open payroll period to refresh them.",
            409
        );
    }

    if (
        type === "instructorPayroll" &&
        ["APPROVED", "PAID", "CANCELLED"].includes(existing.status)
    ) {
        throw new PayrollError("Finalized or cancelled payroll cannot be edited.", 409);
    }

    if (type === "payment" && existing.status === "SUCCESS") {
        throw new PayrollError("Successful payment cannot be edited.", 409);
    }

    const data = validateResource(type, body, false, existing);

    if (type === "compensation") {
        const assigned = await repository.isCourseAssignedToInstructor(
            existing.course_id,
            existing.instructor_id
        );

        if (!assigned) {
            throw new PayrollError(
                "Course compensation can only be configured for a course assigned to the selected instructor.",
                409
            );
        }
    }

    if (type === "period") {
        if (Object.prototype.hasOwnProperty.call(body || {}, "status")) {
            throw new PayrollError("Payroll period status is controlled by the calculation workflow.", 409);
        }
        if (
            existing.status !== "OPEN" &&
            ["period_code", "period_start", "period_end"].some((field) =>
                Object.prototype.hasOwnProperty.call(body || {}, field)
            )
        ) {
            throw new PayrollError("A processed payroll period cannot have its dates or code changed.", 409);
        }
        if (
            existing.status === "OPEN" &&
            ["period_code", "period_start", "period_end"].some((field) =>
                Object.prototype.hasOwnProperty.call(body || {}, field)
            ) &&
            await repository.hasPayrollForPeriod(id)
        ) {
            throw new PayrollError("A payroll period with generated payroll records cannot be edited.", 409);
        }
    }

    // Do not allow changing ownership/reference IDs through PUT.
    if (type === "instructorPayroll") {
        if (
            Object.prototype.hasOwnProperty.call(body || {}, "incentive_amount") ||
            Object.prototype.hasOwnProperty.call(body || {}, "incentive_notes")
        ) {
            throw new PayrollError(
                "Referral enrollment incentives are calculated from the admin referral master settings and cannot be entered manually.",
                409
            );
        }
        if (
            Object.prototype.hasOwnProperty.call(body || {}, "total_earnings") ||
            Object.prototype.hasOwnProperty.call(body || {}, "net_amount")
        ) {
            throw new PayrollError("Payroll earnings and net amount are calculated from course earnings.", 409);
        }
        const nextStatus = data.status || existing.status;
        if (nextStatus === "APPROVED" && existing.status !== "CALCULATED") {
            throw new PayrollError("Only calculated payrolls can be approved.", 409);
        }
        const editingReviewAmounts =
            Object.prototype.hasOwnProperty.call(body || {}, "total_deductions");
        if (editingReviewAmounts && existing.status !== "CALCULATED") {
            throw new PayrollError(
                "Deductions can only be changed while reviewing a calculated payroll.",
                409
            );
        }
        const deductions = Number(data.total_deductions ?? existing.total_deductions ?? 0);
        const earnings = Number(existing.total_earnings || 0);
        const incentive = Number(existing.incentive_amount || 0);
        if (deductions > earnings + incentive) {
            throw new PayrollError("Deductions cannot exceed course earnings plus referral enrollment incentives.");
        }
        data.net_amount = Math.round((earnings + incentive - deductions + Number.EPSILON) * 100) / 100;
        delete data.total_earnings;
        delete data.currency_code;
        delete data.instructor_id;
        delete data.payroll_period_id;
        delete data.payroll_number;
    }

    if (type === "payment") {
        delete data.instructor_payroll_id;
        delete data.payment_number;
        delete data.amount;
        delete data.currency_code;

        if (
            data.status === "SUCCESS" &&
            !String(data.bank_reference ?? existing.bank_reference ?? "").trim()
        ) {
            throw new PayrollError("Enter the bank or transaction reference before recording a successful transfer.");
        }

        if (data.status === "SUCCESS") {
            data.processed_at = new Date();
            data.failed_at = null;
            data.failure_reason = null;
        } else if (data.status === "FAILED") {
            data.failed_at = new Date();
            data.processed_at = null;
        } else if (data.status === "INITIATED") {
            data.initiated_at = new Date();
            data.failed_at = null;
            data.failure_reason = null;
        }
    }

    if (type === "compensation") {
        delete data.instructor_id;
        delete data.course_id;
    }

    if (type === "period" && data.status) {
        if (["PROCESSED", "APPROVED", "CLOSED"].includes(data.status)) {
            data.processed_at = new Date();
            data.processed_by = userId;
        } else {
            data.processed_at = null;
            data.processed_by = null;
        }
    }

    if (type === "instructorPayroll" && data.status === "APPROVED") {
        data.approved_at = new Date();
        data.approved_by = userId;
    }

    if (type === "payment") {
        return repository.updatePayrollPayment(id, data, existing.status, userId);
    }

    if (type === "instructorPayroll") {
        return repository.updateInstructorPayroll(id, data, existing.status, userId);
    }

    if (type === "period") {
        return repository.updatePayrollPeriod(id, data, userId);
    }

    const updated = await repository.update(type, id, data, userId);

    return updated;
};

const remove = async (type, id, user) => {
    assertPayrollMutationRole(user);

    if (type === "compensation") {
        assertCompensationPermission(user, "DELETE");
    } else {
        assertPayrollPermission(user, type, "DELETE");
    }

    id = validId(String(id));
    const userId = getUserId(user);
    const instructorId =
        isInstructor(user) &&
        !isAdmin(user) &&
        type !== "period"
            ? await getInstructorId(user)
            : null;
    const existing = instructorId
        ? await repository.getByIdForInstructor(type, id, instructorId)
        : await repository.getById(type, id);

    if (!existing) throw new PayrollError("Record not found.", 404);

    if (type === "courseEarning") {
        throw new PayrollError("Calculated course earnings cannot be deleted manually.", 409);
    }
    if (type === "instructorPayroll") {
        throw new PayrollError("Generated payroll records cannot be deleted. Cancel them through payroll review.", 409);
    }

    if (type === "period") {
        return repository.removePayrollPeriod(id, userId);
    }

    if (type === "compensation" && await repository.isCompensationUsed(id)) {
        throw new PayrollError(
            "This compensation rule is used in payroll history. Deactivate it instead of deleting it.",
            409
        );
    }

    if (type === "payment" && existing.status === "SUCCESS") {
        throw new PayrollError("Successful payment cannot be deleted.", 409);
    }

    if (type === "payment") {
        throw new PayrollError(
            "Payroll payment history is retained for audit. Mark an unsuccessful transfer as cancelled instead of deleting it.",
            409
        );
    }

    const deleted = await repository.remove(type, id, userId);
    if (!deleted) throw new PayrollError("Record not found.", 404);

    return { id };
};

const getOverview = async (user) => {
    assertPayrollReadPermission(user, "instructorPayroll");
    const instructorId = await getInstructorId(user);
    const result = await repository.getInstructorOverview(instructorId);

    if (!result) throw new PayrollError("Instructor profile not found.", 404);
    return result;
};

const getReports = async (query, user) => {
    if (!isAdmin(user) && !hasPermission(user, "PAYROLL_REPORT_VIEW")) {
        throw new PayrollError("Payroll report permission denied.", 403);
    }

    if (query.periodId) {
        validId(String(query.periodId), "periodId");
    }
    if (query.instructorId) {
        validId(String(query.instructorId), "instructorId");
    }
    if (query.courseId) {
        validId(String(query.courseId), "courseId");
    }

    return repository.getReports(query);
};

const getPayslip = async (payrollId, user) => {
    assertPayrollReadPermission(user, "instructorPayroll");
    const instructorId = await getInstructorId(user);
    payrollId = validId(String(payrollId), "payrollId");

    const result = await repository.getPayslip(payrollId, instructorId);

    if (!result) throw new PayrollError("Payslip not found.", 404);
    return result;
};

const getCompensationInstructorCourses = async (user) => {
    if (
        !isInstructor(user) ||
        !hasPermission(user, "PAYROLL_COMPENSATION_VIEW")
    ) {
        throw new PayrollError("Compensation permission denied.", 403);
    }

    const instructorId = await getInstructorId(user);
    return repository.getInstructorCourses(instructorId);
};

const calculatePeriod = async (periodId, user) => {
    assertPayrollMutationRole(user);
    const id = validId(String(periodId), "Payroll period ID");
    assertPayrollPermission(user, "period", "UPDATE");
    assertPayrollPermission(user, "courseEarning", "CREATE");
    assertPayrollPermission(user, "instructorPayroll", "CREATE");
    return repository.calculatePayrollPeriod(id, getUserId(user));
};

const getReferralSettings = async (user) => {
    if (!isAdmin(user)) {
        throw new PayrollError("Only administrators can view referral master settings.", 403);
    }
    assertCompensationPermission(user, "VIEW");
    return repository.getReferralSettings();
};

const saveReferralSettings = async (body, user) => {
    assertPayrollMutationRole(user);
    if (!isAdmin(user)) {
        throw new PayrollError("Only administrators can update referral master settings.", 403);
    }
    assertCompensationPermission(user, "UPDATE");

    const currencyCode = String(body?.currency_code || "").trim().toUpperCase();
    if (!/^[A-Z]{3,10}$/.test(currencyCode)) {
        throw new PayrollError("Currency Code must contain 3 to 10 letters.");
    }

    const parseAmount = (value, field) => {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99) {
            throw new PayrollError(`${field} must be a non-negative amount with at most 10 whole digits.`);
        }
        return Math.round((amount + Number.EPSILON) * 100) / 100;
    };

    const studentDiscountPercentage = Number(body?.student_discount_percentage ?? 0);
    if (!Number.isFinite(studentDiscountPercentage) ||
        studentDiscountPercentage < 0 || studentDiscountPercentage > 100) {
        throw new PayrollError("Student discount percentage must be between 0 and 100.");
    }

    return repository.upsertReferralSettings({
        currency_code: currencyCode,
        student_discount_amount: parseAmount(
            body?.student_discount_amount ?? body?.studentDiscountAmount ?? 0,
            "Student discount amount"
        ),
        student_discount_percentage:
            Math.round((studentDiscountPercentage + Number.EPSILON) * 100) / 100,
        instructor_incentive_amount: parseAmount(body?.instructor_incentive_amount, "Instructor incentive amount")
    }, getUserId(user));
};

module.exports = {
    PayrollError,
    getAll,
    getById,
    create,
    update,
    remove,
    getOverview,
    getReports,
    getPayslip,
    getCompensationInstructorCourses,
    calculatePeriod,
    getReferralSettings,
    saveReferralSettings
};
