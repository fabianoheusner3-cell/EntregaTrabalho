import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const ALERT_RADIUS_KEY = '@rotinaapp:alert-radius-meters';
export const DEFAULT_ALERT_RADIUS_METERS = 250;
export const ALERT_RADIUS_OPTIONS = [100, 250, 500, 1000];

const ALERT_CHECK_INTERVAL_MS = 60 * 1000;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const NOTIFIED_TASKS_KEY = '@rotinaapp:notified-task-timestamps';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getAlertRadiusMeters() {
  const storedRadius = await AsyncStorage.getItem(ALERT_RADIUS_KEY);
  const radius = Number(storedRadius);

  return Number.isFinite(radius) && radius > 0
    ? radius
    : DEFAULT_ALERT_RADIUS_METERS;
}

export async function setAlertRadiusMeters(radius) {
  await AsyncStorage.setItem(ALERT_RADIUS_KEY, String(radius));
}

export async function ensureNotificationSetup() {
  if (Platform.OS === 'web') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('task-proximity', {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: 'Alertas de tarefas',
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  const finalPermissions = currentPermissions.granted
    ? currentPermissions
    : await Notifications.requestPermissionsAsync();

  return finalPermissions.granted;
}

export async function checkTaskProximity({ userId }) {
  if (Platform.OS === 'web' || !userId) {
    return;
  }

  const [{ status }, notificationsEnabled] = await Promise.all([
    Location.requestForegroundPermissionsAsync(),
    ensureNotificationSetup(),
  ]);

  if (status !== 'granted' || !notificationsEnabled) {
    return;
  }

  const [currentPosition, radiusMeters, notifiedTasks] = await Promise.all([
    Location.getCurrentPositionAsync({}),
    getAlertRadiusMeters(),
    getNotifiedTasks(),
  ]);

  const { data, error } = await supabase
    .from('tasks')
    .select('id, titulo, nome_local, latitude, longitude')
    .eq('concluida', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error || !data?.length) {
    return;
  }

  const now = Date.now();
  const nextNotifiedTasks = { ...notifiedTasks };

  for (const task of data) {
    const distance = getDistanceMeters(currentPosition.coords, {
      latitude: Number(task.latitude),
      longitude: Number(task.longitude),
    });
    const lastNotificationAt = Number(notifiedTasks[task.id] || 0);
    const canNotify = now - lastNotificationAt > ALERT_COOLDOWN_MS;

    if (distance <= radiusMeters && canNotify) {
      await Notifications.scheduleNotificationAsync({
        content: {
          body: task.nome_local
            ? `Voce esta perto de ${task.nome_local}.`
            : `Voce esta a ${Math.round(distance)} m deste local.`,
          data: { taskId: task.id },
          sound: true,
          title: `Tarefa por perto: ${task.titulo}`,
        },
        trigger: null,
      });

      nextNotifiedTasks[task.id] = now;
    }
  }

  await saveNotifiedTasks(nextNotifiedTasks);
}

export function startTaskProximityChecks({ userId }) {
  let isChecking = false;

  async function runCheck() {
    if (isChecking) {
      return;
    }

    isChecking = true;
    try {
      await checkTaskProximity({ userId });
    } catch (error) {
      console.warn('Nao foi possivel verificar proximidade com tarefas.', error);
    } finally {
      isChecking = false;
    }
  }

  runCheck();
  const intervalId = setInterval(runCheck, ALERT_CHECK_INTERVAL_MS);

  return () => clearInterval(intervalId);
}

async function getNotifiedTasks() {
  const storedValue = await AsyncStorage.getItem(NOTIFIED_TASKS_KEY);

  if (!storedValue) {
    return {};
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    return {};
  }
}

async function saveNotifiedTasks(notifiedTasks) {
  await AsyncStorage.setItem(NOTIFIED_TASKS_KEY, JSON.stringify(notifiedTasks));
}

function getDistanceMeters(origin, destination) {
  const earthRadiusMeters = 6371000;
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const latitudeDistance = toRadians(destination.latitude - origin.latitude);
  const longitudeDistance = toRadians(destination.longitude - origin.longitude);

  const haversine =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDistance / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
