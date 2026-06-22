import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView, Marker } from '../components/MapAdapter';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

const DEFAULT_REGION = {
  latitude: -23.5505,
  latitudeDelta: 0.06,
  longitude: -46.6333,
  longitudeDelta: 0.06,
};

const PRIORITY_COLORS = {
  alta: colors.danger,
  baixa: '#2F9461',
  media: '#C47A19',
};

function formatError(error) {
  if (error?.code === 'PGRST205') {
    return 'A tabela public.tasks ainda nao existe neste projeto Supabase. Execute a migration 202606150001_create_tasks.sql no SQL Editor.';
  }

  return error?.message || 'Nao foi possivel carregar o mapa.';
}

function hasCoordinates(task) {
  return Number.isFinite(Number(task.latitude)) && Number.isFinite(Number(task.longitude));
}

function getTaskRegion(task) {
  return {
    latitude: Number(task.latitude),
    latitudeDelta: 0.01,
    longitude: Number(task.longitude),
    longitudeDelta: 0.01,
  };
}

export function MapScreen() {
  const { isConfigured, user } = useAuth();
  const mapRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);

  const tasksWithLocation = useMemo(() => tasks.filter(hasCoordinates), [tasks]);

  useEffect(() => {
    centerOnCurrentLocation({ showAlert: false });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [isConfigured, user?.id]),
  );

  async function loadTasks({ refreshing = false } = {}) {
    if (!isConfigured || !user?.id) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');

    const { data, error } = await supabase
      .from('tasks')
      .select(
        'id, titulo, descricao, prioridade, concluida, latitude, longitude, nome_local, created_at',
      )
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage(formatError(error));
    } else {
      setTasks(data || []);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }

  async function centerOnCurrentLocation({ showAlert = true } = {}) {
    setIsLocating(true);
    setLocationMessage('');

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setLocationMessage('Permissao de localizacao negada.');
      setIsLocating(false);
      return;
    }

    try {
      const currentPosition = await Location.getCurrentPositionAsync({});
      const nextLocation = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };

      setUserLocation(nextLocation);
      animateToRegion({
        ...nextLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      setLocationMessage('Nao foi possivel obter sua localizacao atual.');
      if (showAlert) {
        console.warn(error);
      }
    } finally {
      setIsLocating(false);
    }
  }

  function animateToRegion(region) {
    mapRef.current?.animateToRegion(region, 450);
  }

  function selectTask(task) {
    setSelectedTask(task);
    animateToRegion(getTaskRegion(task));
  }

  const initialRegion = userLocation
    ? {
        ...userLocation,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : tasksWithLocation[0]
      ? getTaskRegion(tasksWithLocation[0])
      : DEFAULT_REGION;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ROTINAAPP</Text>
          <Text style={styles.title}>Mapa de tarefas</Text>
        </View>
        <Pressable
          accessibilityLabel="Centralizar na minha localizacao"
          disabled={isLocating}
          onPress={() => centerOnCurrentLocation()}
          style={styles.headerButton}
        >
          {isLocating ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : (
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="crosshairs-gps"
              size={22}
            />
          )}
        </Pressable>
      </View>

      {!isConfigured ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons
            color={colors.danger}
            name="database-alert-outline"
            size={44}
          />
          <Text style={styles.emptyTitle}>Supabase nao configurado</Text>
          <Text style={styles.emptyText}>
            Configure o arquivo .env e reinicie o Expo para carregar as tarefas.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons
            color={colors.danger}
            name="alert-circle-outline"
            size={44}
          />
          <Text style={styles.emptyTitle}>Erro ao carregar</Text>
          <Text style={styles.emptyText}>{errorMessage}</Text>
          <Pressable onPress={() => loadTasks()} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <MapView ref={mapRef} initialRegion={initialRegion} style={styles.map}>
            {userLocation ? (
              <Marker
                coordinate={userLocation}
                pinColor={colors.primary}
                title="Voce esta aqui"
              />
            ) : null}

            {tasksWithLocation.map((task) => (
              <Marker
                coordinate={{
                  latitude: Number(task.latitude),
                  longitude: Number(task.longitude),
                }}
                description={task.nome_local || task.descricao || undefined}
                key={task.id}
                onPress={() => selectTask(task)}
                pinColor={PRIORITY_COLORS[task.prioridade] || colors.primary}
                title={task.titulo}
              />
            ))}
          </MapView>

          <ScrollView
            contentContainerStyle={styles.taskStripContent}
            horizontal
            refreshControl={
              <RefreshControl
                colors={[colors.primary]}
                onRefresh={() => loadTasks({ refreshing: true })}
                refreshing={isRefreshing}
                tintColor={colors.primary}
              />
            }
            style={styles.taskStrip}
            showsHorizontalScrollIndicator={false}
          >
            {tasksWithLocation.length === 0 ? (
              <Text style={styles.stripEmpty}>
                Adicione um local em uma tarefa para ver pins no mapa.
              </Text>
            ) : (
              tasksWithLocation.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => selectTask(task)}
                  style={styles.stripCard}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      {
                        backgroundColor:
                          PRIORITY_COLORS[task.prioridade] || colors.primary,
                      },
                    ]}
                  />
                  <View style={styles.stripCardBody}>
                    <Text numberOfLines={1} style={styles.stripTitle}>
                      {task.titulo}
                    </Text>
                    <Text numberOfLines={1} style={styles.stripMeta}>
                      {task.nome_local || 'Local salvo'}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>

          {locationMessage ? (
            <View style={styles.locationBanner}>
              <Text style={styles.locationBannerText}>{locationMessage}</Text>
            </View>
          ) : null}
        </View>
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedTask(null)}
        transparent
        visible={Boolean(selectedTask)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedTask?.titulo}</Text>
              <Pressable
                accessibilityLabel="Fechar detalhe da tarefa"
                onPress={() => setSelectedTask(null)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  color={colors.muted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>

            <Text style={styles.detailStatus}>
              {selectedTask?.concluida ? 'Concluida' : 'Aberta'} - Prioridade{' '}
              {selectedTask?.prioridade || 'media'}
            </Text>

            {selectedTask?.nome_local ? (
              <Text style={styles.detailLocation}>{selectedTask.nome_local}</Text>
            ) : null}

            {selectedTask?.descricao ? (
              <Text style={styles.detailDescription}>{selectedTask.descricao}</Text>
            ) : null}

            {selectedTask ? (
              <Text style={styles.coordinates}>
                {Number(selectedTask.latitude).toFixed(6)},{' '}
                {Number(selectedTask.longitude).toFixed(6)}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 3,
  },
  headerButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    height: '100%',
    width: '100%',
  },
  taskStrip: {
    bottom: 14,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  taskStripContent: {
    gap: 10,
    paddingHorizontal: 14,
  },
  stripCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 12,
    shadowColor: '#183B5B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    width: 230,
  },
  priorityDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  stripCardBody: {
    flex: 1,
    minWidth: 0,
  },
  stripTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  stripMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  stripEmpty: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: 290,
  },
  locationBanner: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    right: 14,
    top: 14,
  },
  locationBannerText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    maxWidth: 320,
    textAlign: 'center',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    backgroundColor: 'rgba(23, 32, 51, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  detailTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
  },
  closeButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  detailStatus: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    textTransform: 'capitalize',
  },
  detailLocation: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
  },
  detailDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  coordinates: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 14,
  },
});
