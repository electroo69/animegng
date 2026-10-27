import { waitUntil } from '@vercel/functions';
import { handle } from '../worker/app.js';

export default {
  fetch(request) {
    const url = new URL(request.url);
    const path = url.searchParams.get('__path') ?? url.pathname.replace(/^\/api(?=\/|$)/, '');
    url.searchParams.delete('__path');
    url.pathname = '/api/' + path.replace(/^\//, '');
    return handle(new Request(url, request), '/' + path.replace(/^\//, ''), { waitUntil });
  },
};
