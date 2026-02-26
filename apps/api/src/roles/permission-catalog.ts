export const PERMISSION_CATALOG = [
  'branches.manage',
  'users.manage',
  'roles.manage',
  'members.manage',
  'members.view',
  'services.manage',
  'services.view',
  'attendance.manage',
  'attendance.view',
  'giving.manage',
  'giving.view',
  'events.manage',
  'events.view',
  'groups.manage',
  'groups.view',
  'website.manage',
  'reports.view',
] as const;

export const SYSTEM_ROLE_TEMPLATES: Array<{
  name: 'Owner' | 'Admin' | 'Staff' | 'Viewer';
  permissions: string[];
}> = [
  {
    name: 'Owner',
    permissions: [
      'branches.manage',
      'users.manage',
      'roles.manage',
      'members.manage',
      'services.manage',
      'attendance.manage',
      'giving.manage',
      'events.manage',
      'groups.manage',
      'website.manage',
      'reports.view',
    ],
  },
  {
    name: 'Admin',
    permissions: [
      'branches.manage',
      'users.manage',
      'members.manage',
      'services.manage',
      'attendance.manage',
      'giving.manage',
      'events.manage',
      'groups.manage',
      'website.manage',
      'reports.view',
    ],
  },
  {
    name: 'Staff',
    permissions: [
      'members.manage',
      'services.manage',
      'attendance.manage',
      'giving.manage',
      'events.manage',
      'groups.manage',
      'website.manage',
      'reports.view',
    ],
  },
  {
    name: 'Viewer',
    permissions: ['members.view', 'services.view', 'attendance.view', 'giving.view', 'events.view', 'groups.view', 'reports.view'],
  },
];
