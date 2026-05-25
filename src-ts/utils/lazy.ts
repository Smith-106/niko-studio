/**
 * Lazy<T> — Deferred initialization holder
 *
 * Replaces the `private _x: T | null = null` + getter pattern
 * with a single composable utility.
 *
 * Usage:
 *   private engine = new Lazy(() => createEngine());
 *   get engine(): Engine { return this.engine.get(); }
 */

export class Lazy<T> {
  private _value: T | null = null;
  private readonly _factory: () => T;
  private _initialized = false;

  constructor(factory: () => T) {
    this._factory = factory;
  }

  get(): T {
    if (!this._initialized) {
      this._value = this._factory();
      this._initialized = true;
    }
    return this._value!;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  reset(): void {
    this._value = null;
    this._initialized = false;
  }

  /** Replace the value without invoking the factory */
  set(value: T): void {
    this._value = value;
    this._initialized = true;
  }
}

/**
 * AsyncLazy<T> — Deferred async initialization holder
 *
 * For resources that require async setup (DB connections, etc.).
 * Concurrent callers share the same init promise.
 */

export class AsyncLazy<T> {
  private _value: T | null = null;
  private readonly _factory: () => Promise<T>;
  private _initPromise: Promise<T> | null = null;
  private _initialized = false;

  constructor(factory: () => Promise<T>) {
    this._factory = factory;
  }

  async get(): Promise<T> {
    if (this._initialized) return this._value!;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._factory();
    try {
      this._value = await this._initPromise;
      this._initialized = true;
      return this._value;
    } finally {
      this._initPromise = null;
    }
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  reset(): void {
    this._value = null;
    this._initialized = false;
    this._initPromise = null;
  }

  set(value: T): void {
    this._value = value;
    this._initialized = true;
  }
}
