export const formatAlertReference = (alertId: string): string =>
  `#ECO-${alertId.slice(-6).toUpperCase()}`;
