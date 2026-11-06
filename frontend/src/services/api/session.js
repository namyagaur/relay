import { request } from './client';

export function getCurrentProject() {
  return request('/auth/session').then((session) => session.project);
}
