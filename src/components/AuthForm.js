import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function translateAuthError(error) {
  const knownErrors = {
    email_address_invalid:
      'Este e-mail foi recusado pelo Supabase. Use um e-mail real, como Gmail ou Outlook.',
    email_not_confirmed:
      'Confirme seu e-mail antes de entrar. Verifique tambem a caixa de spam.',
    invalid_credentials:
      'E-mail ou senha incorretos. Se voce acabou de criar a conta, confirme o e-mail recebido.',
    user_already_exists:
      'Ja existe uma conta com este e-mail. Use a senha cadastrada anteriormente.',
    weak_password: 'A senha nao atende aos requisitos de seguranca.',
  };

  return (
    knownErrors[error?.code] ||
    knownErrors[error?.message] ||
    error?.message ||
    'Nao foi possivel continuar.'
  );
}

export function AuthForm({ mode, navigation }) {
  const isLogin = mode === 'login';
  const { isConfigured, signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError('Informe um endereco de e-mail valido.');
      return false;
    }

    if (password.length < 6) {
      setFormError('Use pelo menos 6 caracteres na senha.');
      return false;
    }

    if (!isLogin && password !== confirmPassword) {
      setFormError('As senhas nao coincidem.');
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    setFormError('');

    if (!validate()) {
      return;
    }

    if (!isConfigured) {
      setFormError('Supabase nao configurado. Confira o arquivo .env.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    setIsSubmitting(false);

    if (error) {
      setFormError(translateAuthError(error));
      return;
    }

    if (!isLogin && data.user?.identities?.length === 0) {
      Alert.alert(
        'Conta ja existente',
        'Este e-mail ja foi cadastrado. A senha anterior continua valida; um novo cadastro nao altera a senha.',
        [{ text: 'Voltar ao login', onPress: () => navigation.navigate('Login') }],
      );
      return;
    }

    if (!isLogin && !data.session) {
      Alert.alert(
        'Conta criada',
        'Confira sua caixa de entrada e confirme o e-mail antes de entrar. Verifique tambem a caixa de spam.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
      );
    }
  }

  function updateEmail(value) {
    setEmail(value);
    setFormError('');
  }

  function updatePassword(value) {
    setPassword(value);
    setFormError('');
  }

  function updateConfirmPassword(value) {
    setConfirmPassword(value);
    setFormError('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, !isLogin && styles.signUpCard]}>
            <Image
              resizeMode="contain"
              source={require('../../assets/rotina-login-icon.png')}
              style={styles.logo}
            />

            <Text style={styles.appName}>RotinaApp</Text>

            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={updateEmail}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                onChangeText={updatePassword}
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {!isLogin ? (
              <View style={styles.field}>
                <Text style={styles.label}>Confirmar senha</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={updateConfirmPassword}
                  secureTextEntry
                  style={styles.input}
                  value={confirmPassword}
                />
              </View>
            ) : null}

            <Pressable
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? 'Entrar' : 'Cadastrar'}
                </Text>
              )}
            </Pressable>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <Text style={styles.orText}>ou</Text>

            <Pressable
              disabled={isSubmitting}
              onPress={() => navigation.navigate(isLogin ? 'Cadastro' : 'Login')}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>
                {isLogin ? 'Criar uma conta' : 'Voltar para o login'}
              </Text>
            </Pressable>

            {!isConfigured ? (
              <Text style={styles.configNotice}>Supabase nao configurado</Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#000000',
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxWidth: 360,
    minHeight: 430,
    padding: 24,
    width: '100%',
  },
  signUpCard: {
    minHeight: 490,
  },
  logo: {
    height: 68,
    width: 68,
  },
  appName: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '400',
    marginBottom: 24,
    marginTop: 8,
  },
  field: {
    marginBottom: 14,
    width: '100%',
  },
  label: {
    color: '#7C8799',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F7F7F7',
    borderColor: '#B8B8B8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111111',
    fontSize: 15,
    height: 44,
    paddingHorizontal: 12,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#438FD8',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
  },
  buttonPressed: {
    backgroundColor: '#2878C3',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#C53D4D',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
  orText: {
    color: '#B9B9B9',
    fontSize: 12,
    marginTop: 14,
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  linkText: {
    color: '#438FD8',
    fontSize: 13,
  },
  configNotice: {
    color: '#C53D4D',
    fontSize: 11,
    marginTop: 6,
  },
});
