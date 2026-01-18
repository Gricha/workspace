import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkspaceDetailScreen } from '../screens/WorkspaceDetailScreen';
import { TerminalScreen } from '../screens/TerminalScreen';
import {
  SettingsScreen,
  ConnectionSettingsScreen,
  ThemeSettingsScreen,
  AgentsSettingsScreen,
  GitHubSettingsScreen,
  EnvironmentSettingsScreen,
  FilesSettingsScreen,
  ScriptsSettingsScreen,
  SyncSettingsScreen,
  AboutSettingsScreen,
} from '../screens/SettingsScreen';
import { SkillsScreen } from '../screens/SkillsScreen';
import { McpServersScreen } from '../screens/McpServersScreen';
import { WorkspaceSettingsScreen } from '../screens/WorkspaceSettingsScreen';

const Stack = createNativeStackNavigator();

export function TabNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsConnection" component={ConnectionSettingsScreen} />
      <Stack.Screen name="SettingsTheme" component={ThemeSettingsScreen} />
      <Stack.Screen name="SettingsAgents" component={AgentsSettingsScreen} />
      <Stack.Screen name="SettingsGitHub" component={GitHubSettingsScreen} />
      <Stack.Screen name="SettingsEnvironment" component={EnvironmentSettingsScreen} />
      <Stack.Screen name="SettingsFiles" component={FilesSettingsScreen} />
      <Stack.Screen name="SettingsScripts" component={ScriptsSettingsScreen} />
      <Stack.Screen name="SettingsSync" component={SyncSettingsScreen} />
      <Stack.Screen name="SettingsAbout" component={AboutSettingsScreen} />
      <Stack.Screen name="Skills" component={SkillsScreen} />
      <Stack.Screen name="Mcp" component={McpServersScreen} />
      <Stack.Screen name="WorkspaceDetail" component={WorkspaceDetailScreen} />
      <Stack.Screen name="WorkspaceSettings" component={WorkspaceSettingsScreen} />
      <Stack.Screen name="Terminal" component={TerminalScreen} />
    </Stack.Navigator>
  );
}
