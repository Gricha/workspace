import { useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native'

const KEYS = [
  { id: 'esc', label: 'Esc', sequence: '\x1b' },
  { id: 'tab', label: 'Tab', sequence: '\t' },
  { id: 'ctrl', label: 'Ctrl', sequence: '', isModifier: true },
  { id: 'up', label: '↑', sequence: '\x1b[A' },
  { id: 'down', label: '↓', sequence: '\x1b[B' },
  { id: 'left', label: '←', sequence: '\x1b[D' },
  { id: 'right', label: '→', sequence: '\x1b[C' },
]

const CTRL_COMBOS = [
  { id: 'ctrl-c', label: '^C', sequence: '\x03' },
  { id: 'ctrl-d', label: '^D', sequence: '\x04' },
  { id: 'ctrl-z', label: '^Z', sequence: '\x1a' },
  { id: 'ctrl-l', label: '^L', sequence: '\x0c' },
  { id: 'ctrl-a', label: '^A', sequence: '\x01' },
  { id: 'ctrl-r', label: '^R', sequence: '\x12' },
]

interface ExtraKeysBarProps {
  onSendKey: (sequence: string) => void
  ctrlActive: boolean
  onCtrlToggle: (active: boolean) => void
}

export function ExtraKeysBar({ onSendKey, ctrlActive, onCtrlToggle }: ExtraKeysBarProps) {
  const [showCtrlMenu, setShowCtrlMenu] = useState(false)

  const handleKeyPress = useCallback((key: typeof KEYS[0]) => {
    if (key.isModifier) {
      onCtrlToggle(!ctrlActive)
      return
    }

    if (ctrlActive && key.sequence.length === 1) {
      const charCode = key.sequence.charCodeAt(0)
      if (charCode >= 97 && charCode <= 122) {
        onSendKey(String.fromCharCode(charCode - 96))
        onCtrlToggle(false)
        return
      }
      if (charCode >= 65 && charCode <= 90) {
        onSendKey(String.fromCharCode(charCode - 64))
        onCtrlToggle(false)
        return
      }
    }

    onSendKey(key.sequence)
    onCtrlToggle(false)
  }, [ctrlActive, onSendKey, onCtrlToggle])

  const handleCtrlLongPress = useCallback(() => {
    setShowCtrlMenu(true)
  }, [])

  const handleCtrlComboPress = useCallback((combo: typeof CTRL_COMBOS[0]) => {
    onSendKey(combo.sequence)
    setShowCtrlMenu(false)
    onCtrlToggle(false)
  }, [onSendKey, onCtrlToggle])

  return (
    <View style={styles.container}>
      {showCtrlMenu && (
        <View style={styles.ctrlMenu}>
          <Pressable style={styles.menuBackdrop} onPress={() => setShowCtrlMenu(false)} />
          <View style={styles.menuContent}>
            {CTRL_COMBOS.map(combo => (
              <TouchableOpacity
                key={combo.id}
                style={styles.menuKey}
                onPress={() => handleCtrlComboPress(combo)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuKeyText}>{combo.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <View style={styles.bar}>
        {KEYS.map(key => (
          <TouchableOpacity
            key={key.id}
            style={[
              styles.key,
              key.isModifier && ctrlActive && styles.keyActive,
            ]}
            onPress={() => handleKeyPress(key)}
            onLongPress={key.isModifier ? handleCtrlLongPress : undefined}
            delayLongPress={300}
            activeOpacity={0.7}
          >
            <Text style={styles.keyText}>
              {key.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#2c2c2e',
    borderRadius: 6,
    minWidth: 36,
  },
  keyActive: {
    backgroundColor: '#0a84ff',
  },
  keyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  ctrlMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  menuBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -100,
    right: -100,
    bottom: 0,
  },
  menuContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 8,
    marginBottom: 4,
    gap: 8,
  },
  menuKey: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#3c3c3e',
    borderRadius: 6,
  },
  menuKeyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
})
