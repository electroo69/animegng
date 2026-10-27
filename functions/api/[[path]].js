// /api/* -> the anime API (see functions/_api/app.js).
import { handle } from '../_api/app.js';

export const onRequest = (context) => {
  const path = '/' + [].concat(context.params.path ?? []).join('/');
  return handle(context.request, path, context);
};
