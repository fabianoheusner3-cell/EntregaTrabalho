import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView, Marker } from '../components/MapAdapter';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

const DEFAULT_REGION = {
  latitude: -23.5505,
  latitudeDelta: 0.02,
  longitude: -46.6333,
  longitudeDelta: 0.02,
};

const PRIORITIES = [
  { label: 'Baixa', value: 'baixa', color: '#2F9461' },
  { label: 'Media', value: 'media', color: '#C47A19' },
  { label: 'Alta', value: 'alta', color: colors.danger },
];

const PRIORITY_FILTERS = [{ label: 'Todas', value: 'all' }, ...PRIORITIES];

const STATUS_FILTERS = [
  { label: 'Todas', value: 'all' },
  { label: 'Abertas', value: 'open' },
  { label: 'Concluidas', value: 'done' },
];

const EMPTY_FORM = {
  descricao: '',
  latitude: '',
  longitude: '',
  nome_local: '',
  prioridade: 'media',
  titulo: '',
};

function getPriorityMeta(prioridade) {
  return PRIORITIES.find((item) => item.value === prioridade) || PRIORITIES[1];
}

function hasValidCoordinates(latitude, longitude) {
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180
  );
}

function buildRegion(latitude, longitude) {
  if (!hasValidCoordinates(latitude, longitude)) {
    return DEFAULT_REGION;
  }

  return {
    latitude: Number(latitude),
    latitudeDelta: 0.02,
    longitude: Number(longitude),
    longitudeDelta: 0.02,
  };
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function formatError(error) {
  if (error?.code === 'PGRST205') {
    return 'A tabela public.tasks ainda nao existe neste projeto Supabase. Execute a migration 202606150001_create_tasks.sql no SQL Editor.';
  }

  return error?.message || 'Nao foi possivel completar a operacao.';
}

export function TasksScreen() {
  const { isConfigured, user } = useAuth();
  const insets = useSafeAreaInsets();
  const formMapRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMapRegion, setFormMapRegion] = useState(DEFAULT_REGION);
  const [isLocatingForm, setIsLocatingForm] = useState(false);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesPriority =
          priorityFilter === 'all' || task.prioridade === priorityFilter;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'done' ? task.concluida : !task.concluida);

        return matchesPriority && matchesStatus;
      }),
    [priorityFilter, statusFilter, tasks],
  );

  useEffect(() => {
    loadTasks();
  }, [isConfigured, user?.id]);

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
      .order('concluida', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage(formatError(error));
    } else {
      setTasks(data || []);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }

  function openCreateForm() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormMapRegion(DEFAULT_REGION);
    setIsFormVisible(true);
    centerFormOnCurrentLocation({ silent: true });
  }

  function openEditForm(task) {
    setEditingTask(task);
    setForm({
      descricao: task.descricao || '',
      latitude: task.latitude?.toString() || '',
      longitude: task.longitude?.toString() || '',
      nome_local: task.nome_local || '',
      prioridade: task.prioridade || 'media',
      titulo: task.titulo || '',
    });
    setFormMapRegion(buildRegion(task.latitude, task.longitude));
    setIsFormVisible(true);
  }

  function closeForm() {
    if (isSaving) {
      return;
    }

    setIsFormVisible(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormMapRegion(DEFAULT_REGION);
  }

  function updateFormLocation(coordinate) {
    const nextRegion = {
      latitude: coordinate.latitude,
      latitudeDelta: 0.02,
      longitude: coordinate.longitude,
      longitudeDelta: 0.02,
    };

    setForm((current) => ({
      ...current,
      latitude: formatCoordinate(coordinate.latitude),
      longitude: formatCoordinate(coordinate.longitude),
    }));
    setFormMapRegion(nextRegion);
    formMapRef.current?.animateToRegion(nextRegion, 300);
  }

  async function centerFormOnCurrentLocation({ silent = false } = {}) {
    setIsLocatingForm(true);

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setIsLocatingForm(false);
      if (!silent) {
        Alert.alert(
          'Permissao negada',
          'Permita o acesso a localizacao para usar sua posicao atual.',
        );
      }
      return;
    }

    try {
      const currentPosition = await Location.getCurrentPositionAsync({});
      updateFormLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
    } catch (error) {
      if (!silent) {
        Alert.alert(
          'Localizacao indisponivel',
          'Nao foi possivel obter sua localizacao atual.',
        );
      }
    } finally {
      setIsLocatingForm(false);
    }
  }

  async function saveTask() {
    const titulo = form.titulo.trim();
    const descricao = form.descricao.trim();
    const latitude = form.latitude.trim();
    const longitude = form.longitude.trim();
    const nomeLocal = form.nome_local.trim();

    if (!titulo) {
      Alert.alert('Titulo obrigatorio', 'Informe um titulo para a tarefa.');
      return;
    }

    if ((latitude || longitude) && !hasValidCoordinates(latitude, longitude)) {
      Alert.alert(
        'Localizacao invalida',
        'Escolha um ponto valido no mapa antes de salvar.',
      );
      return;
    }

    setIsSaving(true);

    const payload = {
      descricao: descricao || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      nome_local: nomeLocal || null,
      prioridade: form.prioridade,
      titulo,
    };

    const response = editingTask
      ? await supabase
          .from('tasks')
          .update(payload)
          .eq('id', editingTask.id)
          .select(
            'id, titulo, descricao, prioridade, concluida, latitude, longitude, nome_local, created_at',
          )
          .single()
      : await supabase
          .from('tasks')
          .insert({ ...payload, user_id: user.id })
          .select(
            'id, titulo, descricao, prioridade, concluida, latitude, longitude, nome_local, created_at',
          )
          .single();

    setIsSaving(false);

    if (response.error) {
      Alert.alert('Erro ao salvar', formatError(response.error));
      return;
    }

    setTasks((currentTasks) => {
      if (editingTask) {
        return currentTasks.map((task) =>
          task.id === response.data.id ? response.data : task,
        );
      }

      return [response.data, ...currentTasks];
    });
    closeForm();
  }

  async function toggleTask(task) {
    const nextValue = !task.concluida;
    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === task.id ? { ...item, concluida: nextValue } : item,
      ),
    );

    const { error } = await supabase
      .from('tasks')
      .update({ concluida: nextValue })
      .eq('id', task.id);

    if (error) {
      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id ? { ...item, concluida: task.concluida } : item,
        ),
      );
      Alert.alert('Erro ao atualizar', formatError(error));
    }
  }

  function confirmDelete(task) {
    Alert.alert(
      'Excluir tarefa',
      'Esta acao nao pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          onPress: () => deleteTask(task),
          style: 'destructive',
          text: 'Excluir',
        },
      ],
    );
  }

  async function deleteTask(task) {
    const previousTasks = tasks;
    setTasks((currentTasks) => currentTasks.filter((item) => item.id !== task.id));

    const { error } = await supabase.from('tasks').delete().eq('id', task.id);

    if (error) {
      setTasks(previousTasks);
      Alert.alert('Erro ao excluir', formatError(error));
    }
  }

  function renderTask({ item }) {
    const priority = getPriorityMeta(item.prioridade);

    return (
      <View style={[styles.taskCard, item.concluida && styles.completedCard]}>
        <Pressable
          accessibilityLabel={
            item.concluida
              ? 'Marcar tarefa como aberta'
              : 'Marcar tarefa como concluida'
          }
          onPress={() => toggleTask(item)}
          style={[
            styles.checkButton,
            item.concluida && styles.checkButtonDone,
          ]}
        >
          <MaterialCommunityIcons
            color={item.concluida ? '#FFFFFF' : colors.primary}
            name={item.concluida ? 'check' : 'circle-outline'}
            size={20}
          />
        </Pressable>

        <View style={styles.taskBody}>
          <View style={styles.taskTitleRow}>
            <Text
              numberOfLines={2}
              style={[styles.taskTitle, item.concluida && styles.completedText]}
            >
              {item.titulo}
            </Text>
            <View style={[styles.priorityPill, { borderColor: priority.color }]}>
              <Text style={[styles.priorityPillText, { color: priority.color }]}>
                {priority.label}
              </Text>
            </View>
          </View>

          {item.descricao ? (
            <Text
              numberOfLines={3}
              style={[
                styles.taskDescription,
                item.concluida && styles.completedText,
              ]}
            >
              {item.descricao}
            </Text>
          ) : null}

          {item.nome_local ? (
            <Text numberOfLines={1} style={styles.locationText}>
              {item.nome_local}
            </Text>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              accessibilityLabel="Editar tarefa"
              onPress={() => openEditForm(item)}
              style={styles.iconAction}
            >
              <MaterialCommunityIcons
                color={colors.primaryDark}
                name="pencil-outline"
                size={20}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Excluir tarefa"
              onPress={() => confirmDelete(item)}
              style={styles.iconAction}
            >
              <MaterialCommunityIcons
                color={colors.danger}
                name="trash-can-outline"
                size={20}
              />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ROTINAAPP</Text>
          <Text style={styles.title}>Minhas tarefas</Text>
        </View>
        <Pressable
          accessibilityLabel="Recarregar tarefas"
          onPress={() => loadTasks()}
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            color={colors.primaryDark}
            name="refresh"
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterGroup}>
            {STATUS_FILTERS.map((filter) => (
              <Pressable
                key={filter.value}
                onPress={() => setStatusFilter(filter.value)}
                style={[
                  styles.filterChip,
                  statusFilter === filter.value && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === filter.value && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterGroup}>
            {PRIORITY_FILTERS.map((filter) => (
              <Pressable
                key={filter.value}
                onPress={() => setPriorityFilter(filter.value)}
                style={[
                  styles.filterChip,
                  priorityFilter === filter.value && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    priorityFilter === filter.value && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
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
          <Text style={styles.loadingText}>Carregando tarefas...</Text>
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
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 104 + Math.max(insets.bottom, 10) },
            filteredTasks.length === 0 && styles.emptyListContent,
          ]}
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons
                  color={colors.primary}
                  name="clipboard-text-outline"
                  size={44}
                />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma tarefa por aqui</Text>
              <Text style={styles.emptyText}>
                Crie uma tarefa ou ajuste os filtros para ver outros itens.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => loadTasks({ refreshing: true })}
              refreshing={isRefreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={renderTask}
        />
      )}

      <Pressable
        accessibilityLabel="Adicionar tarefa"
        onPress={openCreateForm}
        style={[styles.fab, { bottom: 28 + Math.max(insets.bottom, 10) }]}
      >
        <MaterialCommunityIcons color="#FFFFFF" name="plus" size={28} />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={closeForm}
        transparent
        visible={isFormVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.formSheet}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingTask ? 'Editar tarefa' : 'Nova tarefa'}
              </Text>
              <Pressable
                accessibilityLabel="Fechar formulario"
                onPress={closeForm}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  color={colors.muted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>

            <Text style={styles.label}>Titulo</Text>
            <TextInput
              onChangeText={(titulo) =>
                setForm((current) => ({ ...current, titulo }))
              }
              placeholder="Ex.: Estudar Supabase"
              placeholderTextColor="#A4AEC0"
              style={styles.input}
              value={form.titulo}
            />

            <Text style={styles.label}>Descricao</Text>
            <TextInput
              multiline
              onChangeText={(descricao) =>
                setForm((current) => ({ ...current, descricao }))
              }
              placeholder="Detalhes da tarefa"
              placeholderTextColor="#A4AEC0"
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={form.descricao}
            />

            <Text style={styles.label}>Local</Text>
            <TextInput
              onChangeText={(nome_local) =>
                setForm((current) => ({ ...current, nome_local }))
              }
              placeholder="Ex.: Biblioteca"
              placeholderTextColor="#A4AEC0"
              style={styles.input}
              value={form.nome_local}
            />

            <View style={styles.mapPickerHeader}>
              <Text style={styles.label}>Ponto no mapa</Text>
              <Pressable
                disabled={isLocatingForm}
                onPress={() => centerFormOnCurrentLocation()}
                style={styles.locationButton}
              >
                {isLocatingForm ? (
                  <ActivityIndicator color={colors.primaryDark} size="small" />
                ) : (
                  <MaterialCommunityIcons
                    color={colors.primaryDark}
                    name="crosshairs-gps"
                    size={18}
                  />
                )}
                <Text style={styles.locationButtonText}>Usar minha localizacao</Text>
              </Pressable>
            </View>

            <View style={styles.mapPicker}>
              <MapView
                key={editingTask?.id || 'new-task-map'}
                ref={formMapRef}
                initialRegion={formMapRegion}
                onPress={(event) => updateFormLocation(event.nativeEvent.coordinate)}
                style={styles.formMap}
              >
                <Marker
                  coordinate={{
                    latitude: formMapRegion.latitude,
                    longitude: formMapRegion.longitude,
                  }}
                  draggable
                  onDragEnd={(event) =>
                    updateFormLocation(event.nativeEvent.coordinate)
                  }
                  pinColor={colors.primary}
                  title="Local da tarefa"
                />
              </MapView>
            </View>

            <Text style={styles.coordinateText}>
              {hasValidCoordinates(form.latitude, form.longitude)
                ? `${Number(form.latitude).toFixed(6)}, ${Number(form.longitude).toFixed(6)}`
                : 'Toque no mapa ou use sua localizacao atual.'}
            </Text>

            <Text style={styles.label}>Prioridade</Text>
            <View style={styles.prioritySelector}>
              {PRIORITIES.map((priority) => (
                <Pressable
                  key={priority.value}
                  onPress={() =>
                    setForm((current) => ({
                      ...current,
                      prioridade: priority.value,
                    }))
                  }
                  style={[
                    styles.priorityOption,
                    form.prioridade === priority.value && {
                      backgroundColor: priority.color,
                      borderColor: priority.color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      form.prioridade === priority.value &&
                        styles.priorityActiveText,
                    ]}
                  >
                    {priority.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={isSaving}
              onPress={saveTask}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                isSaving && styles.disabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar tarefa</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
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
  filters: {
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  taskCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  completedCard: {
    opacity: 0.72,
  },
  checkButton: {
    alignItems: 'center',
    borderColor: '#BBD7F1',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  checkButtonDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  taskTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  priorityPill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  taskDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  locationText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  iconAction: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4FF',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
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
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 29,
    bottom: 22,
    elevation: 5,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: 22,
    shadowColor: '#183B5B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    width: 58,
  },
  modalOverlay: {
    backgroundColor: 'rgba(23, 32, 51, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  mapPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 11,
  },
  locationButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  locationButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  mapPicker: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 190,
    overflow: 'hidden',
  },
  formMap: {
    height: '100%',
    width: '100%',
  },
  coordinateText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 7,
  },
  formHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  formTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
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
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 11,
  },
  input: {
    backgroundColor: '#F8FAFD',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 94,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  priorityOptionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  priorityActiveText: {
    color: '#FFFFFF',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.65,
  },
});
