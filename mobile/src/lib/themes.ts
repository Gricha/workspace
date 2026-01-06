export type ThemeId = 'default' | 'obsidian' | 'concrete' | 'phosphor' | 'blossom' | 'ember' | 'slate'

export interface ThemePreview {
  bg: string
  fg: string
  accent: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  preview: ThemePreview
}

export interface ThemeColors {
  background: string
  surface: string
  surfaceSecondary: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentText: string
  border: string
  success: string
  error: string
  warning: string
}

export const themeDefinitions: ThemeDefinition[] = [
  {
    id: 'default',
    name: 'Command',
    description: 'Deep slate with cyan accents',
    preview: { bg: '#0f1318', fg: '#e8ecf0', accent: '#22c5d6' },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Purple/violet dark theme',
    preview: { bg: '#0d0a14', fg: '#ebe9ed', accent: '#a855f7' },
  },
  {
    id: 'concrete',
    name: 'Concrete',
    description: 'Brutalist light with sharp edges',
    preview: { bg: '#f5f5f5', fg: '#141414', accent: '#141414' },
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    description: 'Terminal hacker green on black',
    preview: { bg: '#080d08', fg: '#80ff80', accent: '#00ff00' },
  },
  {
    id: 'blossom',
    name: 'Blossom',
    description: 'Soft pastel pink/rose',
    preview: { bg: '#fdf6f7', fg: '#3d2c2f', accent: '#ec4899' },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm cozy with orange/amber',
    preview: { bg: '#151110', fg: '#efe5db', accent: '#f97316' },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Corporate minimal light',
    preview: { bg: '#f8fafc', fg: '#1e293b', accent: '#3b82f6' },
  },
]

export const themeColors: Record<ThemeId, ThemeColors> = {
  default: {
    background: '#000000',
    surface: '#1c1c1e',
    surfaceSecondary: '#2c2c2e',
    text: '#ffffff',
    textSecondary: '#e8ecf0',
    textMuted: '#8e8e93',
    accent: '#22c5d6',
    accentText: '#ffffff',
    border: '#1c1c1e',
    success: '#34c759',
    error: '#ff3b30',
    warning: '#ff9f0a',
  },
  obsidian: {
    background: '#0d0a14',
    surface: '#1a1425',
    surfaceSecondary: '#261e35',
    text: '#ebe9ed',
    textSecondary: '#c9c5d0',
    textMuted: '#8b8693',
    accent: '#a855f7',
    accentText: '#ffffff',
    border: '#2d2640',
    success: '#34c759',
    error: '#ff3b30',
    warning: '#ff9f0a',
  },
  concrete: {
    background: '#f5f5f5',
    surface: '#ffffff',
    surfaceSecondary: '#e5e5e5',
    text: '#141414',
    textSecondary: '#333333',
    textMuted: '#666666',
    accent: '#141414',
    accentText: '#ffffff',
    border: '#d4d4d4',
    success: '#22c55e',
    error: '#dc2626',
    warning: '#f59e0b',
  },
  phosphor: {
    background: '#080d08',
    surface: '#0f170f',
    surfaceSecondary: '#162016',
    text: '#80ff80',
    textSecondary: '#60cc60',
    textMuted: '#408040',
    accent: '#00ff00',
    accentText: '#000000',
    border: '#1a2a1a',
    success: '#00ff00',
    error: '#ff4040',
    warning: '#ffff00',
  },
  blossom: {
    background: '#fdf6f7',
    surface: '#ffffff',
    surfaceSecondary: '#fce7ea',
    text: '#3d2c2f',
    textSecondary: '#5c4448',
    textMuted: '#9c7a80',
    accent: '#ec4899',
    accentText: '#ffffff',
    border: '#f5d0d8',
    success: '#22c55e',
    error: '#e11d48',
    warning: '#f59e0b',
  },
  ember: {
    background: '#151110',
    surface: '#1f1a18',
    surfaceSecondary: '#2a2320',
    text: '#efe5db',
    textSecondary: '#d4c8bb',
    textMuted: '#8a7f72',
    accent: '#f97316',
    accentText: '#ffffff',
    border: '#352d28',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#fbbf24',
  },
  slate: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceSecondary: '#f1f5f9',
    text: '#1e293b',
    textSecondary: '#334155',
    textMuted: '#64748b',
    accent: '#3b82f6',
    accentText: '#ffffff',
    border: '#e2e8f0',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
  },
}
