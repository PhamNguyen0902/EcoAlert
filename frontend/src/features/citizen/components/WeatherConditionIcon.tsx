import {
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  type LucideProps,
} from 'lucide-react';

interface WeatherConditionIconProps extends LucideProps {
  condition?: string;
  icon?: string;
}

const isNightIcon = (icon?: string) => /(?:^|\/)\d{2}n(?:@|\.)/.test(icon ?? '');

export function WeatherConditionIcon({
  condition = '',
  icon,
  ...props
}: WeatherConditionIconProps) {
  const normalized = (condition + ' ' + (icon ?? '')).toLowerCase();

  if (normalized.includes('thunder')) return <CloudLightning {...props} />;
  if (normalized.includes('rain') || normalized.includes('drizzle')) return <CloudRain {...props} />;
  if (normalized.includes('snow')) return <Snowflake {...props} />;
  if (normalized.includes('mist') || normalized.includes('fog') || normalized.includes('haze')) return <CloudFog {...props} />;
  if (normalized.includes('cloud')) return isNightIcon(icon) ? <CloudMoon {...props} /> : <CloudSun {...props} />;
  return isNightIcon(icon) ? <Moon {...props} /> : <Sun {...props} />;
}
