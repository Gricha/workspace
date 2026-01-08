/**
 * Custom Oxlint plugin to detect duplicate method/function names across the project.
 * This helps catch cases where the same method name is defined in multiple places,
 * which can lead to confusion and maintenance issues.
 *
 * Excludes:
 * - Common lifecycle/utility methods (constructor, render, toString, etc.)
 * - Protected/private methods in classes (intended for override patterns)
 * - Very common local names (cleanup, handleSignal, etc.)
 */

const seenMethods = new Map()

// Methods that are commonly overridden or have standard meanings
const SKIP_NAMES = new Set([
  // Lifecycle methods
  'constructor',
  'render',
  'componentDidMount',
  'componentWillUnmount',
  'componentDidUpdate',
  // Object protocol
  'toString',
  'valueOf',
  'toJSON',
  // Common override patterns in class hierarchies
  'getLogPrefix',
  'getSpawnConfig',
  'getNoOutputErrorMessage',
  'createConnection',
  'createHostSession',
  'createContainerSession',
  // Common local utility names (not worth flagging)
  'cleanup',
  'handleSignal',
  'safeSend',
  'onMessage',
  'onError',
  'onClose',
  'onOpen',
])

// Minimum name length to avoid flagging very short/generic names
const MIN_NAME_LENGTH = 4

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow duplicate method/function names across the project',
    },
    messages: {
      duplicateMethod: "Method '{{name}}' is also defined in {{locations}}. Consider renaming for clarity.",
    },
  },
  create(context) {
    const filename = context.getFilename()

    // Skip test files - duplicate helpers are common and acceptable
    if (filename.includes('.test.') || filename.includes('__tests__')) {
      return {}
    }

    function shouldSkip(name) {
      if (SKIP_NAMES.has(name)) return true
      if (name.length < MIN_NAME_LENGTH) return true
      // Skip private/protected style names
      if (name.startsWith('_')) return true
      // Skip React hooks
      if (name.startsWith('use') && name[3] === name[3].toUpperCase()) return true
      // Skip event handlers that start with "on" + Capital
      if (name.startsWith('on') && name.length > 2 && name[2] === name[2].toUpperCase()) return true
      // Skip handlers that start with "handle" + Capital
      if (name.startsWith('handle') && name.length > 6 && name[6] === name[6].toUpperCase()) return true
      return false
    }

    function recordMethod(name, node, isClassMethod = false) {
      if (shouldSkip(name)) return

      // Skip protected/private class methods (they're meant to be overridden)
      if (isClassMethod) return

      if (!seenMethods.has(name)) {
        seenMethods.set(name, [])
      }
      const locations = seenMethods.get(name)
      const location = `${filename}:${node.loc.start.line}`

      // Check if already seen in other files
      const otherLocations = locations.filter((loc) => !loc.startsWith(filename))

      if (otherLocations.length > 0) {
        context.report({
          node,
          messageId: 'duplicateMethod',
          data: {
            name,
            locations: otherLocations.join(', '),
          },
        })
      }

      // Record this location
      if (!locations.includes(location)) {
        locations.push(location)
      }
    }

    return {
      // Class methods - skip these as they're often override patterns
      MethodDefinition(node) {
        if (node.key && node.key.name) {
          recordMethod(node.key.name, node, true)
        }
      },

      // Function declarations (top-level or module-level)
      FunctionDeclaration(node) {
        if (node.id && node.id.name) {
          recordMethod(node.id.name, node, false)
        }
      },

      // Exported arrow functions / function expressions
      VariableDeclarator(node) {
        if (
          node.id &&
          node.id.name &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          // Check if this is a top-level export (more likely to be a public API)
          const parent = node.parent
          const isExport =
            parent &&
            parent.parent &&
            (parent.parent.type === 'ExportNamedDeclaration' ||
              parent.parent.type === 'ExportDefaultDeclaration')

          // Only flag exported functions or top-level declarations
          if (isExport) {
            recordMethod(node.id.name, node, false)
          }
        }
      },
    }
  },
}

const plugin = {
  meta: {
    name: 'perry-custom',
    version: '1.0.0',
  },
  rules: {
    'no-duplicate-method-names': rule,
  },
}

export default plugin
