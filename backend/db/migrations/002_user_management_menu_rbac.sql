BEGIN;

-- Rename the section and its child menu while preserving their stable codes.
UPDATE olp_auth.menu
SET
    name = 'User Management',
    updated_at = NOW()
WHERE code = 'SYSTEM_SETTINGS'
  AND soft_delete = FALSE;

-- The Users menu must use the USER resource's base permission so VIEW,
-- CREATE, UPDATE, or DELETE grants all resolve to this menu.
UPDATE olp_auth.menu AS m
SET
    name = 'Users',
    permission_id = p.id,
    updated_at = NOW()
FROM olp_auth.permission AS p
WHERE m.code = 'USER_MANAGEMENT'
  AND m.soft_delete = FALSE
  AND p.code = 'USER_VIEW'
  AND p.module_code = 'USER_MANAGEMENT'
  AND p.resource_code = 'USER'
  AND p.is_active = TRUE
  AND p.soft_delete = FALSE;

COMMIT;
