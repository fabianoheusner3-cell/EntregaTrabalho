import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  ALERT_RADIUS_OPTIONS,
  DEFAULT_ALERT_RADIUS_METERS,
  ensureNotificationSetup,
  getAlertRadiusMeters,
  setAlertRadiusMeters,
} from '../lib/proximityAlerts';
import { colors } from '../theme';

export function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [alertRadius, setAlertRadius] = useState(DEFAULT_ALERT_RADIUS_METERS);
  const [isLoadingRadius, setIsLoadingRadius] = useState(true);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getAlertRadiusMeters()
      .then((radius) => {
        if (isMounted) {
          setAlertRadius(radius);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRadius(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleChangeRadius(radius) {
    setAlertRadius(radius);
    try {
      await setAlertRadiusMeters(radius);
    } catch (error) {
      Alert.alert(
        'Erro ao salvar',
        'Nao foi possivel salvar o raio de alerta neste dispositivo.',
      );
    }
  }

  async function handleEnableNotifications() {
    setIsEnablingNotifications(true);
    let isEnabled = false;

    try {
      isEnabled = await ensureNotificationSetup();
    } catch (error) {
      Alert.alert(
        'Erro nas notificacoes',
        'Nao foi possivel preparar as notificacoes locais.',
      );
      setIsEnablingNotifications(false);
      return;
    }

    setIsEnablingNotifications(false);

    Alert.alert(
      isEnabled ? 'Notificacoes ativas' : 'Permissao pendente',
      isEnabled
        ? 'O app vai avisar quando voce estiver perto de uma tarefa.'
        : 'Ative as notificacoes nas configuracoes do dispositivo para receber alertas.',
    );
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);

    if (error) {
      Alert.alert('Erro ao sair', error.message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons
            color={colors.primaryDark}
            name="account-outline"
            size={46}
          />
        </View>
        <Text style={styles.title}>Minha conta</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeader}>
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="map-marker-radius-outline"
              size={22}
            />
            <View style={styles.settingsTitleBlock}>
              <Text style={styles.settingsTitle}>Alertas por proximidade</Text>
              <Text style={styles.settingsText}>
                Raio atual: {alertRadius} metros
              </Text>
            </View>
          </View>

          <View style={styles.radiusOptions}>
            {ALERT_RADIUS_OPTIONS.map((radius) => (
              <Pressable
                disabled={isLoadingRadius}
                key={radius}
                onPress={() => handleChangeRadius(radius)}
                style={[
                  styles.radiusButton,
                  alertRadius === radius && styles.radiusButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.radiusButtonText,
                    alertRadius === radius && styles.radiusButtonTextActive,
                  ]}
                >
                  {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={isEnablingNotifications}
            onPress={handleEnableNotifications}
            style={styles.notificationButton}
          >
            {isEnablingNotifications ? (
              <ActivityIndicator color={colors.primaryDark} size="small" />
            ) : (
              <MaterialCommunityIcons
                color={colors.primaryDark}
                name="bell-ring-outline"
                size={20}
              />
            )}
            <Text style={styles.notificationButtonText}>
              Ativar notificacoes locais
            </Text>
          </Pressable>
        </View>

        <Pressable
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutPressed,
            isSigningOut && styles.disabled,
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <MaterialCommunityIcons
                color={colors.danger}
                name="logout"
                size={21}
              />
              <Text style={styles.logoutText}>Sair da conta</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E9F4FF',
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
  },
  email: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 7,
  },
  settingsPanel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 34,
    maxWidth: 360,
    padding: 14,
    width: '100%',
  },
  settingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  settingsTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  settingsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  settingsText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
  },
  radiusOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  radiusButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 38,
    justifyContent: 'center',
  },
  radiusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radiusButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  radiusButtonTextActive: {
    color: '#FFFFFF',
  },
  notificationButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 42,
    justifyContent: 'center',
    marginTop: 12,
  },
  notificationButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#E9B8BE',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    height: 50,
    justifyContent: 'center',
    marginTop: 22,
    maxWidth: 360,
    width: '100%',
  },
  logoutPressed: {
    backgroundColor: '#FFF4F5',
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
