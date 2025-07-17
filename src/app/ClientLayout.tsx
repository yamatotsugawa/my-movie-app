'use client';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="text-center py-6 bg-white shadow">
        {/* タイトルはpage.tsx側に任せてここでは表示しない */}
      </header>
      <main className="flex flex-col-reverse md:flex-row gap-6 p-4 max-w-7xl mx-auto w-full">
        {children}
      </main>
      <footer className="text-center py-4 text-sm text-gray-500">
        © 2025 y-movie-app
      </footer>
    </div>
  );
}
