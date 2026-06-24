export type Permission = {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [
    { module: 'dashboard', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'crm', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'projects', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'helpdesk', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'employees', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'inventory', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'isp', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'finance', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'procurement', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'contracts', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'documents', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'events', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'reports', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'settings', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { module: 'users', canView: true, canCreate: true, canEdit: true, canDelete: true },
  ],
  ceo: [
    { module: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'crm', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'projects', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'helpdesk', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'employees', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'inventory', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'isp', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'finance', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'contracts', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'documents', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'events', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'reports', canView: true, canCreate: true, canEdit: false, canDelete: false },
    { module: 'settings', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'users', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ],
  managing_director: [
    { module: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'crm', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'projects', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'helpdesk', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'employees', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'attendance', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'inventory', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'isp', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'finance', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'contracts', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'documents', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'events', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'reports', canView: true, canCreate: true, canEdit: false, canDelete: false },
    { module: 'settings', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ],
  accountant: [
    { module: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'finance', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'inventory', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'contracts', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'documents', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'reports', canView: true, canCreate: true, canEdit: false, canDelete: false },
    { module: 'settings', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ],
  engineer: [
    { module: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'projects', canView: true, canCreate: false, canEdit: true, canDelete: false },
    { module: 'helpdesk', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'inventory', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'documents', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'settings', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ],
  marketing_officer: [
    { module: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'crm', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'contracts', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'documents', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'events', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { module: 'settings', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ],
  customer: [
    { module: 'projects', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'helpdesk', canView: true, canCreate: true, canEdit: false, canDelete: false },
    { module: 'finance', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'documents', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: 'settings', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ],
};

export function hasPermission(
  role: string,
  module: string,
  action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete'
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  const perm = permissions.find(p => p.module === module);
  if (!perm) return false;
  return perm[action];
}
