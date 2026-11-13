const pool = require("../config/database");

const authRepository =
    require("../repositories/auth.repository");

const studentRepository =
    require("../repositories/student.repository");

const instructorRepository =
    require("../repositories/instructor.repository");

const {
    hashPassword,
    comparePassword
} = require("../utils/password");

const {
    getCreateAudit,
    getUpdateAudit,
    getDeleteAudit
} = require("../utils/audit");

const {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    getRefreshTokenExpiry,
    getAccessTokenExpiryInSeconds
} = require("./token.service");


// ============================================================
// HELPERS
// ============================================================

function createError(
    message,
    statusCode
) {

    const error = new Error(
        message
    );

    error.statusCode =
        statusCode;

    return error;
}


// ============================================================
// NORMALIZE REGISTRATION DATA
// ============================================================

function normalizeRegistrationData(
    data
) {

    return {

        username:
            data.username?.trim(),

        email:
            data.email?.trim().toLowerCase(),

        firstName:
            data.firstName?.trim(),

        lastName:
            data.lastName?.trim() || null,

        phoneNumber:
            data.phoneNumber?.trim() || null,

        password:
            data.password,

        dateOfBirth:
            data.dateOfBirth || null,

        gender:
            data.gender?.trim() || null,

                
        institutionId:
            data.institutionId != null
                ? String(data.institutionId).trim()
                : "",

        registerNumber:
            data.registerNumber?.trim() || "",

        specialization:
            data.specialization?.trim() || null,

        qualification:
            data.qualification?.trim() || null,

        experienceYears:
            data.experienceYears,

        designation:
            data.designation?.trim() || null,

        bio:
            data.bio?.trim() || null,

        referralCode:
            (data.referralCode ?? data.referral_code)?.trim().toUpperCase() || null
    };
}


// ============================================================
// COMMON VALIDATION
// ============================================================

function validateCommonRegistrationData(
    data
) {

    if (
        !data.username ||
        !data.email ||
        !data.firstName ||
        !data.password
    ) {

        throw createError(
            "Username, email, first name and password are required",
            400
        );
    }


    if (
        data.password.length < 8
    ) {

        throw createError(
            "Password must be at least 8 characters",
            400
        );
    }
}


// ============================================================
// STUDENT VALIDATION
// ============================================================
//
// IMPORTANT:
// institutionId and registerNumber are NOT required
// during public student registration.
// ============================================================


function validateStudentRegistrationData(data) {
    validateCommonRegistrationData(data);

    if (!/^[1-9]\d*$/.test(data.institutionId)) {
        throw createError(
            "Please select a valid institution",
            400
        );
    }

    if (!data.registerNumber) {
        throw createError(
            "College register number is required",
            400
        );
    }

    if (
        data.registerNumber.length > 50 ||
        !/^[a-zA-Z0-9/-]+$/.test(data.registerNumber)
    ) {
        throw createError(
            "Please enter a valid college register number",
            400
        );
    }
}



// ============================================================
// INSTRUCTOR VALIDATION
// ============================================================

function validateInstructorRegistrationData(
    data
) {

    validateCommonRegistrationData(
        data
    );

    if (!/^(?:\+1|\+44|\+61|\+65|\+91|\+971)\d{10}$/.test(data.phoneNumber || "")) {
        throw createError(
            "Phone number must contain a country code and exactly 10 digits",
            400
        );
    }
    if (
        data.experienceYears !== undefined &&
        data.experienceYears !== null &&
        data.experienceYears !== ""
    ) {
        const years = Number(data.experienceYears);
        if (!Number.isInteger(years) || years < 0 || years > 80) {
            throw createError(
                "Experience must be a whole number from 0 to 80 years",
                400
            );
        }
        data.experienceYears = years;
    }
}


// ============================================================
// AUTHORIZATION DATA
// ============================================================

async function getAuthorizationData(userId) {
    const roles = await authRepository.getUserRoles(userId);

    const permissions =
        await authRepository.getUserPermissions(userId);

    const roleCodes = roles.map(role => role.code);

    const permissionCodes =
        permissions.map(permission => permission.code);

    return {
        roles,
        permissions,
        roleCodes,
        permissionCodes
    };
}
// ============================================================
// REGISTER STUDENT
// ============================================================
//
// Public registration.
//
// created_by:
//     NULL
//
// created_at:
//     PostgreSQL
//
// updated_by:
//     NULL
//
// updated_at:
//     PostgreSQL
// ============================================================

