import { useCallback, useEffect, useState } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

const FALLBACK_LAT = 10.8231;
const FALLBACK_LNG = 106.6297;

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  const refresh = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: FALLBACK_LAT,
        longitude: FALLBACK_LNG,
        accuracy: null,
        error: 'Geolocation is not supported by your browser.',
        loading: false,
      });
      return;
    }

    setState((currentState) => ({
      ...currentState,
      error: null,
      loading: true,
    }));

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        error: null,
        loading: false,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'An unknown error occurred.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'User denied the request for Geolocation.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMessage = 'The request to get user location timed out.';
          break;
      }
      
      setState({
        latitude: FALLBACK_LAT,
        longitude: FALLBACK_LNG,
        accuracy: null,
        error: errorMessage,
        loading: false,
      });
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
