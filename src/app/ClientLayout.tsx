// src/app/ClientLayout.tsx
'use client';

import React from 'react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="flex flex-col md:flex-row gap-6 p-4 max-w-7xl mx-auto">
        {children}
      </main>
      <footer className="text-center text-gray-500 text-sm py-4 mt-8">
        &copy; {new Date().getFullYear()} y-movie-app
      </footer>
    </div>
  );
}
