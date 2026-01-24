import { useState } from 'react';
import { Key, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setToken, clearToken } from '@/lib/api';

interface AuthProps {
  onAuthenticated: () => void;
}

export function Auth({ onAuthenticated }: AuthProps) {
  const [token, setTokenValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError('');

    setToken(token.trim());

    try {
      const response = await fetch('/rpc/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        onAuthenticated();
      } else if (response.status === 401) {
        setError('Invalid token');
        clearToken();
      } else {
        setError('Connection failed. Please check the agent is running.');
      }
    } catch {
      setError('Connection failed. Please check the agent is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
          <p className="text-muted-foreground">
            This Perry agent requires a token to access. Enter the token configured on the agent.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={token}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="perry-..."
                className="pl-10 font-mono"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Continue'}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Where do I find the token?</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              Run <code className="bg-muted px-1 rounded">perry agent config</code> on the agent
            </li>
            <li>
              Or check <code className="bg-muted px-1 rounded">~/.config/perry/config.json</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