async function registerStudent(
    input,
    audit = {}
) {

    const data =
        normalizeRegistrationData(input);

    validateStudentRegistrationData(data);


    const createdBy =
        audit.createdBy ?? null;


    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");


        
        // ----------------------------------------------------
        // VALIDATE INSTITUTION
        // ----------------------------------------------------

        const institutionResult = await client.query(
            `
                SELECT id
                FROM public.institution
                WHERE id = $1
                  AND is_active = TRUE
                  AND soft_delete = FALSE
                LIMIT 1
            `,
            [data.institutionId]
        );

        if (institutionResult.rowCount === 0) {
            throw createError(
                "Selected institution is invalid or inactive",
                400
            );
        }

        // ----------------------------------------------------
        // CHECK DUPLICATE REGISTER NUMBER
        // ----------------------------------------------------

        const existingStudent =
            await studentRepository.findStudentByRegisterNumber(
                client,
                data.institutionId,
                data.registerNumber
            );

        if (existingStudent) {
            throw createError(
                "This register number is already registered for this institution",
                409
            );
        }



        // ----------------------------------------------------
        // EMAIL CHECK
        // ----------------------------------------------------

        const existingEmail =
            await authRepository.findUserByEmailForRegistration(
                data.email,
                client
            );

        if (existingEmail) {

            throw createError(
                "Email already registered",
                409
            );
        }


        // ----------------------------------------------------
        // USERNAME CHECK
        // ----------------------------------------------------

        const existingUsername =
            await authRepository.findUserByUsernameForRegistration(
                data.username,
                client
            );

        if (existingUsername) {

            throw createError(
                "Username already registered",
                409
            );
        }


        // ----------------------------------------------------
        // HASH PASSWORD
        // ----------------------------------------------------

        const passwordHash =
            await hashPassword(
                data.password
            );


        // ----------------------------------------------------
        // CREATE USER
        // ----------------------------------------------------

        const user =
            await authRepository.createUser(
                client,
                {
                    username: data.username,
                    email: data.email,
                    passwordHash,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phoneNumber: data.phoneNumber,

                    isActive: true,

                    approvalStatus: "APPROVED",

                    createdBy
                }
            );


        // ----------------------------------------------------
        // STUDENT ROLE
        // ----------------------------------------------------

        const role =
            await authRepository.findRoleByCode(
                "STUDENT",
                client
            );

        if (!role) {

            throw createError(
                "STUDENT role not found",
                500
            );
        }


        await authRepository.assignRole(
            client,
            user.id,
            role.id,
            createdBy
        );


        // ----------------------------------------------------
        // RESOLVE INSTRUCTOR REFERRAL CODE
        // ----------------------------------------------------

        let referredByInstructorId = null;

        if (data.referralCode) {

            const referringInstructor =
                await instructorRepository.findActiveInstructorByReferralCode(
                    client,
                    data.referralCode
                );

            if (!referringInstructor) {
                throw createError(
                    "The instructor referral code is invalid or inactive",
                    400
                );
            }

            referredByInstructorId =
                referringInstructor.id;
        }


        // ----------------------------------------------------
        // CREATE STUDENT
        // ----------------------------------------------------
        // institution_id = NULL
        // register_number = NULL
        //
        // These will be assigned later during enrollment.

    
        const student =
            await studentRepository.createStudent(
                client,
                {
                    userId: user.id,

                    institutionId:
                        data.institutionId,

                    registerNumber:
                        data.registerNumber,

                    studentCode:
                        `STU-${user.id}`,

                    dateOfBirth:
                        data.dateOfBirth,

                    gender:
                        data.gender,

                    referredByInstructorId,

                    createdBy
                }
            );



        await client.query("COMMIT");


        return {
            user,
            student
        };

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}

// ============================================================
// REGISTER INSTRUCTOR
// ============================================================
//
// Public instructor registration.
//
// created_by = NULL
// ============================================================

