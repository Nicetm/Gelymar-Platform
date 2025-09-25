import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gelymar Management Platform',
  description: 'Sistema de gestión de documentos y logística para operaciones de exportación',
  authors: [{ name: 'Sebastián Allende - Pablo Santibañez | Softkey' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/gelymar.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
