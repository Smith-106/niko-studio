declare module "async-lock" {
  class Lock {
    acquire(key?: string | string[]): Promise<() => void>;
  }
  export { Lock };
}
