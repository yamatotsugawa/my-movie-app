'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import Script from 'next/script';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* ✅ Google Analytics */}
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-4RE39HMZPK"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4RE39HMZPK');
          `,
        }}
      />
      {children}
      <VercelAnalytics />
    </>
  );
}
