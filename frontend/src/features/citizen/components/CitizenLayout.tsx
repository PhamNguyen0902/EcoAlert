import { Outlet } from 'react-router-dom';
import CitizenNavbar from './CitizenNavbar';
import CitizenFooter from './CitizenFooter';

//layout tông thể cho citizen
export default function CitizenLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      <CitizenNavbar />
      
      <main className="flex-1 flex flex-col">
        {/* outlet thay đổi theo URL */}
        <Outlet />
      </main>

      <CitizenFooter />
    </div>
  );
}


