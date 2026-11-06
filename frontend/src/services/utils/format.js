import { format, formatDistanceToNowStrict } from 'date-fns';

export const formatDateTime = (value) => {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy · HH:mm:ss');
};

export const formatShortDateTime = (value) => {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, HH:mm');
};

export const formatDate = (value) => {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy');
};

export const formatTime = (value) => {
  if (!value) return '—';
  return format(new Date(value), 'HH:mm:ss');
};

export const relativeTime = (value) => {
  if (!value) return '—';
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
};

export const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);

export const formatPercent = (value, digits = 1) => `${(value ?? 0).toFixed(digits)}%`;

export const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export const truncateMiddle = (value, keep = 6) => {
  if (!value || value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
};