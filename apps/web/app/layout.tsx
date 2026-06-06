import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth-context';
import { GoogleOAuthProvider } from '@react-oauth/google';
import UsernameModal from '@/components/UsernameModal';

export const metadata: Metadata = {
  title: 'Bollywood Connect - Connect the Stars',
  description: 'A daily and endless Bollywood trivia web game where players connect two Indian film stars through shared movies.',
  icons: {
    icon: [
      { url: '/brand/03_app_icons/golden_star_connected_nodes_favicon.ico' },
      { url: '/brand/03_app_icons/golden_star_connected_nodes_icon_32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/03_app_icons/golden_star_connected_nodes_icon_192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/brand/03_app_icons/golden_star_connected_nodes_icon_180x180.png',
  },
  openGraph: {
    title: 'Bollywood Connect',
    description: 'Connect the stars through Indian cinema.',
    images: ['/brand/04_web_navbar_footer/primary_holographic_star_reel_web_1280px.png'],
  },
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap"
          rel="stylesheet"
        />
      </head>
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
