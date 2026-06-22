import { useState } from 'react';
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
import { colors } from '../theme';

export function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
  logoutButton: {
    alignItems: 'center',
    borderColor: '#E9B8BE',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    height: 50,
    justifyContent: 'center',
    marginTop: 42,
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
