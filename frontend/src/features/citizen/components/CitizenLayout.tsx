import { Outlet } from 'react-router-dom';
import CitizenNavbar from './CitizenNavbar';
import CitizenFooter from './CitizenFooter';

export default function CitizenLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      <CitizenNavbar />
      
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <CitizenFooter />
    </div>
  );
}


