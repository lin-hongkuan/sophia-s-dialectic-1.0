import { useEffect, useState } from 'react';
import { isActiveConfigReady, subscribe } from '../services/sophiaConfig';

const BUILD_API_CONFIGURED = process.env.SOPHIA_API_CONFIGURED === 'true';

export const useApiConfigured = () => {
  const [apiConfigured, setApiConfigured] = useState(() => BUILD_API_CONFIGURED || isActiveConfigReady());

  useEffect(() => subscribe(() => {
    setApiConfigured(BUILD_API_CONFIGURED || isActiveConfigReady());
  }), []);

  return apiConfigured;
};
