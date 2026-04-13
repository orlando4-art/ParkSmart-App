import * as LocalAuthentication from 'expo-local-authentication';

export const autenticarUsuario = async () => {
  const compatible = await LocalAuthentication.hasHardwareAsync();

  if (!compatible) {
    return { success: false, error: "No compatible" };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Autenticación",
    fallbackLabel: "Usar contraseña",
  });

  return result.success
    ? { success: true }
    : { success: false, error: "Falló biometría" };
};