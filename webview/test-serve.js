import { createServer } from 'vite';
(async () => {
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5173 }
  });
  await server.listen();
  const res = await fetch('http://localhost:5173/data/users.json');
  console.log(res.status, res.headers.get('content-type'));
  const text = await res.text();
  console.log(text.slice(0, 50));
  server.close();
})();
