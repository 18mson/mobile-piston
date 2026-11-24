import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const pixel = localFont({
  src: [
    { path: './fonts/Silkscreen-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Silkscreen-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-pixel',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Mobile Piston',
  description:
    'Balap mobil mini 3D bergaya pixel art di dua rute Teluk Sore. Keyboard, sentuh, atau gamepad.',
  applicationName: 'Mobile Piston',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c1820',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}
