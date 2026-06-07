'use client';

import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function GoogleLoginButton({ width }: { width?: string }) {
  const { login } = useAuth();

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('Google login failed');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Auth failed' }));
        throw new Error(err.error);
      }

      const data = await res.json();
      login(data.token, data.user, data.isNew);
      toast.success(data.isNew ? 'Welcome! Set your username' : `Welcome back, ${data.user.username}!`);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  };

  const handleError = () => {
    toast.error('Google login failed');
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      useOneTap
      theme="filled_black"
      shape="pill"
      size="medium"
      text="signin_with"
      width={width}
    />
  );
}
