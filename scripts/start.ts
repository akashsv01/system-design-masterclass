// Cross-platform `npm start` (Windows shells do not accept `NODE_ENV=production cmd`).
process.env.NODE_ENV ??= 'production';
await import('../server/index.ts');
export {};
