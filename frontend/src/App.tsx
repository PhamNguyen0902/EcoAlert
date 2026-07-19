import { Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ReportList from './pages/ReportList';
import CreateAlert from './pages/CreateAlert';
import AlertDetail from './pages/AlertDetail';
import InteractiveMap from './pages/InteractiveMap';
import NotificationCenter from './pages/Notifications';
import Profile from './pages/Profile';
import { DashboardLayout } from './components/layout/DashboardLayout';

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-slate-50">
      <h1 className="text-5xl font-bold tracking-tight mb-4 text-green-700">EcoAlert</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
        Intelligent Environmental Incident Reporting & Management System. 
      </p>
      <div className="flex gap-4">
        <Link to="/login" className="px-6 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700">Login</Link>
        <Link to="/register" className="px-6 py-2 bg-white text-green-600 border border-green-600 rounded-md shadow-sm hover:bg-green-50">Register</Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<ReportList />} />
        <Route path="/report" element={<CreateAlert />} />
        <Route path="/alerts/:id" element={<AlertDetail />} />
        <Route path="/map" element={<InteractiveMap />} />
        <Route path="/notifications" element={<NotificationCenter />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default App;
