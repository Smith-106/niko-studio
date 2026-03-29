/**
 * Service Protocol
 * 
 * Defines the core capabilities of the Service layer, including initialization,
 * shutdown, and health checking.
 */
export interface ServiceProtocol {
  /**
   * Service name
   */
  readonly name: string;

  /**
   * Initialize Service
   */
  initialize(options?: Record<string, unknown>): Promise<void>;

  /**
   * Shutdown Service
   */
  shutdown(): Promise<void>;

  /**
   * Check Service health status
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get Service status
   */
  getStatus(): Record<string, unknown>;
}
