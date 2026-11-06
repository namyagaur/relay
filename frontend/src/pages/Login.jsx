import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import CopyButton from '@/components/shared/CopyButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { request } from '@/services/api/client';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { authenticate, authError: savedSessionError } = useAuth();
  const [mode, setMode] = useState('access');
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');
  const [createdProject, setCreatedProject] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAccess = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authenticate(apiKey);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await request('/projects', {
        method: 'POST',
        body: { name: projectName.trim() },
        authenticated: false,
      });
      setCreatedProject({ name: result.project.name, apiKey: result.apiKey });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const continueToDashboard = async () => {
    setError('');
    setLoading(true);
    try {
      await authenticate(createdProject.apiKey);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  if (createdProject) {
    return (
      <AuthLayout
        title="Project created"
        subtitle="Copy this API key now. Relay will not show it again."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{createdProject.name}</p>
              <CopyButton value={createdProject.apiKey} label="Copy key" />
            </div>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{createdProject.apiKey}</p>
          </div>
          <div className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs leading-5 text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Store this key securely. It grants access to this project.
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="h-11 w-full" onClick={continueToDashboard} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue to dashboard
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const creating = mode === 'create';
  return (
    <AuthLayout
      title={creating ? 'Create a Relay project' : 'Access Relay'}
      subtitle={creating ? 'Create a project and its first API key.' : 'Enter a project-scoped API key to continue.'}
      footer={
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setMode(creating ? 'access' : 'create');
              setError('');
            }}
          >
            {creating ? 'Already have an API key? Sign in' : 'New to Relay? Create a project'}
          </button>
          <Link to="/about" className="font-medium text-primary hover:underline">
            Know More about Relay
          </Link>
        </div>
      }
    >
      {(savedSessionError || error) && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error || savedSessionError}
        </div>
      )}

      {creating ? (
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Acme Production"
              autoComplete="organization"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading || !projectName.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create project
          </Button>
        </form>
      ) : (
        <form onSubmit={handleAccess} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Relay API key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="relay_…"
              autoComplete="off"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading || !apiKey.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Access dashboard
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
