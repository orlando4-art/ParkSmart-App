# 🅿️ ParkSmart — Sistema de Gestión de Estacionamiento

Aplicación móvil desarrollada con React Native y Expo para la gestión 
automatizada de estacionamientos vehiculares.

## 📱 Descripción

ParkSmart permite registrar entradas y salidas de vehículos en tiempo real,
calcular tarifas automáticamente, gestionar múltiples estacionamientos y 
administrar operadores desde un panel de control móvil.

## ✨ Funcionalidades principales

- Registro de entrada por voz o teclado personalizado
- Detección automática de tipo de vehículo (auto/moto)
- Cálculo proporcional de tarifas por minuto
- Generación de tickets en PDF
- Exportación de historial en CSV
- Autenticación biométrica (huella / Face ID)
- Sincronización en tiempo real con Firebase
- Funcionamiento offline con SQLite
- Geolocalización de estacionamientos cercanos
- Panel de reportes e ingresos

## 🛠️ Tecnologías utilizadas

| Tecnología | Versión | Uso |
|---|---|---|
| React Native | 0.81.5 | Framework móvil |
| Expo SDK | 54 | APIs nativas |
| Expo Router | 6 | Navegación |
| Firebase Auth | 12 | Autenticación |
| Firebase Firestore | 11 | Base de datos en la nube |
| expo-sqlite | 16 | Base de datos local |
| expo-speech-recognition | 0.1 | Reconocimiento de voz |
| expo-camera | 17 | Captura de placas |
| expo-local-authentication | 17 | Biometría |
| EAS Build | 12 | Compilación APK |

## 🚀 Instrucciones de instalación y ejecución

### Requisitos previos
- Node.js 18 o superior
- npm o yarn
- Expo CLI instalado globalmente
- Cuenta en Firebase (gratuita)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/orlando4-art/ParkSmart-App.git

# Entrar al directorio
cd ParkSmart

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npx expo start --go
```

### Generar APK

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login en Expo
eas login

# Generar APK
eas build -p android --profile preview
```

## 📦 Archivo de distribución

El APK de distribución interna está disponible en:
[Descargar APK - ParkSmart v1.0.0](https://expo.dev/accounts/orlando10/projects/estacionamiento/builds/48ab23ea-5e12-4f21-921a-bf29a5c20314)

## 📁 Estructura del proyecto