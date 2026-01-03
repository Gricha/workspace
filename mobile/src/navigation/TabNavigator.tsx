import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet } from 'react-native'
import { WorkspacesScreen } from '../screens/WorkspacesScreen'
import { SessionsScreen } from '../screens/SessionsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'

const Tab = createBottomTabNavigator()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Workspaces: '[]',
    Sessions: '<>',
    Settings: '*',
  }
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{icons[name] || '?'}</Text>
    </View>
  )
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#0a84ff',
        tabBarInactiveTintColor: '#8e8e93',
        headerStyle: {
          backgroundColor: '#000',
          borderBottomWidth: 1,
          borderBottomColor: '#1c1c1e',
        },
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#1c1c1e',
        },
      })}
    >
      <Tab.Screen name="Workspaces" component={WorkspacesScreen} />
      <Tab.Screen name="Sessions" component={SessionsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#8e8e93',
  },
  iconFocused: {
    color: '#0a84ff',
  },
})
