/**
 * CLI module - barrel exports
 *
 * Migrated from src/cli/__init__.py.
 */

export {
  CliContext,
  ConsoleLike,
  Command,
  CommandOption,
  RoutingResult,
  PlanStep,
  Plan,
  normalizeNamespace,
  formatDate,
  generateSessionId,
  GENRE_CHOICES,
  normalizeGenre,
  genreToGenerationRecommendation,
  mergeControlsWithGenre,
} from './types';

export {
  initCommand,
  runCommand,
  chatCommand,
  evaluateCommand,
  exportCommand,
  statusCommand,
  statsCommand,
  searchCommand,
  serveCommand,
  guidedDraftCommand,
  projectTechRefreshCommand,
} from './commands';

export { NikoCli, createCli } from './commands';
