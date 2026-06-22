import { AuthForm } from '../components/AuthForm';

export function SignUpScreen({ navigation }) {
  return <AuthForm mode="signup" navigation={navigation} />;
}
