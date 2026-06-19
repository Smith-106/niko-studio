import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { IMCPRequestRouter, MCPProviderSpec } from './mcp-router';
import type { IEventBus } from '../services/event-bus';
import { createLogger } from '../logger/index.js';

const _log = createLogger('service-discovery');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryConfig {
  /** Path to mcp-config.json. Default '.workflow/mcp-config.json'. */
  configPath?: string;
  /** Env var prefix for providers. Default 'MCP_PROVIDER_'. */
  environmentPrefix?: string;
  /** How often to re-scan config (ms). Default 60000. */
  scanIntervalMs?: number;
}

export interface DiscoveredProvider {
  name: string;
  capabilities: string[];
  endpoint?: string;
  priority?: number;
  source: 'config' | 'environment' | 'manual';
}

// ---------------------------------------------------------------------------
// Config file schema
// ---------------------------------------------------------------------------

interface MCPConfigFile {
  providers?: Array<{
    name: string;
    capabilities: string[];
    endpoint?: string;
    priority?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IMCPServiceDiscovery {
  /** Begin discovery loop. */
  start(): Promise<void>;
  /** Stop discovery. */
  stop(): void;
  /** Scan config/env for providers. */
  discoverProviders(): Promise<DiscoveredProvider[]>;
  /** Currently known providers. */
  getDiscoveredProviders(): DiscoveredProvider[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<DiscoveryConfig> = {
  configPath: '.workflow/mcp-config.json',
  environmentPrefix: 'MCP_PROVIDER_',
  scanIntervalMs: 60000,
};

export class MCPServiceDiscoveryImpl implements IMCPServiceDiscovery {
  private readonly router: IMCPRequestRouter;
  private readonly eventBus: IEventBus;
  private readonly config: Required<DiscoveryConfig>;
  private readonly providers = new Map<string, DiscoveredProvider>();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(router: IMCPRequestRouter, eventBus: IEventBus, config?: DiscoveryConfig) {
    this.router = router;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Initial discovery
    await this.discoverProviders();

    // Periodic re-scan
    this.scanTimer = setInterval(() => {
      this.discoverProviders().catch((err) => {
        _log.error('Periodic discovery scan failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.config.scanIntervalMs);

    _log.info('Service discovery started', { scanIntervalMs: this.config.scanIntervalMs });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.scanTimer !== null) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    _log.info('Service discovery stopped');
  }

  async discoverProviders(): Promise<DiscoveredProvider[]> {
    const previousNames = new Set(this.providers.keys());
    const discovered: DiscoveredProvider[] = [];
    const discoveredNames = new Set<string>();

    // Config-based discovery
    const configProviders = await this.discoverFromConfig();
    discovered.push(...configProviders);

    // Environment-based discovery
    const envProviders = this.discoverFromEnvironment();
    discovered.push(...envProviders);

    // Register new providers and publish events
    for (const provider of discovered) {
      const isNew = !previousNames.has(provider.name);
      discoveredNames.add(provider.name);
      this.providers.set(provider.name, provider);

      if (isNew) {
        this.registerWithRouter(provider);
        this.eventBus.publish('mcp:provider-discovered', provider);
        _log.info('Provider discovered', { name: provider.name, source: provider.source });
      }
    }

    // Detect removed providers (only from config source)
    for (const name of previousNames) {
      if (!discoveredNames.has(name)) {
        this.providers.delete(name);
        this.eventBus.publish('mcp:provider-removed', { name });
        _log.info('Provider removed', { name });
      }
    }

    return Array.from(this.providers.values());
  }

  getDiscoveredProviders(): DiscoveredProvider[] {
    return Array.from(this.providers.values());
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Read the JSON config file and parse providers. */
  private async discoverFromConfig(): Promise<DiscoveredProvider[]> {
    const configPath = resolve(this.config.configPath);

    try {
      const raw = await readFile(configPath, 'utf-8');
      const parsed: MCPConfigFile = JSON.parse(raw);

      if (!Array.isArray(parsed.providers)) {
        return [];
      }

      return parsed.providers.map((p) => ({
        name: p.name,
        capabilities: p.capabilities ?? [],
        endpoint: p.endpoint,
        priority: p.priority ?? 0,
        source: 'config' as const,
      }));
    } catch {
      // Config file may not exist yet — that's fine, just skip.
      return [];
    }
  }

  /** Scan environment variables matching the prefix pattern. */
  private discoverFromEnvironment(): DiscoveredProvider[] {
    const prefix = this.config.environmentPrefix;
    const providers: DiscoveredProvider[] = [];

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith(prefix) || !value) continue;

      // Format: MCP_PROVIDER_<NAME>=capabilities,endpoint,priority
      // Example: MCP_PROVIDER_FILESYSTEM=tools/call|resources/read,http://localhost:8080,10
      const name = key.slice(prefix.length).toLowerCase();
      const parts = value.split(',');

      const capabilities = parts[0]
        ? parts[0].split('|').map((c) => c.trim()).filter(Boolean)
        : [];
      const endpoint = parts[1]?.trim() || undefined;
      const priority = parts[2] ? parseInt(parts[2], 10) : 0;

      providers.push({
        name,
        capabilities,
        endpoint,
        priority: Number.isFinite(priority) ? priority : 0,
        source: 'environment' as const,
      });
    }

    return providers;
  }

  /** Register a discovered provider with the request router. */
  private registerWithRouter(provider: DiscoveredProvider): void {
    const spec: MCPProviderSpec = {
      name: provider.name,
      capabilities: provider.capabilities,
      handler: async () => {
        // Placeholder handler — real handlers are registered separately.
        throw new Error(
          `Provider "${provider.name}" discovered but no handler registered. ` +
          `Register a handler via MCPRequestRouter.registerProvider() with a real handler function.`,
        );
      },
      priority: provider.priority ?? 0,
      healthStatus: 'healthy',
    };

    this.router.registerProvider(spec);
  }
}