async function registerInstructor(
    input,
    audit = {}
) {

    const data =
        normalizeRegistrationData(input);

    validateInstructorRegistrationData(data);


    const createdBy =
        audit.createdBy ?? null;


    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");


        // ----------------------------------------------------
        // EMAIL CHECK
        // ----------------------------------------------------

        const existingEmail =
            await authRepository.findUserByEmailForRegistration(
                data.email,
                client
            );

        if (existingEmail) {

            throw createError(
                "Email already registered",
                409
            );
        }


        // ----------------------------------------------------
        // USERNAME CHECK
        // ----------------------------------------------------

        const existingUsername =
            await authRepository.findUserByUsernameForRegistration(
                data.username,
                client
            );

        if (existingUsername) {

            throw createError(
                "Username already registered",
                409
            );
        }


        // ----------------------------------------------------
        // HASH PASSWORD
        // ----------------------------------------------------

        const passwordHash =
            await hashPassword(
                data.password
            );


        // ----------------------------------------------------
        // CREATE USER
        // ----------------------------------------------------

        const user =
            await authRepository.createUser(
                client,
                {
                    username: data.username,
                    email: data.email,
                    passwordHash,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phoneNumber: data.phoneNumber,

                    // IMPORTANT
                    isActive: false,

                    // IMPORTANT
                    approvalStatus: "PENDING",

                    createdBy
                }
            );


        // ----------------------------------------------------
        // INSTRUCTOR ROLE
        // ----------------------------------------------------

        const role =
            await authRepository.findRoleByCode(
                "INSTRUCTOR",
                client
            );

        if (!role) {

            throw createError(
                "INSTRUCTOR role not found",
                500
            );
        }


        await authRepository.assignRole(
            client,
            user.id,
            role.id,
            createdBy
        );


        // ----------------------------------------------------
        // CREATE INSTRUCTOR
        // ----------------------------------------------------

        const instructor =
            await instructorRepository.createInstructor(
                client,
                {
                    userId: user.id,

                    instructorCode:
                        `INS-${user.id}`,

                    specialization:
                        data.specialization,

                    qualification:
                        data.qualification,

                    experienceYears:
                        data.experienceYears,

                    designation:
                        data.designation,

                    bio:
                        data.bio,

                    createdBy
                }
            );


        await client.query("COMMIT");


        return {
            user,
            instructor
        };

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}

// ============================================================
// LOGIN
// ============================================================

async function login(
    identifier,
    password,
    ipAddress,
    userAgent
) {

    if (
        !identifier ||
        !password
    ) {

        throw createError(
            "Identifier and password are required",
            400
        );
    }


    const normalizedIdentifier =
        identifier.trim();


    // --------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------

    const user =
        await authRepository
            .findUserByUsernameOrEmail(
                normalizedIdentifier
            );


    if (!user) {

        throw createError(
            "Invalid username/email or password",
            401
        );
    }


    // --------------------------------------------------------
    // CHECK LOCK
    // --------------------------------------------------------

    if (
        user.is_locked &&
        user.locked_until &&
        new Date(user.locked_until) > new Date()
    ) {

        throw createError(
            "Account is temporarily locked",
            403
        );
    }


    // --------------------------------------------------------
    // CHECK PASSWORD
    // --------------------------------------------------------

    const passwordValid =
        await comparePassword(
            password,
            user.password_hash
        );


    if (!passwordValid) {

        await authRepository.updateLoginFailure(
            user.id
        );

        throw createError(
            "Invalid username/email or password",
            401
        );
    }


    // --------------------------------------------------------
    // APPROVAL
    // --------------------------------------------------------

    if (
        user.approval_status === "PENDING"
    ) {

        throw createError(
            "Account is waiting for admin approval",
            403
        );
    }


    if (
        user.approval_status === "REJECTED"
    ) {

        throw createError(
            "Account registration was rejected",
            403
        );
    }


    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    if (!user.is_active) {

        throw createError(
            "Account is disabled",
            403
        );
    }


    // --------------------------------------------------------
    // ROLES / PERMISSIONS
    // --------------------------------------------------------

    const {
        roleCodes,
        permissionCodes
    } =
        await getAuthorizationData(
            user.id
        );


    // --------------------------------------------------------
    // LOGIN AUDIT
    // --------------------------------------------------------

    await authRepository.updateLoginSuccess(
        user.id,
        ipAddress
    );


    // --------------------------------------------------------
    // ACCESS TOKEN
    // --------------------------------------------------------
    //
    // IMPORTANT:
    // token.service expects userId.
    //

    const accessToken =
        generateAccessToken({

            userId:
                user.id,

            email:
                user.email,

            username:
                user.username,

            sessionVersion:
                user.session_version,

            roles:
                roleCodes,

            permissions:
                permissionCodes
        });


    // --------------------------------------------------------
    // REFRESH TOKEN
    // --------------------------------------------------------

    const refreshToken =
        generateRefreshToken();

    const refreshTokenHash =
        hashRefreshToken(
            refreshToken
        );

    const refreshTokenExpiry =
        getRefreshTokenExpiry();


    // --------------------------------------------------------
    // CREATE REFRESH TOKEN
    // --------------------------------------------------------
    //
    // Login has successfully authenticated the user.
    //
    // Therefore:
    // created_by = user.id
    //

    await authRepository.createRefreshToken({

        userId:
            user.id,

        tokenHash:
            refreshTokenHash,

        expiresAt:
            refreshTokenExpiry,

        sessionVersion:
            user.session_version,

        ipAddress,

        userAgent,

        createdBy:
            user.id
    });


    return {

        accessToken,

        refreshToken,

        tokenType:
            "Bearer",

        expiresIn:
            getAccessTokenExpiryInSeconds(),

        refreshTokenExpiresAt:
            refreshTokenExpiry,

        user: {

            id:
                user.id,

            email:
                user.email,

            username:
                user.username,

            firstName:
                user.first_name,

            lastName:
                user.last_name
        },

        roles:
            roleCodes,

        permissions:
            permissionCodes
    };
}


