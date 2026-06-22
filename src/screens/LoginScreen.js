import { AuthForm } from '../components/AuthForm';

export function LoginScreen({ navigation }) {
  return <AuthForm mode="login" navigation={navigation} />;
}
