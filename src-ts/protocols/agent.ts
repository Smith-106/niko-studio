/**
 * Agent Protocol
 * 
 * Defines the core capabilities of an Agent, including task execution,
 * validation, and output formatting.
 */
export interface AgentProtocol {
  /**
   * Agent name
   */
  readonly name: string;

  /**
   * Execute Agent task
   */
  execute(
    inputData: unknown,
    options?: Record<string, unknown>
  ): Promise<unknown>;

  /**
   * Validate input data
   */
  validate(inputData: unknown): [boolean, string[]];

  /**
   * Format output result
   */
  formatOutput(
    result: unknown,
    options?: Record<string, unknown>
  ): Record<string, unknown>;

  /**
   * Check Agent health status
   */
  healthCheck(): Promise<boolean>;
}
