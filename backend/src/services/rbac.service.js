const repository = require("../repositories/rbac.repository");

function validateId(id, field = "id") {
  if (!/^[1-9]\d*$/.test(String(id))) {
    const error = new Error(`Invalid ${field}`);
    error.status = 400;
    throw error;
  }
  return String(id);
}

async function listRoles() {
  return repository.getRoles();
}

async function getRole(id) {
  const role = await repository.getRoleById(validateId(id, "role ID"));

  if (!role) {
    const error = new Error("Role not found");
    error.status = 404;
    throw error;
  }

  return role;
}

async function addRole(body) {
  const { code, name, description = null } = body;

  if (
    typeof code !== "string" ||
    typeof name !== "string" ||
    !code.trim() ||
    !name.trim()
  ) {
    const error = new Error("code and name are required");
    error.status = 400;
    throw error;
  }

  return repository.createRole({
    code: code.trim().toUpperCase(),
    name: name.trim(),
    description
  });
}

async function editRole(id, body) {
  const roleId = validateId(id, "role ID");
  const { name, description = null, is_active } = body;

  if (typeof name !== "string" || !name.trim()) {
    const error = new Error("A valid role name is required");
    error.status = 400;
    throw error;
  }

  if (typeof is_active !== "boolean") {
    const error = new Error("is_active must be true or false");
    error.status = 400;
    throw error;
  }

  const role = await repository.updateRole(roleId, {
    name: name.trim(),
    description,
    is_active
  });

  if (!role) {
    const error = new Error("Role not found");
    error.status = 404;
    throw error;
  }

  return role;
}

async function removeRole(id) {
  const deleted = await repository.deleteRole(validateId(id, "role ID"));

  if (!deleted) {
    const error = new Error("Role not found");
    error.status = 404;
    throw error;
  }

  return { message: "Role soft-deleted successfully" };
}

async function listPermissions() {
  return repository.getPermissions();
}

async function listRolePermissions(id) {
  const roleId = validateId(id, "role ID");
  await getRole(roleId);
  return repository.getRolePermissions(roleId);
}

async function setRolePermissions(id, permissionIds) {
  const roleId = validateId(id, "role ID");

  if (
    !Array.isArray(permissionIds) ||
    permissionIds.some(
      value => !/^[1-9]\d*$/.test(String(value))
    )
  ) {
    const error = new Error(
      "permissionIds must be an array of positive integer IDs"
    );
    error.status = 400;
    throw error;
  }

  return repository.replaceRolePermissions(
    roleId,
    permissionIds.map(String)
  );
}

async function getMyAccess(userId) {
  const [roles, permissions, menus] = await Promise.all([
    repository.getUserRoles(userId),
    repository.getUserPermissions(userId),
    repository.getUserMenus(userId)
  ]);

  return {
    roles,
    permissions: permissions.map(permission => permission.code),
    menus
  };
}

module.exports = {
  listRoles,
  getRole,
  addRole,
  editRole,
  removeRole,
  listPermissions,
  listRolePermissions,
  setRolePermissions,
  getMyAccess
};