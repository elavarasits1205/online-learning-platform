
const adminService =
    require("../services/admin.service");
const {
    getApprovalAudit,
    getUpdateAudit,
    getDeleteAudit
} = require("../utils/audit");

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// PostgreSQL BIGINT IDs must remain strings.
function validateId(value) {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
        throw createError("Invalid user ID");
    }

    return value;
}

function validatePagination(query) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw createError(
            "Page must be positive and limit must be between 1 and 100"
        );
    }

    return { page, limit };
}

function validateOptionalString(value, fieldName, maxLength) {
    if (value != null && typeof value !== "string") {
        throw createError(`${fieldName} must be a string or null`);
    }

    if (typeof value === "string" && value.trim().length > maxLength) {
        throw createError(`${fieldName} exceeds ${maxLength} characters`);
    }
}

// GET /api/admin/users
async function getUsers(req, res, next) {
    try {
        const { page, limit } = validatePagination(req.query);

        const search = String(req.query.search ?? "").trim();
        const role = String(req.query.role ?? "").trim().toUpperCase();
        const status = String(req.query.status ?? "").trim().toUpperCase();

        if (role && !["ADMIN", "STUDENT", "INSTRUCTOR"].includes(role)) {
            throw createError("Invalid role filter");
        }

        if (
            status &&
            !["PENDING", "APPROVED", "REJECTED"].includes(status)
        ) {
            throw createError("Invalid approval status filter");
        }

        const result = await adminService.getUsers({
            search,
            role,
            status,
            page,
            limit
        });

        return res.status(200).json({
            success: true,
            data: result.users,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/admin/users/:id
async function getUserById(req, res, next) {
    try {
        const id = validateId(req.params.id);
        const user = await adminService.getUserById(id);

        if (!user) {
            throw createError("User not found", 404);
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
}

// PUT /api/admin/users/:id
// PUT /api/admin/users/:id
async function updateUser(req, res, next) {
    try {
        const id = validateId(req.params.id);

        const {
            username,
            email,
            firstName,
            lastName,
            phoneNumber,
            isActive,
            isLocked,
            emailVerifiedAt,
            phoneVerifiedAt
        } = req.body ?? {};

        // Required profile fields
        if (
            typeof username !== "string" ||
            !username.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof firstName !== "string" ||
            !firstName.trim()
        ) {
            throw createError(
                "Username, email and first name are required"
            );
        }

        // Validate optional text fields
        validateOptionalString(lastName, "Last name", 100);
        validateOptionalString(phoneNumber, "Phone number", 30);

        // Validate account flags
        if (
            typeof isActive !== "boolean" ||
            typeof isLocked !== "boolean"
        ) {
            throw createError(
                "isActive and isLocked must be boolean values"
            );
        }

        // Validate verification timestamps
        function validateTimestamp(value, fieldName) {
            if (value == null) {
                return null;
            }

            if (
                typeof value !== "string" ||
                Number.isNaN(Date.parse(value))
            ) {
                throw createError(
                    `${fieldName} must be a valid date-time or null`
                );
            }

            return new Date(value).toISOString();
        }

        const normalized = {
            username: username.trim(),
            email: email.trim().toLowerCase(),
            firstName: firstName.trim(),
            lastName: lastName?.trim() || null,
            phoneNumber: phoneNumber?.trim() || null,
            isActive,
            isLocked,
            emailVerifiedAt: validateTimestamp(
                emailVerifiedAt,
                "emailVerifiedAt"
            ),
            phoneVerifiedAt: validateTimestamp(
                phoneVerifiedAt,
                "phoneVerifiedAt"
            )
        };

        if (
            normalized.username.length > 100 ||
            normalized.email.length > 255 ||
            normalized.firstName.length > 100
        ) {
            throw createError(
                "One or more fields exceed allowed lengths"
            );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
            throw createError("A valid email address is required");
        }

        const { updatedBy } = getUpdateAudit(req);

        const user = await adminService.updateUser(id, {
            ...normalized,
            updatedBy
        });

        if (!user) {
            throw createError("User not found", 404);
        }

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user
        });
    } catch (error) {
        next(error);
    }
}

// DELETE /api/admin/users/:id
// Soft delete; the database record is retained.
async function deleteUser(req, res, next) {
    try {
        const id = validateId(req.params.id);

        if (String(req.user?.id) === id) {
            throw createError("You cannot delete your own account");
        }

        const { updatedBy } = getDeleteAudit(req);
        const user = await adminService.deleteUser(id, updatedBy);

        if (!user) {
            throw createError("User not found or already deleted", 404);
        }

        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
            data: user
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/admin/users/pending
async function getPendingUsers(req, res, next) {
    try {
        const users = await adminService.getPendingUsers();

        return res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
}

// POST /api/admin/users/:id/approve
async function approveUser(req, res, next) {
    try {
        const id = validateId(req.params.id);
        const { updatedBy } = getApprovalAudit(req);

        const user = await adminService.approveUser(id, updatedBy);

        if (!user) {
            throw createError(
                "Pending instructor not found; it may already be processed",
                404
            );
        }

        return res.status(200).json({
            success: true,
            message: "Instructor approved successfully",
            data: {
                id: user.id,
                approvalStatus: user.approval_status,
                isActive: user.is_active,
                approvedAt: user.approved_at,
                approvedBy: user.approved_by,
                referralCode: user.referral_code
            }
        });
    } catch (error) {
        next(error);
    }
}

// POST /api/admin/users/:id/reject
async function rejectUser(req, res, next) {
    try {
        const id = validateId(req.params.id);
        const { updatedBy } = getApprovalAudit(req);
        const { reason } = req.body ?? {};

        if (reason != null && typeof reason !== "string") {
            throw createError("Reason must be a string");
        }

        if (reason && reason.length > 5000) {
            throw createError("Reason must not exceed 5000 characters");
        }

        const user = await adminService.rejectUser(
            id,
            updatedBy,
            reason?.trim() || null
        );

        if (!user) {
            throw createError(
                "Pending instructor not found; it may already be processed",
                404
            );
        }

        return res.status(200).json({
            success: true,
            message: "Instructor rejected successfully",
            data: {
                id: user.id,
                approvalStatus: user.approval_status,
                isActive: user.is_active,
                rejectionReason: user.rejection_reason
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getPendingUsers,
    approveUser,
    rejectUser
};
