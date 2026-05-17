const isDev = import.meta.env.DEV

const noop = () => {}

export const logger = {
  log: isDev ? console.log.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  error: console.error.bind(console),
  debug: isDev ? console.debug.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
}
