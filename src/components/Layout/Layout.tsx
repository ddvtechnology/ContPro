import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

// Loading component otimizado
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export default function Layout() {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 w-full max-w-full">
      <div className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0">
        <Sidebar />
      </div>
      
      <div className="md:pl-56 flex flex-col flex-1 overflow-hidden w-full">
        <Header />
        
        <main className="flex-1 relative overflow-y-auto overflow-x-hidden focus:outline-none w-full">
          <div className="py-4 px-4 sm:py-6 sm:px-6 w-full box-border">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}