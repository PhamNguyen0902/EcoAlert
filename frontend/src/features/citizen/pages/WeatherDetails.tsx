import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  Sunrise,
  Sunset,
  Thermometer,
  Umbrella,
  Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  formatProviderLocalDay,
  formatProviderLocalTime,
  parseWeatherCoordinates,
  providerLocalDateKey,
  toWeatherCoordinates,
  weatherAqiLabelKey,
} from '@/lib/weather-details';
import { useGeolocation } from '../hooks/useGeolocation';
import { useWeatherDetails } from '../hooks/useWeather';
import { WeatherConditionIcon } from '../components/WeatherConditionIcon';
import { getWeatherConditionDisplay } from '@/lib/domain-i18n';

export default function WeatherDetails() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedCoordinates = useMemo(
    () => parseWeatherCoordinates(searchParams),
    [searchParams],
  );
  const geolocation = useGeolocation(!requestedCoordinates);
  const coordinates = requestedCoordinates ??
    toWeatherCoordinates(geolocation.latitude, geolocation.longitude);
  const weatherQuery = useWeatherDetails(
    coordinates?.lat ?? null,
    coordinates?.lng ?? null,
  );
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB';

  if ((!coordinates && geolocation.loading) || weatherQuery.isLoading) {
    return <WeatherDetailsSkeleton />;
  }

  if (!coordinates) {
    return (
      <WeatherDetailsError
        title={t('weather.location_unavailable')}
        body={t('weather.location_unavailable_desc')}
        retryLabel={t('weather.retry')}
        onRetry={geolocation.refresh}
      />
    );
  }

  if (weatherQuery.isError || !weatherQuery.data) {
    return (
      <WeatherDetailsError
        title={t('weather.details_unavailable')}
        body={t('weather.details_unavailable_desc')}
        retryLabel={t('weather.retry')}
        onRetry={() => weatherQuery.refetch()}
      />
    );
  }

  const details = weatherQuery.data;
  const timezoneOffset = details.location.timezoneOffsetSeconds;
  const today = providerLocalDateKey(new Date(), timezoneOffset);
  const locationLabel = [details.location.name, details.location.country]
    .filter(Boolean)
    .join(', ') || t('weather.location_unavailable');
  const aqi = details.availability.airQuality ? details.airQuality : null;
  const metrics = [
    {
      label: t('weather.feels_like'),
      value: String(Math.round(details.current.feelsLike)) + '°C',
      icon: Thermometer,
      color: 'text-orange-500',
    },
    {
      label: t('weather.humidity'),
      value: String(details.current.humidity) + '%',
      icon: Droplets,
      color: 'text-sky-500',
    },
    {
      label: t('weather.wind'),
      value: String(Math.round(details.current.windSpeed)) + ' ' + t('weather.unit_kmh'),
      icon: Wind,
      color: 'text-teal-500',
    },
    ...(details.current.pressure === null ? [] : [{
      label: t('weather.pressure'),
      value: String(details.current.pressure) + ' hPa',
      icon: Gauge,
      color: 'text-violet-500',
    }]),
    ...(details.current.visibilityKm === null ? [] : [{
      label: t('weather.visibility'),
      value: String(details.current.visibilityKm) + ' ' + t('weather.unit_km'),
      icon: Eye,
      color: 'text-indigo-500',
    }]),
    ...(aqi === null ? [] : [{
      label: t('weather.air_quality'),
      value: String(aqi.aqi) + ' · ' + t(weatherAqiLabelKey(aqi.aqi)),
      icon: CloudSun,
      color: 'text-emerald-500',
    }]),
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="-ml-3 gap-2" onClick={() => navigate('/home')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('weather.back_dashboard')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => weatherQuery.refetch()}
          disabled={weatherQuery.isFetching}
        >
          <RefreshCw className={'h-4 w-4 ' + (weatherQuery.isFetching ? 'animate-spin' : '')} aria-hidden="true" />
          {t('weather.refresh')}
        </Button>
      </div>

      <section aria-labelledby="weather-details-title">
        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-sky-50 to-cyan-100/60 shadow-sm dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('weather.details')}</p>
                <h1 id="weather-details-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{locationLabel}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {t('weather.current_conditions')}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:text-right">
                <div>
                  <p className="text-6xl font-bold tracking-tighter sm:text-7xl">{Math.round(details.current.temperature)}°</p>
                  <p className="mt-1 text-lg font-medium capitalize">{getWeatherConditionDisplay(language, details.current.condition || details.current.description)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('weather.feels_like')} {Math.round(details.current.feelsLike)}°</p>
                </div>
                <WeatherConditionIcon condition={details.current.condition || details.current.description} icon={details.current.icon} className="h-24 w-24 shrink-0 text-sky-500 drop-shadow-sm" aria-label={getWeatherConditionDisplay(language, details.current.condition || details.current.description)} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/50 pt-4 text-sm text-muted-foreground">
              <span>{t('weather.last_updated')}: {formatProviderLocalTime(details.fetchedAt, timezoneOffset, locale)}</span>
              <span className="flex items-center gap-1"><Sunrise className="h-4 w-4 text-orange-500" aria-hidden="true" />{t('weather.sunrise')}: {details.current.sunrise}</span>
              <span className="flex items-center gap-1"><Sunset className="h-4 w-4 text-indigo-500" aria-hidden="true" />{t('weather.sunset')}: {details.current.sunset}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label={t('weather.current_conditions')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex min-h-28 items-center gap-4 p-4">
              <div className="rounded-xl bg-muted p-3"><Icon className={'h-5 w-5 ' + color} aria-hidden="true" /></div>
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="weather-hourly-title">
        <div className="mb-3">
          <h2 id="weather-hourly-title" className="text-xl font-bold">{t('weather.hourly_forecast')}</h2>
          <p className="text-sm text-muted-foreground">{t('weather.hourly_forecast_body')}</p>
        </div>
        {details.availability.forecast && details.hourly.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2" aria-label={t('weather.hourly_forecast')}>
            {details.hourly.slice(0, 12).map((period) => (
              <Card key={period.timestamp} className="min-w-28 shrink-0">
                <CardContent className="flex min-h-40 flex-col items-center justify-between p-3 text-center">
                  <p className="text-sm font-semibold">{formatProviderLocalTime(period.timestamp, timezoneOffset, locale)}</p>
                  <WeatherConditionIcon condition={period.condition || period.description} icon={period.icon} className="h-12 w-12 text-sky-500" aria-label={getWeatherConditionDisplay(language, period.condition || period.description)} />
                  <p className="text-xl font-bold">{Math.round(period.temperature)}°</p>
                  <p className="max-w-full truncate text-xs text-muted-foreground">{getWeatherConditionDisplay(language, period.condition || period.description)}</p>
                  <p className="flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400"><Umbrella className="h-3.5 w-3.5" aria-hidden="true" />{period.precipitationProbability}%</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <WeatherPartialState onRetry={() => weatherQuery.refetch()} message={t('weather.forecast_unavailable')} retryLabel={t('weather.retry')} />
        )}
      </section>

      <section aria-labelledby="weather-daily-title">
        <h2 id="weather-daily-title" className="mb-3 text-xl font-bold">{t('weather.daily_forecast')}</h2>
        {details.availability.forecast && details.daily.length > 0 ? (
          <Card>
            <CardContent className="divide-y p-0">
              {details.daily.map((day) => (
                <div key={day.date} className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{day.date === today ? t('weather.today') : formatProviderLocalDay(day.date, locale)}</p>
                    <p className="truncate text-sm text-muted-foreground">{getWeatherConditionDisplay(language, day.condition || day.description)}</p>
                  </div>
                  <WeatherConditionIcon condition={day.condition || day.description} icon={day.icon} className="h-11 w-11 shrink-0 text-sky-500" aria-label={getWeatherConditionDisplay(language, day.condition || day.description)} />
                  <p className="hidden items-center gap-1 text-sm text-sky-600 sm:flex dark:text-sky-400"><Umbrella className="h-3.5 w-3.5" aria-hidden="true" />{day.precipitationProbability}%</p>
                  <p className="whitespace-nowrap font-semibold">{Math.round(day.maxTemperature)}° / {Math.round(day.minTemperature)}°</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <WeatherPartialState onRetry={() => weatherQuery.refetch()} message={t('weather.forecast_unavailable')} retryLabel={t('weather.retry')} />
        )}
      </section>
    </main>
  );
}

function WeatherPartialState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <Card><CardContent className="flex min-h-24 flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>{retryLabel}</Button>
    </CardContent></Card>
  );
}

function WeatherDetailsError({ title, body, retryLabel, onRetry }: { title: string; body: string; retryLabel: string; onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[55vh] max-w-7xl items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md"><CardContent className="flex flex-col items-center p-8 text-center">
        <CloudSun className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Button className="mt-5 gap-2" onClick={onRetry}><RefreshCw className="h-4 w-4" aria-hidden="true" />{retryLabel}</Button>
      </CardContent></Card>
    </main>
  );
}

function WeatherDetailsSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </main>
  );
}
