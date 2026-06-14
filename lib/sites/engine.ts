import type { SiteStatus } from './types'

// The hosting engine is the thing that actually turns a site into a running
// website (build, run, SSL, routing). We hide it behind this interface so the
// rest of the app never depends on *which* engine we use. Today: a Mock engine
// that simulates success. Later: a CoolifyEngine that calls Coolify's API.

export interface DeployResult {
  status: SiteStatus
  url: string | null
}

export interface HostingEngine {
  provision(input: { slug: string; template: string }): Promise<DeployResult>
  redeploy(slug: string): Promise<DeployResult>
  destroy(slug: string): Promise<void>
}

const BASE_DOMAIN = process.env.SITES_BASE_DOMAIN ?? 'hostingthingy.app'

// Pretends to host a site — returns a live URL immediately. Lets us build and
// demo the entire product before the real infrastructure exists.
class MockEngine implements HostingEngine {
  async provision({ slug }: { slug: string; template: string }): Promise<DeployResult> {
    return { status: 'live', url: `https://${slug}.${BASE_DOMAIN}` }
  }
  async redeploy(slug: string): Promise<DeployResult> {
    return { status: 'live', url: `https://${slug}.${BASE_DOMAIN}` }
  }
  async destroy(): Promise<void> {
    // nothing to tear down in the mock
  }
}

// Real engine — talks to a self-hosted Coolify instance. Stubbed until we wire
// the API (see ARCHITECTURE.md, milestone P2).
class CoolifyEngine implements HostingEngine {
  constructor(private apiUrl: string, private token: string) {}
  async provision(): Promise<DeployResult> {
    throw new Error('CoolifyEngine.provision is not wired yet (milestone P2).')
  }
  async redeploy(): Promise<DeployResult> {
    throw new Error('CoolifyEngine.redeploy is not wired yet (milestone P2).')
  }
  async destroy(): Promise<void> {
    throw new Error('CoolifyEngine.destroy is not wired yet (milestone P2).')
  }
}

// Pick the engine from the environment: real Coolify if configured, else mock.
export function getEngine(): HostingEngine {
  const apiUrl = process.env.COOLIFY_API_URL
  const token = process.env.COOLIFY_API_TOKEN
  if (apiUrl && token) return new CoolifyEngine(apiUrl, token)
  return new MockEngine()
}
