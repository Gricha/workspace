import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock, Globe, Loader2, Github } from 'lucide-react'
import { api, type GitHubRepo } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RepoSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RepoSelector({ value, onChange, placeholder = 'https://github.com/user/repo' }: RepoSelectorProps) {
  const [mode, setMode] = useState<'github' | 'manual'>('github')
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['githubRepos', debouncedSearch],
    queryFn: () => api.listGitHubRepos(debouncedSearch || undefined, 20),
    staleTime: 60000,
  })

  const isConfigured = data?.configured ?? false
  const repos = data?.repos ?? []

  const handleSelect = (repo: GitHubRepo) => {
    onChange(repo.cloneUrl)
    setIsOpen(false)
    setSearch('')
  }

  const switchToManual = () => {
    setMode('manual')
    setIsOpen(false)
    setSearch('')
  }

  const switchToGithub = () => {
    setMode('github')
    onChange('')
  }

  if (!isConfigured) {
    return (
      <div className="space-y-2">
        <Label>Repository <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div className="space-y-2">
        <Label>Repository <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid="repo-input"
        />
        <button
          type="button"
          onClick={switchToGithub}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <Github className="h-3 w-3" />
          or select from GitHub
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Repository <span className="text-muted-foreground font-normal">(optional)</span></Label>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search your repositories..."
            className="pl-9"
            data-testid="repo-search"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {isOpen && (
          <div
            className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
            data-testid="repo-dropdown"
          >
            <div className="max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : repos.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {search ? 'No repositories found' : 'Start typing to search'}
                </div>
              ) : (
                repos.map((repo) => (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => handleSelect(repo)}
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-3"
                    data-testid="repo-option"
                  >
                    <span className="mt-0.5 text-muted-foreground">
                      {repo.private ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{repo.fullName}</div>
                      {repo.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {repo.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {value && (
          <div className="mt-2 text-sm text-muted-foreground">
            Selected: <span className="font-mono text-foreground">{value}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={switchToManual}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        or type in any repository URL
      </button>
    </div>
  )
}
