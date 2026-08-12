import React from 'react';
import {
  Activity,
  Droplets,
  Sun,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';
import { format } from 'date-fns';

import { useWeather } from '../hooks/useWeather';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getWeatherConditionDisplay } from '@/lib/domain-i18n';

interface WeatherWidgetProps {
  latitude: number | null;
  longitude: number | null;
}

export function WeatherWidget({
  latitude,
  longitude,
}: WeatherWidgetProps) {
  const { language, t } = useLanguage();

  const {
    data: weather,
    isLoading,
    isError,
    refetch,
  } = useWeather(latitude, longitude);

  if (isLoading || (!weather && !isError)) {
    return (
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="space-y-4">
          <Skeleton className="h-12 w-32" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-12 w-full"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !weather) {
    return (
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
            <Activity className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold">
              {t('weather.unavailable')}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {t('weather.unavailable_desc')}
            </p>

            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              {t('weather.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getAqiColor = (aqi: number) => {
    switch (aqi) {
      case 1:
        return 'bg-green-500/10 text-green-600 border-green-500/20';

      case 2:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';

      case 3:
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';

      case 4:
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';

      case 5:
        return 'bg-red-500/10 text-red-600 border-red-500/20';

      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const weatherCondition = getWeatherConditionDisplay(
    language,
    weather.description,
  );

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      <div className="relative z-10 flex h-full flex-col p-5 text-slate-800 dark:text-slate-100 sm:p-6">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-5xl font-bold tracking-tighter">
                {Math.round(weather.temperature)}°
              </span>

              <img
                src={weather.icon}
                alt={weatherCondition}
                className="h-16 w-16 drop-shadow-md"
              />
            </div>

            <div className="mt-1 text-sm font-medium">
              {weatherCondition}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {t('weather.feels_like')}{' '}
              {Math.round(weather.feelsLike)}°
            </div>
          </div>

          <div className="text-right">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('weather.last_updated')}
            </div>

            <div className="text-sm font-medium">
              {format(
                new Date(weather.lastUpdated),
                'HH:mm',
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-200/50 pt-4 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/50 p-2 shadow-sm dark:bg-slate-800/50">
              <Droplets className="h-4 w-4 text-blue-500" />
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('weather.humidity')}
              </p>

              <p className="text-sm font-semibold">
                {weather.humidity}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/50 p-2 shadow-sm dark:bg-slate-800/50">
              <Wind className="h-4 w-4 text-teal-500" />
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('weather.wind')}
              </p>

              <p className="text-sm font-semibold">
                {weather.windSpeed} km/h
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/50 p-2 shadow-sm dark:bg-slate-800/50">
              <Activity className="h-4 w-4 text-purple-500" />
            </div>

            <div>
              <p className="mb-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('weather.air_quality')}
              </p>

              <Badge
                variant="outline"
                className={cn(
                  'border px-1.5 py-0 text-[10px] leading-none',
                  getAqiColor(weather.aqi || 0),
                )}
              >
                {weather.aqiLabel}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/50 p-2 shadow-sm dark:bg-slate-800/50">
              <Sun className="h-4 w-4 text-yellow-500" />
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('weather.uv_index')}
              </p>

              <p className="text-sm font-semibold">
                --
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/50 p-2 shadow-sm dark:bg-slate-800/50">
              <Sunrise className="h-4 w-4 text-orange-400" />
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('weather.sunrise')}
              </p>

              <p className="text-sm font-semibold">
                {weather.sunrise}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/50 p-2 shadow-sm dark:bg-slate-800/50">
              <Sunset className="h-4 w-4 text-indigo-400" />
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('weather.sunset')}
              </p>

              <p className="text-sm font-semibold">
                {weather.sunset}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}