export const EVENT_TYPES = [
  'payment.created',
  'payment.completed',
  'payment.failed',
  'user.created',
  'user.updated',
  'subscription.updated',
  'subscription.cancelled',
  'invoice.paid',
  'refund.created',
];

export const EVENT_STATUSES = ['delivered', 'processing', 'pending', 'failed', 'skipped'];
export const DELIVERY_STATUSES = ['delivered', 'retrying', 'failed', 'skipped'];
export const HTTP_CODES = [200, 201, 204, 400, 401, 404, 429, 500, 502, 503];

export const RANGES = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export const PAGE_SIZE_EVENTS = 10;
export const PAGE_SIZE_DELIVERIES = 12;

export const STATUS_LABEL = {
  delivered: 'Delivered',
  failed: 'Failed',
  pending: 'Pending',
  processing: 'Processing',
  retrying: 'Retrying',
  active: 'Active',
  inactive: 'Inactive',
  revoked: 'Revoked',
  healthy: 'Healthy',
  degraded: 'Degraded',
};