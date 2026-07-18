import { Routes, Route, Link } from 'react-router-dom';
import { Button } from './components/ui/button';
import { MapPin, AlertTriangle, ShieldCheck } from 'lucide-react';

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="bg-primary/10 p-4 rounded-full mb-6">
        <MapPin className="w-16 h-16 text-primary" />
      </div>
      <h1 className="text-5xl font-bold tracking-tight mb-4">Welcome to EcoAlert</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
        Intelligent Environmental Incident Reporting & Management System. 
        Report issues, get them analyzed by AI, and track their resolution.
      </p>
      
      <div className="flex gap-4">
        <Button size="lg" asChild>
          <Link to="/report">Report Incident</Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link to="/map">View Map</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl">
        <div className="p-6 border rounded-xl shadow-sm text-left">
          <AlertTriangle className="w-10 h-10 text-orange-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Report Instantly</h3>
          <p className="text-muted-foreground">Upload photos of environmental issues. Our AI instantly classifies them.</p>
        </div>
        <div className="p-6 border rounded-xl shadow-sm text-left">
          <MapPin className="w-10 h-10 text-blue-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">GIS Tracking</h3>
          <p className="text-muted-foreground">All incidents are mapped and tracked geographically for authorities.</p>
        </div>
        <div className="p-6 border rounded-xl shadow-sm text-left">
          <ShieldCheck className="w-10 h-10 text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Fast Resolution</h3>
          <p className="text-muted-foreground">Officers are assigned automatically based on priority and location.</p>
        </div>
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <MapPin />
            EcoAlert
          </Link>
          <nav className="flex gap-6">
            <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
            <Link to="/map" className="text-sm font-medium hover:text-primary transition-colors">Map</Link>
            <Link to="/report" className="text-sm font-medium hover:text-primary transition-colors">Report</Link>
            <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto py-8">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<div className="text-center mt-10">Map Component Placeholder (Requires map integration)</div>} />
        <Route path="/report" element={<div className="text-center mt-10">Report Form Placeholder (Requires logic)</div>} />
        <Route path="/dashboard" element={<div className="text-center mt-10">Dashboard Placeholder (Requires auth)</div>} />
      </Routes>
    </Layout>
  );
}

export default App;
