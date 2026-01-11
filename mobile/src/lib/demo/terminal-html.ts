export const DEMO_TERMINAL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #0d1117;
      color: #c9d1d9;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      overflow: hidden;
    }

    #wrap {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    #output {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      white-space: pre-wrap;
      line-height: 1.4;
    }

    #inputLine {
      padding: 0 12px 12px 12px;
      display: flex;
      gap: 8px;
      align-items: baseline;
    }

    #prompt {
      color: #8b949e;
      user-select: none;
      flex: none;
    }

    #current {
      flex: 1;
      min-height: 1.4em;
      outline: none;
      white-space: pre-wrap;
      word-break: break-word;
    }

    #hiddenInput {
      position: absolute;
      left: -9999px;
      top: -9999px;
      opacity: 0;
    }

    .dim { color: #8b949e; }
  </style>
</head>
<body>
  <div id="wrap">
    <div id="output"></div>
    <div id="inputLine">
      <div id="prompt"></div>
      <div id="current"></div>
    </div>
  </div>
  <input id="hiddenInput" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" />

  <script>
    const output = document.getElementById('output');
    const promptEl = document.getElementById('prompt');
    const currentEl = document.getElementById('current');
    const hiddenInput = document.getElementById('hiddenInput');

    let ctrlActive = false;
    let cwd = '/home/demo/demo-project';
    let line = '';

    const nl = String.fromCharCode(10);

    const files = {
      '/home/demo/demo-project/README.md': ['# Demo Project', 'This is a sample project for demonstration.', ''].join(nl),
      '/home/demo/demo-project/package.json': ['{', '  "name": "demo-project",', '  "private": true', '}', ''].join(nl),
      '/home/demo/demo-project/src/index.ts': [
        'export function main() {',
        "  console.log('Hello from demo');",
        '}',
        '',
      ].join(nl),
      '/home/demo/demo-project/src/utils.ts': ['export const add = (a: number, b: number) => a + b', ''].join(nl),
      '/home/demo/demo-project/src/config.ts': ['export const config = { name: "demo" }', ''].join(nl),
    };

    const dirEntries = {
      '/home/demo/demo-project': ['README.md', 'package.json', 'src/', 'node_modules/'],
      '/home/demo/demo-project/src': ['index.ts', 'utils.ts', 'config.ts'],
      '/home/demo': ['demo-project/'],
    };

    function post(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function scrollToBottom() {
      output.scrollTop = output.scrollHeight;
    }

    function renderPrompt() {
      const short = cwd.replace('/home/demo', '~');
      promptEl.textContent = short + ' $';
      currentEl.textContent = line;
    }

    function print(text, cls) {
      const div = document.createElement('div');
      if (cls) div.className = cls;
      div.textContent = text;
      output.appendChild(div);
      scrollToBottom();
    }

    function println(text = '') {
      print(text);
    }

    function normalizePath(path) {
      if (!path) return cwd;
      if (path.startsWith('~')) return '/home/demo' + path.slice(1);
      if (path.startsWith('/')) return path;
      if (cwd.endsWith('/')) return cwd + path;
      return cwd + '/' + path;
    }

    function stripTrailingSlash(value) {
      return typeof value === 'string' && value.endsWith('/') ? value.slice(0, -1) : value;
    }

    function setCwd(next) {
      cwd = stripTrailingSlash(next);
      renderPrompt();
    }

    function runCommand(input) {
      const trimmed = input.trim();
      if (!trimmed) return;

      const [cmd, ...args] = trimmed.split(/ +/).filter(Boolean);

      if (cmd === 'help') {
        println('Available commands: ls, pwd, cd, cat, echo, git status, node --version, help');
        return;
      }

      if (cmd === 'ls') {
        const target = args[0] ? stripTrailingSlash(normalizePath(args[0])) : cwd;
        const entries = dirEntries[target];
        if (!entries) {
          println('ls: cannot access: No such file or directory');
          return;
        }
        println(entries.join('  '));
        return;
      }

      if (cmd === 'pwd') {
        println(cwd);
        return;
      }

      if (cmd === 'cd') {
        const target = args[0] ? stripTrailingSlash(normalizePath(args[0])) : '/home/demo';
        if (!dirEntries[target]) {
          println('cd: no such file or directory: ' + (args[0] || ''));
          return;
        }
        setCwd(target);
        return;
      }

      if (cmd === 'cat') {
        if (!args[0]) {
          println('cat: missing file operand');
          return;
        }
        const path = stripTrailingSlash(normalizePath(args[0]));
        const content = files[path];
        if (content == null) {
          println('cat: ' + args[0] + ': No such file or directory');
          return;
        }
        println(content.endsWith(nl) ? content.slice(0, -1) : content);
        return;
      }

      if (cmd === 'echo') {
        println(args.join(' '));
        return;
      }

      if (cmd === 'node' && args[0] === '--version') {
        println('v20.10.0');
        return;
      }

      if (cmd === 'git' && args[0] === 'status') {
        println('On branch main');
        println('nothing to commit, working tree clean');
        return;
      }

      println('demo: command not available in demo mode');
    }

    function commitLine() {
      const entered = line;
      println(promptEl.textContent + ' ' + entered);
      line = '';
      renderPrompt();
      runCommand(entered);
    }

    function isChar(seq, code) {
      return typeof seq === 'string' && seq.length === 1 && seq.charCodeAt(0) === code;
    }

    function applyKeySequence(seq) {
      if (isChar(seq, 13) || isChar(seq, 10)) {
        commitLine();
        return;
      }

      if (isChar(seq, 3)) {
        // Ctrl+C
        println('^C');
        line = '';
        renderPrompt();
        return;
      }

      if (isChar(seq, 8) || isChar(seq, 127)) {
        line = line.slice(0, -1);
        renderPrompt();
        return;
      }

      if (seq && seq.length > 0) {
        line += seq;
        renderPrompt();
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitLine();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        line = line.slice(0, -1);
        renderPrompt();
        return;
      }

      if (e.key === 'c' && (e.ctrlKey || ctrlActive)) {
        e.preventDefault();
        applyKeySequence(String.fromCharCode(3));
        return;
      }

      if (e.key.length === 1 && !e.metaKey && !e.altKey) {
        e.preventDefault();
        line += e.key;
        renderPrompt();
      }
    }

    function focusInput() {
      hiddenInput.focus();
    }

    window.setCtrlActive = (active) => {
      ctrlActive = !!active;
    };

    window.initTerminal = () => {
      print('Perry demo terminal', 'dim');
      print('Type "help" for commands.', 'dim');
      renderPrompt();
      focusInput();
      post({ type: 'connected' });
    };

    function handleIncomingMessage(data) {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'sendKey') {
          applyKeySequence(msg.key);
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', (event) => handleIncomingMessage(event.data));
    document.addEventListener('message', (event) => handleIncomingMessage(event.data));

    hiddenInput.addEventListener('keydown', handleKeyDown);
    document.body.addEventListener('touchstart', focusInput, { passive: true });
  </script>
</body>
</html>`
