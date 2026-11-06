import {
  BookOpen,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  Radio,
  Send,
  Settings,
  Webhook,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { label: 'Overview', to: '/', icon: LayoutDashboard },
      { label: 'Events', to: '/events', icon: Radio },
      { label: 'Deliveries', to: '/deliveries', icon: Send },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Projects', to: '/projects', icon: FolderGit2 },
      { label: 'Endpoints', to: '/endpoints', icon: Webhook },
      { label: 'API Keys', to: '/api-keys', icon: KeyRound },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Documentation', to: '/docs', icon: BookOpen },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((group) => group.items);

const DETAIL_PARENTS = [
  { prefix: '/events/', root: '/events', label: 'Events', detail: 'Event' },
  { prefix: '/deliveries/', root: '/deliveries', label: 'Deliveries', detail: 'Delivery' },
  { prefix: '/endpoints/', root: '/endpoints', label: 'Endpoints', detail: 'Endpoint' },
  { prefix: '/projects/', root: '/projects', label: 'Projects', detail: 'Project' },
];

export function getBreadcrumbs(pathname) {
  if (pathname === '/') return [{ label: 'Overview' }];

  const detail = DETAIL_PARENTS.find((entry) => pathname.startsWith(entry.prefix));
  if (detail) {
    return [
      { label: detail.label, to: detail.root },
      { label: `${detail.detail} details` },
    ];
  }

  const match = ALL_NAV.find((item) => item.to === pathname);
  return [{ label: match ? match.label : 'Relay' }];
}