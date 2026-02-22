import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Purchases from './pages/Purchases';
import InTransit from './pages/InTransit';
import Accounting from './pages/Accounting';
import SecurityDeposits from './pages/SecurityDeposits';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Reports from './pages/Reports';
import { AppProvider, useAppContext } from './AppContext';
import type { Permission } from './types';
import { MenuIcon } from './components/icons';

const Header: React.FC<{ onMenuClick: () => void, activeViewLabel: string }> = ({ onMenuClick, activeViewLabel }) => (
    <div className="md:hidden flex items-center justify-between p-2 bg-white/60 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-30 h-[50px]">
        <h1 className="text-lg font-bold text-slate-800 capitalize">{activeViewLabel}</h1>
        <button onClick={onMenuClick} className="p-1">
            <MenuIcon className="w-6 h-6" />
        </button>
    </div>
);


const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const { storeSettings, currentUser, hasPermission } = useAppContext();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  if (!currentUser) {
      return null; // Should not happen if App component logic is correct
  }
  
  const accessiblePages = {
      dashboard: hasPermission('page:dashboard'),
      inventory: hasPermission('page:inventory'),
      pos: hasPermission('page:pos'),
      purchases: hasPermission('page:purchases'),
      in_transit: hasPermission('page:in_transit'),
      accounting: hasPermission('page:accounting'),
      deposits: hasPermission('page:deposits'),
      reports: hasPermission('page:reports'),
      settings: hasPermission('page:settings'),
  };
  
    const navLabels: { [key: string]: string } = {
      dashboard: 'داشبورد',
      inventory: 'انبارداری',
      pos: 'فروش',
      purchases: 'خرید',
      in_transit: 'اجناس در راه',
      accounting: 'حسابداری',
      deposits: 'امانات',
      reports: 'گزارشات',
      settings: 'تنظیمات',
  };

  // If the current active view is not accessible, switch to the first accessible one
  if (!accessiblePages[activeView as keyof typeof accessiblePages]) {
      const firstAccessible = Object.keys(accessiblePages).find(page => accessiblePages[page as keyof typeof accessiblePages]);
      if (firstAccessible) {
          setActiveView(firstAccessible);
      } else {
        // Handle case where user has no accessible pages
        return <div className="flex-1 flex items-center justify-center"><p>شما به هیچ صفحه‌ای دسترسی ندارید.</p></div>
      }
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard': return accessiblePages.dashboard && <Dashboard />;
      case 'inventory': return accessiblePages.inventory && <Inventory />;
      case 'pos': return accessiblePages.pos && <POS />;
      case 'purchases': return accessiblePages.purchases && <Purchases />;
      case 'in_transit': return accessiblePages.in_transit && <InTransit />;
      case 'accounting': return accessiblePages.accounting && <Accounting />;
      case 'deposits': return accessiblePages.deposits && <SecurityDeposits />;
      case 'reports': return accessiblePages.reports && <Reports />;
      case 'settings': return accessiblePages.settings && <Settings />;
      default: return accessiblePages.dashboard && <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-transparent">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        storeName={storeSettings.storeName}
        accessiblePages={accessiblePages} 
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} activeViewLabel={navLabels[activeView] || 'داشبورد'} />
        <div className="flex-1 overflow-y-auto">
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
};


const AuthGate: React.FC = () => {
    const { isAuthenticated } = useAppContext();
    if (!isAuthenticated) {
        return <Login />;
    }
    return <AppContent />;
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
};

export default App;