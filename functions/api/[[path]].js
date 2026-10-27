import { proxyApi } from '../../worker/proxy.js';

export function onRequest(context) {
  return proxyApi(context.request, context.env, context);
}
