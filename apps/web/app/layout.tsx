import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth-context';
import { GoogleOAuthProvider } from '@react-oauth/google';
import UsernameModal from '@/components/UsernameModal';

export const metadata: Metadata = {
  title: 'Bollywood Connect - Connect the Stars',
  description: 'A daily and endless Bollywood trivia web game where players connect two Indian film stars through shared movies.',
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <Navbar />
            <main>{children}</main>
            <UsernameModal />
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