// ============================================================
// REFRESH ACCESS TOKEN
// ============================================================

async function refreshAccessToken(
    refreshToken,
    ipAddress,
    userAgent
) {

    if (!refreshToken) {

        throw createError(
            "Refresh token is required",
            400
        );
    }


    const tokenHash =
        hashRefreshToken(
            refreshToken
        );


    // --------------------------------------------------------
    // FIND TOKEN
    // --------------------------------------------------------

    const storedToken =
        await authRepository
            .findRefreshTokenByHash(
                tokenHash
            );


    if (!storedToken) {

        throw createError(
            "Invalid refresh token",
            401
        );
    }

    if (Number(storedToken.token_session_version) !== Number(storedToken.current_session_version)) {
        throw createError("This session has ended. Please sign in again.", 401);
    }


    // --------------------------------------------------------
    // REVOKED
    // --------------------------------------------------------

    if (
        storedToken.revoked_at
    ) {

        throw createError(
            "Refresh token has been revoked",
            401
        );
    }


    // --------------------------------------------------------
    // EXPIRY
    // --------------------------------------------------------

    if (
        new Date(storedToken.expires_at)
        <= new Date()
    ) {

        throw createError(
            "Refresh token has expired",
            401
        );
    }


    // --------------------------------------------------------
    // USER DELETED
    // --------------------------------------------------------

    if (
        storedToken.user_soft_delete
    ) {

        throw createError(
            "User account no longer exists",
            401
        );
    }


    // --------------------------------------------------------
    // APPROVAL
    // --------------------------------------------------------

    if (
        storedToken.approval_status === "PENDING"
    ) {

        throw createError(
            "Account is waiting for admin approval",
            403
        );
    }


    if (
        storedToken.approval_status === "REJECTED"
    ) {

        throw createError(
            "Account registration was rejected",
            403
        );
    }


    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    if (!storedToken.is_active) {

        throw createError(
            "Account is disabled",
            403
        );
    }


    // --------------------------------------------------------
    // LOCK
    // --------------------------------------------------------

    if (
        storedToken.is_locked &&
        storedToken.locked_until &&
        new Date(storedToken.locked_until) > new Date()
    ) {

        throw createError(
            "Account is temporarily locked",
            403
        );
    }


    // --------------------------------------------------------
    // AUTHORIZATION
    // --------------------------------------------------------

    const {
        roleCodes,
        permissionCodes
    } =
        await getAuthorizationData(
            storedToken.user_id
        );


    // --------------------------------------------------------
    // GENERATE ACCESS TOKEN
    // --------------------------------------------------------

    const accessToken =
        generateAccessToken({

            userId:
                storedToken.user_id,

            sessionVersion:
                storedToken.token_session_version,

            roles:
                roleCodes,

            permissions:
                permissionCodes
        });


    // --------------------------------------------------------
    // NEW REFRESH TOKEN
    // --------------------------------------------------------

    const newRefreshToken =
        generateRefreshToken();

    const newRefreshTokenHash =
        hashRefreshToken(
            newRefreshToken
        );

    const newRefreshTokenExpiry =
        getRefreshTokenExpiry();


    // --------------------------------------------------------
    // CREATE REPLACEMENT TOKEN
    // --------------------------------------------------------
    //
    // The token belongs to the authenticated account.
    //
    // created_by = user ID
    //

    const newStoredToken =
        await authRepository.createRefreshToken({

            userId:
                storedToken.user_id,

            tokenHash:
                newRefreshTokenHash,

            expiresAt:
                newRefreshTokenExpiry,

            sessionVersion:
                storedToken.token_session_version,

            ipAddress:
                ipAddress ||
                storedToken.ip_address,

            userAgent:
                userAgent ||
                storedToken.user_agent,

            createdBy:
                storedToken.user_id
        });


    // --------------------------------------------------------
    // REVOKE OLD TOKEN
    // --------------------------------------------------------

    await authRepository.revokeRefreshToken(
        tokenHash,
        storedToken.user_id,
        newStoredToken.id
    );


    // --------------------------------------------------------
    // UPDATE LAST USED
    // --------------------------------------------------------

    await authRepository.updateRefreshTokenLastUsed(
        tokenHash
    );


    return {

        accessToken,

        refreshToken:
            newRefreshToken,

        tokenType:
            "Bearer",

        expiresIn:
            getAccessTokenExpiryInSeconds(),

        refreshTokenExpiresAt:
            newRefreshTokenExpiry,

        roles:
            roleCodes,

        permissions:
            permissionCodes
    };
}


