import { useState, useEffect } from 'react';
import PosLayout from '../layouts/PosLayout';
import useAuthStore from '../store/authStore';
import api from '../api/client';
import { useToast } from '../components/Toast';

const PASSWORD_EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function Profile() {
  const authUser = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const toast = useToast();

  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [pwForm, setPwForm] = useState(PASSWORD_EMPTY);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/profile');
        const u = res.data?.data?.user || res.data?.data || res.data?.user;
        if (u) {
          setProfileForm({
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            email: u.email || '',
            phone: u.phone || '',
          });
        }
      } catch {
        if (authUser) {
          setProfileForm({
            firstName: authUser.firstName || '',
            lastName: authUser.lastName || '',
            email: authUser.email || '',
            phone: authUser.phone || '',
          });
        }
      }
      setLoadingProfile(false);
    })();
  }, [authUser]);

  const updateP = (k, v) => setProfileForm(p => ({ ...p, [k]: v }));
  const updateW = (k, v) => setPwForm(p => ({ ...p, [k]: v }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/profile', profileForm);
      const updated = res.data?.data?.user || res.data?.data || profileForm;
      updateUser({ ...authUser, ...updated });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    setSavingProfile(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwForm.newPassword)) {
      toast.error('Password must include uppercase, lowercase, and a number');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed successfully');
      setPwForm(PASSWORD_EMPTY);
    } catch (err) { toast.error(err.response?.data?.message || 'Password change failed'); }
    setSavingPw(false);
  };

  const roleName = typeof authUser?.role === 'object' ? authUser?.role?.name : authUser?.role;
  const roleSlug = typeof authUser?.role === 'object' ? authUser?.role?.slug : authUser?.role;

  return (
    <PosLayout active="profile">
      <header className="pos-header">
        <div><h1>My Profile</h1><div className="sub">Manage your account settings</div></div>
      </header>

      <div className="flex gap-md flex-wrap items-start">
        <div className="flex-col flex-center flex-gap-sm" style={{ minWidth: 160 }}>
          <div className="flex-center font-bold" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', fontSize: 32, color: 'var(--primary-fg)' }}>
            {authUser?.firstName?.[0]}{authUser?.lastName?.[0]}
          </div>
          <div className="text-center">
            <div className="font-semibold">{authUser?.firstName} {authUser?.lastName}</div>
            <div className="text-sm text-muted">{authUser?.email}</div>
            <span className="badge mt-xs" style={{ background: roleSlug === 'admin' ? 'var(--primary)' : roleSlug === 'manager' ? 'var(--success)' : 'var(--muted)', color: roleSlug === 'admin' ? 'var(--primary-fg)' : 'var(--fg-primary)' }}>{roleName}</span>
          </div>
        </div>

        <div className="flex-1" style={{ minWidth: 300 }}>
          <h2 className="mb-md">Edit Profile</h2>
            {loadingProfile ? <p className="text-muted">Loading...</p> : (
            <form onSubmit={handleProfileSave}>
              <div className="two-col">
                <div className="field"><label>First Name</label><input className="input-block" value={profileForm.firstName} onChange={e => updateP('firstName', e.target.value)} required /></div>
                <div className="field"><label>Last Name</label><input className="input-block" value={profileForm.lastName} onChange={e => updateP('lastName', e.target.value)} required /></div>
              </div>
              <div className="two-col">
                <div className="field"><label>Email</label><input className="input-block" type="email" value={profileForm.email} onChange={e => updateP('email', e.target.value)} required /></div>
                <div className="field"><label>Phone</label><input className="input-block" value={profileForm.phone} onChange={e => updateP('phone', e.target.value)} /></div>
              </div>
              <div className="flex-end mt-md">
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>{savingProfile && <span className="btn-spinner" />}{savingProfile ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="dashboard-section mt-md">
        <h2 className="mb-md">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="max-w-md">
          <div className="field"><label>Current Password</label><input className="input-block" type="password" value={pwForm.currentPassword} onChange={e => updateW('currentPassword', e.target.value)} required /></div>
          <div className="field"><label>New Password</label><input className="input-block" type="password" value={pwForm.newPassword} onChange={e => updateW('newPassword', e.target.value)} required minLength={8} placeholder="Min 8 chars, upper + lower + number" /></div>
          <div className="field"><label>Confirm New Password</label><input className="input-block" type="password" value={pwForm.confirmPassword} onChange={e => updateW('confirmPassword', e.target.value)} required minLength={8} /></div>
          <div className="flex-end mt-md">
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingPw}>{savingPw && <span className="btn-spinner" />}{savingPw ? 'Changing...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </PosLayout>
  );
}
