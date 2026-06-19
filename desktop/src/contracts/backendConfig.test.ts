import { describe, expect, it } from 'vitest'

describe('backendConfig contracts', () => {
  it('evaluates the backend config module at runtime', async () => {
    const mod = await import('./backendConfig')

    expect(Object.keys(mod)).toEqual([])
  })

  it('accepts representative backend config response shapes at compile time', () => {
    const response: import('./backendConfig').ConfigResponse = {
      status: 'ok',
      modifiable_fields: ['gateway.cors_prod_origins', 'version'],
      config: {
        app_name: 'Niko Studio',
        version: '11.0.0',
        debug: false,
        env: 'production',
        data_dir: 'data',
        log_dir: 'logs',
        agent: {
          max_cost_per_request: 1,
          max_cost_per_session: 2,
          max_tokens_per_request: 4096,
          budget_warn_threshold: 0.8,
          default_model: 'gpt-5.5',
          google_api_key: '',
          openai_api_key: '',
          log_level: 'info',
        },
        memory: {
          vector_db_path: 'memory.db',
          embedding_model: 'text-embedding',
          embedding_dimension: 1536,
          cache_enabled: true,
          cache_ttl: 3600,
          cache_max_size: 200,
          chunk_size: 1000,
          chunk_overlap: 100,
        },
        workflow: {
          session_timeout: 900,
          max_concurrent_sessions: 4,
          checkpoint_enabled: true,
          checkpoint_interval: 30,
          resume_strategy: 'latest',
          quality_mode: 'strict',
          quality_level: 'release',
          degrade_on_timeout: false,
          degrade_on_error: false,
          critical_gate_always_on: true,
          quality_phase_timeout_seconds: 120,
        },
        graph: {
          db_path: 'graph.db',
          max_connections: 4,
          max_entities_per_query: 100,
          relation_depth: 3,
        },
        writing: {
          character_depth_dimensions: 8,
          max_character_traits: 12,
          scene_coherence_threshold: 0.85,
          contradiction_sensitivity: 'medium',
          foreshadowing_max_distance: 5,
          foreshadowing_reminder_threshold: 2,
          style_vector_dimensions: 256,
          style_sample_min_words: 400,
        },
        backup: {
          backup_dir: 'backups',
          compress: true,
          max_backups: 5,
          webdav_enabled: false,
          webdav_url: '',
          webdav_username: '',
          webdav_password: '',
          webdav_remote_path: '',
          s3_enabled: false,
          s3_bucket: '',
          s3_prefix: '',
          s3_region: '',
          s3_endpoint_url: '',
          s3_access_key_id: '',
          s3_secret_access_key: '',
          s3_force_path_style: false,
        },
        token: {
          db_path: 'tokens.db',
          default_model: 'gpt-5.5',
          default_budget: 10,
          budget_warn_threshold: 0.75,
        },
        obsidian: {
          enabled: true,
          auto_discover: true,
          sync_on_startup: false,
          default_vault: 'studio',
          file_patterns: ['**/*.md'],
        },
        gateway: {
          host: '127.0.0.1',
          port: 5389,
          reload: false,
          localhost_only: true,
          localhost_only_exempt_paths: ['/health'],
          cors_dev_origins: ['http://localhost:5173'],
          cors_prod_origins: ['tauri://localhost'],
          metrics_enabled: true,
          ui_bridge_enabled: true,
          detection_evasion_guard: true,
        },
        integration: {
          postgres_enabled: false,
          redis_cache_enabled: false,
          elasticsearch_enabled: false,
          neo4j_enabled: false,
          langflow_enabled: false,
          dbhub_governance_enabled: true,
          search_route_mode: 'gateway',
          search_elastic_timeout_ms: 5000,
          redis_rate_limit: 30,
          redis_rate_limit_window_seconds: 60,
          langflow_flow_name: 'default',
          redis_cache_ttl_seconds: 300,
        },
      },
    }

    expect(response.config.gateway.cors_prod_origins).toEqual(['tauri://localhost'])
    expect(response.modifiable_fields).toContain('version')
  })
})
