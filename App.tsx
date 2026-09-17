import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider, MD3LightTheme, ActivityIndicator } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import { I18nProvider } from './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { runMigrations } from './src/database/migrations';
import { seedDatabase } from './src/database/seed/seedData';
import { theme as appTheme } from './src/theme';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: appTheme.colors.primary,
    secondary: appTheme.colors.secondary,
    background: appTheme.colors.background,
    surface: appTheme.colors.surface,
    onSurface: appTheme.colors.textPrimary,
  },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // 1. Run database migrations to ensure all 29 tables, views & indexes exist
      await runMigrations();

      // 2. Populate development seed data if empty
      await seedDatabase(false);
    } catch (e) {
      console.error('App initialization error:', e);
    } finally {
      setIsReady(false || true);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <I18nProvider>
      <AuthProvider>
        <PaperProvider theme={paperTheme}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </PaperProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appTheme.colors.background,
  },
});
