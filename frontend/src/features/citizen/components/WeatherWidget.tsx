import React from 'react';
import { useWeather } from '../hooks/useWeather';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Droplets, Wind, Activity, Sun, Sunrise, Sunset, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WeatherWidgetProps {
  latitude: number | null;
  longitude: number | null;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ latitude, longitude }) => {
  const { data: weather, isLoading, isError, refetch } = useWeather(latitude, longitude);

  if (isLoading || (!weather && !isError)) {
    return (
      <div className="w-full h-[300px] rounded-xl overflow-hidden glass-card flex flex-col p-6 gap-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-12 w-24" />
        </div>
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !weather) {
    return (
      <div className="w-full p-6 rounded-xl glass-card flex flex-col items-center justify-center text-center gap-4 h-[300px]">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <div>
          <h3 className="font-semibold">Weather Unavailable</h3>
          <p className="text-sm text-muted-foreground mt-1">Unable to fetch current weather data.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const getAqiColor = (aqi: number) => {
    switch (aqi) {
      case 1: return 'bg-green-500/10 text-green-600 border-green-500/20'; // Good
      case 2: return 'bg-blue-500/10 text-blue-600 border-blue-500/20'; // Fair
      case 3: return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'; // Moderate
      case 4: return 'bg-orange-500/10 text-orange-600 border-orange-500/20'; // Poor
      case 5: return 'bg-red-500/10 text-red-600 border-red-500/20'; // Very Poor
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="w-full relative overflow-hidden rounded-xl border border-border/50 shadow-xl transition-all duration-300 hover:shadow-2xl">
      {/* Background with dynamic gradient based on time of day could go here, for now using a subtle glass gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-blue-100/50 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-xl -z-10" />
      
      <div className="p-5 sm:p-6 flex flex-col h-full z-10 text-slate-800 dark:text-slate-100">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-5xl font-bold tracking-tighter">
                {Math.round(weather.temperature)}°
              </span>
              <img src={weather.icon} alt={weather.description} className="w-16 h-16 drop-shadow-md" />
            </div>
            <p className="text-lg font-medium capitalize mt-1 text-slate-700 dark:text-slate-200">
              {weather.description}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Feels like {Math.round(weather.feelsLike)}°
            </p>
          </div>
          
          <div className="text-right">
             <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
               Last updated
             </div>
             <div className="text-sm font-medium">
               {format(new Date(weather.lastUpdated), 'HH:mm')}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 mt-auto pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm">
              <Droplets className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Humidity</p>
              <p className="font-semibold text-sm">{weather.humidity}%</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm">
              <Wind className="w-4 h-4 text-teal-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Wind</p>
              <p className="font-semibold text-sm">{weather.windSpeed} km/h</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm">
              <Activity className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Air Quality</p>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border leading-none', getAqiColor(weather.aqi || 0))}>
                {weather.aqiLabel}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm">
              <Sun className="w-4 h-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">UV Index</p>
              <p className="font-semibold text-sm">--</p> {/* OpenWeatherMap free doesn't include UV in current weather */}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm">
              <Sunrise className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sunrise</p>
              <p className="font-semibold text-sm">{weather.sunrise}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm">
              <Sunset className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sunset</p>
              <p className="font-semibold text-sm">{weather.sunset}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
