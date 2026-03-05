import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', icon: 'home', label: '儀表板' },
  { to: '/meals', icon: 'restaurant_menu', label: '飲食紀錄' },
  { to: '/exercise', icon: 'fitness_center', label: '運動' },
  { to: '/body', icon: 'monitoring', label: '數據分析' },
  { to: '/settings', icon: 'settings', label: '設定' },
];

export default function Layout() {
  return (
    <div className="min-h-[100dvh] bg-background-light pb-20">
      <Outlet />
      {/* 底部導航列 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50" style={{ transform: 'translateZ(0)' }}>
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-2 py-1 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-primary'}`
              }
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
