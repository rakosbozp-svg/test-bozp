/** `npm start` (and the double-click launchers): start the server and open the browser. */
export {};
process.env.BC_OPEN_BROWSER = '1';
await import('./index.ts');
