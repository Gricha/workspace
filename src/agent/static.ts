import { IncomingMessage, ServerResponse } from 'http';
import { promises as fs } from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getWebDir(): string {
  const distWeb = path.join(__dirname, 'web');
  const rootDistWeb = path.resolve(__dirname, '../../dist/agent/web');

  try {
    require('fs').accessSync(path.join(distWeb, 'index.html'));
    return distWeb;
  } catch {
    return rootDistWeb;
  }
}

export async function serveStatic(
  _req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  const webDir = getWebDir();
  const indexPath = path.join(webDir, 'index.html');

  try {
    await fs.access(indexPath);
  } catch {
    return false;
  }

  const ext = path.extname(pathname).toLowerCase();
  const isAsset = ext && ext !== '.html';

  if (isAsset) {
    const filePath = path.join(webDir, pathname);
    try {
      const content = await fs.readFile(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return true;
    } catch {
      return false;
    }
  }

  const content = await fs.readFile(indexPath);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(content);
  return true;
}
