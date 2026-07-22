import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Phone, Mail, MapPin, Facebook, Twitter, Instagram, Github } from 'lucide-react';

export default function CitizenFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 relative border-t-4 border-t-green-500 overflow-hidden mt-auto">
      {/* Subtle top gradient */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-green-500/10 to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          
          {/* Brand Col */}
          <div className="space-y-6">
            <Link to="/home" className="flex items-center gap-2 group inline-flex">
              <div className="bg-green-500/20 p-2 rounded-xl">
                <Leaf className="h-6 w-6 text-green-400" />
              </div>
              <span className="font-bold text-2xl tracking-tight text-white">
                EcoAlert
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              A smart city platform empowering citizens to report, track, and resolve urban issues for a cleaner, safer community.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-6 tracking-wide uppercase text-sm">Quick Links</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <Link to="/home" className="hover:text-green-400 transition-colors inline-block">Home</Link>
              </li>
              <li>
                <Link to="/report" className="hover:text-green-400 transition-colors inline-block">Report Incident</Link>
              </li>
              <li>
                <Link to="/my-reports" className="hover:text-green-400 transition-colors inline-block">My Reports</Link>
              </li>
              <li>
                <Link to="/map" className="hover:text-green-400 transition-colors inline-block">City Map</Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-6 tracking-wide uppercase text-sm">Support</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-white font-medium">Emergency: 115</span>
                    <span className="text-slate-400 text-xs">24/7 Hotline</span>
                  </div>
                </div>
              </li>
              <li>
                <a href="mailto:support@ecoalert.city" className="flex items-center gap-3 hover:text-green-400 transition-colors">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>support@ecoalert.city</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-slate-400">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>123 Smart City Blvd<br/>Eco District, EC 90210</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-6 tracking-wide uppercase text-sm">Legal</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <Link to="/privacy" className="hover:text-green-400 transition-colors inline-block">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-green-400 transition-colors inline-block">Terms of Service</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-green-400 transition-colors inline-block">About Us</Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-green-400 transition-colors inline-block">FAQ</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-slate-500">
            &copy; {currentYear} EcoAlert City Services. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <span className="sr-only">Facebook</span>
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <span className="sr-only">Twitter</span>
              <Twitter className="h-5 w-5" />
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <span className="sr-only">Instagram</span>
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              <span className="sr-only">GitHub</span>
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