// ============================================================
// LOGOUT
// ============================================================
//
// Logout can happen with or without an authenticated user.
//
// If userId is available:
//     updated_by = userId
//
// Otherwise:
//     updated_by = NULL
// ============================================================

async function logout(
    refreshToken,
    userId = null
) {

    if (!refreshToken) {
        return;
    }


    const tokenHash =
        hashRefreshToken(
            refreshToken
        );


    await authRepository.revokeRefreshToken(
        tokenHash,
        userId
    );
}

async function changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
        throw createError("Current password and new password are required.", 400);
    }
    if (newPassword.length < 8) {
        throw createError("New password must be at least 8 characters.", 400);
    }
    if (Buffer.byteLength(newPassword, "utf8") > 72) {
        throw createError("New password must be no more than 72 bytes.", 400);
    }
    if (currentPassword === newPassword) {
        throw createError("Choose a new password that differs from the current one.", 400);
    }

    const user = await authRepository.findUserById(userId);
    if (!user || !(await comparePassword(currentPassword, user.password_hash))) {
        throw createError("Current password is incorrect.", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    const changed = await authRepository.invalidateAllSessions(userId, passwordHash);
    if (!changed) throw createError("Account not found.", 404);

    return { message: "Password changed. Sign in again with your new password." };
}

async function logoutAll(userId) {
    const invalidated = await authRepository.invalidateAllSessions(userId);
    if (!invalidated) throw createError("Account not found.", 404);
    return { message: "You have been signed out on all devices." };
}


// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser(
    userId
) {

    const user =
        await authRepository.findUserById(
            userId
        );


    if (!user) {

        throw createError(
            "User not found",
            404
        );
    }


    if (
        user.approval_status === "PENDING"
    ) {

        throw createError(
            "Account is waiting for admin approval",
            403
        );
    }


    if (
        user.approval_status === "REJECTED"
    ) {

        throw createError(
            "Account registration was rejected",
            403
        );
    }


    if (!user.is_active) {

        throw createError(
            "Account is disabled",
            403
        );
    }


    const {
        roleCodes,
        permissionCodes
    } =
        await getAuthorizationData(
            userId
        );


    return {

        id:
            user.id,

        email:
            user.email,

        username:
            user.username,

        firstName:
            user.first_name,

        lastName:
            user.last_name,

        roles:
            roleCodes,

        permissions:
            permissionCodes,

        createdAt:
            user.created_at,

        createdBy:
            user.created_by,

        updatedAt:
            user.updated_at,

        updatedBy:
            user.updated_by
    };
}


