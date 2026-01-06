const CONNECTION_RELATED_PROPS = [
  'onSessionId',
  'onConnectionChange',
  'onConnect',
  'onDisconnect',
  'onOpen',
  'onClose',
  'onMessage',
  'onError',
  'onReconnect',
]

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn against passing inline functions to connection-related callback props which can cause WebSocket reconnection loops',
      recommended: false,
    },
    messages: {
      unstableCallback: 'Avoid passing inline functions to "{{prop}}" prop. This callback is likely used in a useCallback/useEffect dependency array and will cause reconnection loops. Wrap it in useCallback() instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalProps: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {}
    const additionalProps = options.additionalProps || []
    const targetProps = new Set([...CONNECTION_RELATED_PROPS, ...additionalProps])

    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return

        const propName = node.name.name
        if (!targetProps.has(propName)) return

        if (!node.value || node.value.type !== 'JSXExpressionContainer') return

        const expression = node.value.expression

        if (expression.type === 'ArrowFunctionExpression' || expression.type === 'FunctionExpression') {
          context.report({
            node: expression,
            messageId: 'unstableCallback',
            data: { prop: propName },
          })
        }
      },
    }
  },
}
