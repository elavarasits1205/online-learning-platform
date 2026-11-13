
const adminRepository = require("../repositories/admin.repository");

// Get users with role information, filters and pagination.
async function getUsers(filters) {
    return adminRepository.findAllUsers(filters);
}

// Get one user with assigned roles.
async function getUserById(id) {
    return adminRepository.findAdminUserById(id);
}

// Update user profile information.
async function updateUser(id, userData) {
    return adminRepository.updateAdminUser(id, userData);
}

// Soft-delete a user.
async function deleteUser(id, updatedBy) {
    return adminRepository.softDeleteAdminUser(id, updatedBy);
}

// Get instructors awaiting approval.
async function getPendingUsers() {
    return adminRepository.findPendingUsers();
}

// Approve a pending instructor.
async function approveUser(id, updatedBy) {
    return adminRepository.approveUser(id, updatedBy);
}

// Reject a pending instructor.
async function rejectUser(id, updatedBy, reason) {
    return adminRepository.rejectUser(id, updatedBy, reason);
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