// Allow a signed-in user to update their own name and username.
async function updateCurrentUserProfile(userId, input, req) {
    const id = String(userId ?? "").trim();

    if (!/^[1-9]\d*$/.test(id)) {
        throw createError("Invalid user ID", 400);
    }

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("A valid profile object is required", 400);
    }

    const allowedFields = new Set(["username", "firstName", "lastName"]);
    const suppliedFields = Object.keys(input);

    if (suppliedFields.length === 0) {
        throw createError("Provide at least one profile field to update", 400);
    }

    const unknownField = suppliedFields.find((field) => !allowedFields.has(field));
    if (unknownField) {
        throw createError(`Field '${unknownField}' cannot be updated`, 400);
    }

    const currentUser = await authRepository.findUserById(id);
    if (!currentUser) {
        throw createError("User not found", 404);
    }

    let username = currentUser.username;
    let firstName = currentUser.first_name;
    let lastName = currentUser.last_name;

    if (Object.hasOwn(input, "username")) {
        if (typeof input.username !== "string") {
            throw createError("Username must be a string", 400);
        }

        username = input.username.trim();

        if (
            username.length < 3 ||
            username.length > 30 ||
            !/^[a-zA-Z0-9_.-]+$/.test(username)
        ) {
            throw createError(
                "Username must be 3–30 characters and use only letters, numbers, dots, underscores, or hyphens",
                400
            );
        }
    }

    if (Object.hasOwn(input, "firstName")) {
        if (typeof input.firstName !== "string") {
            throw createError("First name must be a string", 400);
        }

        firstName = input.firstName.trim();

        if (!firstName || firstName.length > 100) {
            throw createError(
                "First name is required and must not exceed 100 characters",
                400
            );
        }
    }

    if (Object.hasOwn(input, "lastName")) {
        if (input.lastName !== null && typeof input.lastName !== "string") {
            throw createError("Last name must be a string or null", 400);
        }

        lastName = typeof input.lastName === "string"
            ? input.lastName.trim() || null
            : null;

        if (lastName && lastName.length > 100) {
            throw createError("Last name must not exceed 100 characters", 400);
        }
    }

    if (username.toLowerCase() !== String(currentUser.username).toLowerCase()) {
        const usernameOwner = await authRepository.findUserByUsernameForRegistration(
            username,
            pool
        );

        if (usernameOwner && String(usernameOwner.id) !== id) {
            throw createError("Username already registered", 409);
        }
    }

    const { updatedBy } = getUpdateAudit(req);

    try {
        const updated = await authRepository.updateCurrentUserProfile(id, {
            username,
            firstName,
            lastName,
            updatedBy
        });

        if (!updated) {
            throw createError("User not found", 404);
        }
    } catch (error) {
        // The database unique index remains the final guard against races.
        if (error.code === "23505") {
            throw createError("Username already registered", 409);
        }

        throw error;
    }

    return getCurrentUser(id);
}


// ============================================================
// UPDATE STUDENT
// ============================================================
//
// Example authenticated operation.
//
// Controller should call:
//
// authService.updateStudent(req.params.id, req.body, req)
// ============================================================

async function updateStudent(
    studentId,
    input,
    req
) {

    const {
        updatedBy
    } =
        getUpdateAudit(
            req
        );

    return studentRepository.updateStudent(
        pool,
        studentId,
        {
            ...input,
            updatedBy
        }
    );
}


// ============================================================
// DELETE STUDENT
// ============================================================

async function deleteStudent(
    studentId,
    req
) {

    const {
        updatedBy
    } =
        getDeleteAudit(
            req
        );

    return studentRepository.softDeleteStudent(
        pool,
        studentId,
        updatedBy
    );
}


// ============================================================
// UPDATE INSTRUCTOR
// ============================================================

async function updateInstructor(
    instructorId,
    input,
    req
) {

    const {
        updatedBy
    } =
        getUpdateAudit(
            req
        );

    return instructorRepository.updateInstructor(
        pool,
        instructorId,
        {
            ...input,
            updatedBy
        }
    );
}


// ============================================================
// DELETE INSTRUCTOR
// ============================================================

async function deleteInstructor(
    instructorId,
    req
) {

    const {
        updatedBy
    } =
        getDeleteAudit(
            req
        );

    return instructorRepository.softDeleteInstructor(
        pool,
        instructorId,
        updatedBy
    );
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    registerStudent,

    registerInstructor,

    login,

    refreshAccessToken,

    logout,

    changePassword,

    logoutAll,

    getCurrentUser,

    updateCurrentUserProfile,

    updateStudent,

    deleteStudent,

    updateInstructor,

    deleteInstructor
};
