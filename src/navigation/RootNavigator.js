import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { startTaskProximityChecks } from '../lib/proximityAlerts';
import { LoadingScreen } from '../screens/LoadingScreen';
import { AppNavigator } from './AppNavigator';
import { AuthNavigator } from './AuthNavigator';

export function RootNavigator() {
  const { isLoading, session, user } = useAuth();

  useEffect(() => {
    if (!session || !user?.id) {
      return undefined;
    }

    return startTaskProximityChecks({ userId: user.id });
  }, [session, user?.id]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return session ? <AppNavigator /> : <AuthNavigator />;
}
