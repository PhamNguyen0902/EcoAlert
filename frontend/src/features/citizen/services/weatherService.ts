import type { WeatherData } from "@/types";

const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

const checkApiKey = () => {
  if (!API_KEY) {
    throw new Error("Missing VITE_WEATHER_API_KEY");
  }
};

const formatTime = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const getCurrentWeather = async (
  lat: number,
  lng: number,
): Promise<Partial<WeatherData>> => {
  checkApiKey();

  const response = await fetch(
    `${BASE_URL}/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch weather");
  }

  const data = await response.json();

  return {
    temperature: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    windDirection: data.wind.deg,
    description: data.weather?.[0]?.description ?? "",
    icon: `https://openweathermap.org/img/wn/${data.weather?.[0]?.icon}@2x.png`,
    sunrise: formatTime(data.sys.sunrise),
    sunset: formatTime(data.sys.sunset),
  };
};

export const getAirQuality = async (
  lat: number,
  lng: number,
): Promise<{ aqi: number; aqiLabel: string }> => {
  checkApiKey();

  const response = await fetch(
    `${BASE_URL}/air_pollution?lat=${lat}&lon=${lng}&appid=${API_KEY}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch AQI");
  }

  const data = await response.json();

  const aqi = data.list?.[0]?.main?.aqi ?? 0;

  const labels = [
    "Unknown",
    "Good",
    "Fair",
    "Moderate",
    "Poor",
    "Very Poor",
  ];

  return {
    aqi,
    aqiLabel: labels[aqi] ?? "Unknown",
  };
};

export const getFullWeather = async (
  lat: number,
  lng: number,
): Promise<WeatherData> => {
  const [weather, air] = await Promise.all([
    getCurrentWeather(lat, lng),
    getAirQuality(lat, lng),
  ]);

  return {
    temperature: weather.temperature ?? 0,
    feelsLike: weather.feelsLike ?? 0,
    humidity: weather.humidity ?? 0,
    windSpeed: weather.windSpeed ?? 0,
    windDirection: weather.windDirection ?? 0,
    description: weather.description ?? "",
    icon: weather.icon ?? "",
    sunrise: weather.sunrise ?? "",
    sunset: weather.sunset ?? "",
    aqi: air.aqi,
    aqiLabel: air.aqiLabel,
    lastUpdated: new Date().toISOString(),
  };
};