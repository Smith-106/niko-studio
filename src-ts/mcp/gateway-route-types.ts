import type { HttpRequest, HttpResponse } from './http-types';

export type EndpointHandler = (request: HttpRequest) => Promise<HttpResponse>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface GatewayRoute {
  method: HttpMethod;
  pattern: RegExp;
  handler: EndpointHandler;
  paramNames?: string[];
}

export interface GatewayRouteMatch {
  route: GatewayRoute;
  params: Record<string, string>;
}
