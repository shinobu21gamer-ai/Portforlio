import useAuthStore from '../store/authStore';

export function useIsAdmin() {
  const user = useAuthStore(s => s.user);
  return user?.role?.slug === 'admin';
}

export function useIsHR() {
  const user = useAuthStore(s => s.user);
  return user?.role?.slug === 'hr';
}

export function useIsAdminOrHR() {
  const user = useAuthStore(s => s.user);
  const slug = user?.role?.slug;
  return slug === 'admin' || slug === 'hr';
}
