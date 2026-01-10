import type { AgentType } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AgentIconProps {
  agentType: AgentType
  className?: string
  size?: 'sm' | 'md'
  'data-testid'?: string
}

const AGENT_COLORS: Record<AgentType, string> = {
  'claude-code': 'bg-orange-500/10 border-orange-500/20',
  opencode: 'bg-emerald-500/10 border-emerald-500/20',
  codex: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

// Claude's signature sparkle/asterisk icon (official brand element)
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2L13.09 8.26L18 5L14.74 9.91L21 11L14.74 12.09L18 17L13.09 13.74L12 20L10.91 13.74L6 17L9.26 12.09L3 11L9.26 9.91L6 5L10.91 8.26L12 2Z"
        fill="#D97706"
      />
    </svg>
  )
}

// OpenCode logo - simplified "O" mark based on the official pixelated wordmark style
function OpenCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Pixelated "O" shape inspired by OpenCode branding */}
      <rect x="6" y="6" width="4" height="4" fill="#656363" />
      <rect x="10" y="6" width="4" height="4" fill="#656363" />
      <rect x="14" y="6" width="4" height="4" fill="#656363" />
      <rect x="6" y="10" width="4" height="4" fill="#656363" />
      <rect x="14" y="10" width="4" height="4" fill="#656363" />
      <rect x="6" y="14" width="4" height="4" fill="#656363" />
      <rect x="14" y="14" width="4" height="4" fill="#656363" />
      <rect x="10" y="14" width="4" height="4" fill="#656363" />
      {/* Inner highlight */}
      <rect x="10" y="10" width="4" height="4" fill="#CFCECD" />
    </svg>
  )
}

// Codex icon - simple terminal/code style icon
function CodexIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M8 6L3 12L8 18M16 6L21 12L16 18"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AgentIcon({ agentType, className, size = 'sm', 'data-testid': testId }: AgentIconProps) {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const containerClasses = size === 'sm'
    ? 'px-1 py-0.5 rounded'
    : 'px-1.5 py-1 rounded-md'

  const IconComponent = agentType === 'claude-code' 
    ? ClaudeIcon 
    : agentType === 'opencode' 
      ? OpenCodeIcon 
      : CodexIcon

  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center justify-center',
        containerClasses,
        AGENT_COLORS[agentType],
        className
      )}
      data-testid={testId}
    >
      <IconComponent className={sizeClasses} />
    </span>
  )
}
