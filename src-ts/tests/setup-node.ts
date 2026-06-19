import { afterEach } from 'vitest';

const nativeFetch = globalThis.fetch;
const NativeHeaders = globalThis.Headers;
const NativeRequest = globalThis.Request;
const NativeResponse = globalThis.Response;

function restoreWebGlobals(): void {
  if (nativeFetch && globalThis.fetch !== nativeFetch) {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: nativeFetch,
    });
  }

  if (NativeHeaders && globalThis.Headers !== NativeHeaders) {
    Object.defineProperty(globalThis, 'Headers', {
      configurable: true,
      writable: true,
      value: NativeHeaders,
    });
  }

  if (NativeRequest && globalThis.Request !== NativeRequest) {
    Object.defineProperty(globalThis, 'Request', {
      configurable: true,
      writable: true,
      value: NativeRequest,
    });
  }

  if (NativeResponse && globalThis.Response !== NativeResponse) {
    Object.defineProperty(globalThis, 'Response', {
      configurable: true,
      writable: true,
      value: NativeResponse,
    });
  }
}

restoreWebGlobals();
afterEach(() => {
  restoreWebGlobals();
});
