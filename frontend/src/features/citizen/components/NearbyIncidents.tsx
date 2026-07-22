import { useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Alert } from '@/types';
import { cn } from '@/lib/utils';

interface NearbyIncidentsProps {
  alerts: Alert[];
}

export function NearbyIncidents({ alerts }: NearbyIncidentsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      case 'low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'rejected': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'; // pending
    }
  };

  const displayAlerts = alerts.slice(0, 10);

  if (displayAlerts.length === 0) {
    return (
      <section className="py-12 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No nearby incidents</h3>
          <p className="text-gray-500 dark:text-gray-400">There are currently no environmental incidents reported in your area.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-white dark:bg-slate-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
              Nearby Incidents
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Recent reports from your community
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayAlerts.map((alert) => (
            <Link
              key={alert._id}
              to={`/incidents/${alert._id}`}
              className="flex-none w-[300px] sm:w-[350px] snap-start bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-slate-800 group"
            >
              <div className="h-48 w-full relative overflow-hidden bg-gray-100 dark:bg-slate-800">
                {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
                  <img 
                    src={alert.mediaUrls[0]} 
                    alt={alert.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                    <MapPin className="w-10 h-10 text-gray-400 opacity-50" />
                  </div>
                )}
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md", getSeverityColor(alert.severity))}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white line-clamp-1 flex-1">
                    {alert.title}
                  </h3>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                    {alert.category.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-medium", getStatusColor(alert.status))}>
                    {alert.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-auto pt-4 border-t border-gray-100 dark:border-slate-800">
                  <Clock className="w-4 h-4 mr-1.5" />
                  <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
