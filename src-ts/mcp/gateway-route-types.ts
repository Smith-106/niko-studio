import type { HttpRequest, HttpResponse } from './http-types';

export type EndpointHandler = (request: HttpRequest) => Promise<HttpResponse>;

export interface GatewayRoute {
  method: string;
  pattern: RegExp;
  handler: EndpointHandler;
  paramNames?: string[];
}

export interface GatewayRouteMatch {
  route: GatewayRoute;
  params: Record<string, string>;
}
