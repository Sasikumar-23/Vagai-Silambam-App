import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutGrid, Users, ClipboardCheck, Calendar,
  MoreHorizontal, IndianRupee, Shirt, User
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StudentsScreen from '../screens/StudentsScreen';
import AddStudentWizardScreen from '../screens/AddStudentWizardScreen';
import StudentProfileScreen from '../screens/StudentProfileScreen';
import TakeAttendanceScreen from '../screens/TakeAttendanceScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import EventsScreen from '../screens/EventsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import FeesScreen from '../screens/FeesScreen';
import CollectPaymentScreen from '../screens/CollectPaymentScreen';
import UniformsScreen from '../screens/UniformsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import CertificatesScreen from '../screens/CertificatesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import MoreScreen from '../screens/MoreScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function RoleAwareBottomTabs() {
  const { t } = useI18n();
  const { currentRole } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      {/* 1. Dashboard */}
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: t.nav.dashboard,
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
        }}
      />

      {/* 2. Students Tab */}
      <Tab.Screen
        name="StudentsTab"
        component={StudentsScreen}
        options={{
          tabBarLabel: t.nav.students,
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />

      {/* 3. Attendance Tab */}
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceHistoryScreen}
        options={{
          tabBarLabel: t.nav.attendance,
          tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} />,
        }}
      />

      {/* 4. Events Tab */}
      <Tab.Screen
        name="EventsTab"
        component={EventsScreen}
        options={{
          tabBarLabel: t.nav.events,
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />

      {/* 5. More Tab */}
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          tabBarLabel: t.nav.more,
          tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { currentUser } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={currentUser ? 'MainTabs' : 'Login'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainTabs" component={RoleAwareBottomTabs} />

      {/* Core Sub-screens */}
      <Stack.Screen name="AddStudent" component={AddStudentWizardScreen} />
      <Stack.Screen name="StudentDetail" component={StudentProfileScreen} />
      <Stack.Screen name="TakeAttendance" component={TakeAttendanceScreen} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="Fees" component={FeesScreen} />
      <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} />
      <Stack.Screen name="Uniforms" component={UniformsScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Certificates" component={CertificatesScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
