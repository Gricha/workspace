import { useRef, useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Animated,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { useQuery } from '@tanstack/react-query'
import { api, getTerminalUrl, HOST_WORKSPACE_NAME } from '../lib/api'
import { ExtraKeysBar } from '../components/ExtraKeysBar'

const TERMINAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0d1117;
    }
    #terminal {
      width: 100%;
      height: 100%;
      padding: 8px;
    }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script type="module">
    import { init, Terminal, FitAddon } from 'https://esm.sh/ghostty-web@0.4.0';

    let term = null;
    let ws = null;
    let fitAddon = null;

    async function connect(wsUrl) {
      await init();

      term = new Terminal({
        cursorBlink: false,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, monospace',
        scrollback: 5000,
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          selectionBackground: '#264f78',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(document.getElementById('terminal'));

      const textarea = document.querySelector('#terminal textarea');
      if (textarea) {
        textarea.setAttribute('autocapitalize', 'off');
        textarea.setAttribute('autocorrect', 'off');
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('spellcheck', 'false');
      }

      requestAnimationFrame(() => {
        fitAddon.fit();
      });

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'connected' }));
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          event.data.text().then(text => term.write(text));
        } else {
          term.write(event.data);
        }
      };

      ws.onclose = (event) => {
        term.writeln('');
        if (event.code === 1000) {
          term.writeln('\\x1b[38;5;245mSession ended\\x1b[0m');
        } else {
          term.writeln('\\x1b[31mDisconnected\\x1b[0m');
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'disconnected' }));
      };

      ws.onerror = () => {
        term.writeln('\\x1b[31mConnection error\\x1b[0m');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
      };

      let ctrlActive = false;

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          if (ctrlActive && data.length === 1) {
            const code = data.charCodeAt(0);
            if (code >= 97 && code <= 122) {
              ws.send(String.fromCharCode(code - 96));
              ctrlActive = false;
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ctrlReleased' }));
              return;
            }
            if (code >= 65 && code <= 90) {
              ws.send(String.fromCharCode(code - 64));
              ctrlActive = false;
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ctrlReleased' }));
              return;
            }
          }
          ws.send(data);
        }
      });

      window.setCtrlActive = (active) => {
        ctrlActive = active;
      };

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });

      term.focus();
    }

    window.addEventListener('resize', () => {
      if (fitAddon) {
        fitAddon.fit();
      }
    });

    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'sendKey' && ws?.readyState === WebSocket.OPEN) {
          ws.send(data.key);
        }
      } catch {}
    }

    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);

    window.initTerminal = connect;
  </script>
</body>
</html>
`;

export function TerminalScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { name } = route.params
  const webViewRef = useRef<WebView>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [ctrlActive, setCtrlActive] = useState(false)
  const keyboardAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height)
      Animated.timing(keyboardAnim, {
        toValue: 1,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setKeyboardHeight(0)
        }
      })
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [keyboardAnim])

  const isHost = name === HOST_WORKSPACE_NAME

  const { data: workspace } = useQuery({
    queryKey: ['workspace', name],
    queryFn: () => api.getWorkspace(name),
    enabled: !isHost,
  })

  const { data: hostInfo } = useQuery({
    queryKey: ['hostInfo'],
    queryFn: api.getHostInfo,
    enabled: isHost,
  })

  const isRunning = isHost ? (hostInfo?.enabled ?? false) : workspace?.status === 'running'

  const sendKey = useCallback((sequence: string) => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'sendKey',
      key: sequence,
    }))
  }, [])

  const handleCtrlToggle = useCallback((active: boolean) => {
    setCtrlActive(active)
    webViewRef.current?.injectJavaScript(`window.setCtrlActive && window.setCtrlActive(${active}); true;`)
  }, [])

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'connected') {
        setConnected(true)
        setLoading(false)
      } else if (data.type === 'disconnected' || data.type === 'error') {
        setConnected(false)
      } else if (data.type === 'ctrlReleased') {
        setCtrlActive(false)
      }
    } catch {
      // Ignore JSON parse errors for non-JSON messages
    }
  }

  const wsUrl = getTerminalUrl(name)

  const injectedJS = `
    if (window.initTerminal) {
      window.initTerminal('${wsUrl}');
    }
    true;
  `

  if (!isRunning) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terminal</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.notRunning}>
          <Text style={styles.notRunningText}>Workspace is not running</Text>
          <Text style={styles.notRunningSubtext}>Start it to access the terminal</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Terminal</Text>
          <View style={[styles.connectionDot, { backgroundColor: connected ? '#34c759' : '#636366' }]} />
        </View>
        <View style={styles.placeholder} />
      </View>

      <Animated.View
        style={[
          styles.terminalContainer,
          {
            paddingBottom: keyboardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [insets.bottom, keyboardHeight + 50],
            }),
          },
        ]}
      >
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0a84ff" />
            <Text style={styles.loadingText}>Loading terminal...</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html: TERMINAL_HTML }}
          style={styles.webview}
          onMessage={handleMessage}
          injectedJavaScript={injectedJS}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          bounces={false}
          keyboardDisplayRequiresUserAction={false}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.extraKeysContainer,
          {
            bottom: keyboardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, keyboardHeight],
            }),
            opacity: keyboardAnim,
          },
        ]}
      >
        <ExtraKeysBar onSendKey={sendKey} ctrlActive={ctrlActive} onCtrlToggle={handleCtrlToggle} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 32,
    color: '#0a84ff',
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeholder: {
    width: 44,
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  extraKeysContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8e8e93',
  },
  notRunning: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notRunningText: {
    fontSize: 17,
    color: '#8e8e93',
    fontWeight: '500',
  },
  notRunningSubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 6,
  },
})
