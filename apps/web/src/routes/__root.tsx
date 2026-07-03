import type { ReactNode } from 'react';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'traduzco' },
    ],
    links: [
      {
        rel: 'icon',
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎴</text></svg>",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style>{css}</style>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Scaffold-grade styling, same dark palette as the game (#14101e).
const css = `
  html, body { margin: 0; padding: 0; min-height: 100%; background: #14101e; color: #e8e2f4; font-family: system-ui, sans-serif; }
  main { max-width: 36rem; margin: 0 auto; padding: 4rem 1.25rem; }
  h1 { font-size: 2rem; margin: 0 0 0.25rem; }
  .tagline { margin: 0 0 2.5rem; opacity: 0.7; }
  .actions { display: flex; gap: 0.75rem; }
  .actions button, .actions a, a.cta { padding: 0.6rem 1.25rem; border: 1px solid #7a5fd0; border-radius: 0.5rem; background: transparent; color: inherit; font-size: 1rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .actions button:hover, .actions a:hover, a.cta:hover { background: #1c1630; }
  ul.apps { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; }
  ul.apps a { display: block; padding: 1.25rem; border: 1px solid #3a3054; border-radius: 0.75rem; color: inherit; text-decoration: none; }
  ul.apps a:hover { border-color: #7a5fd0; background: #1c1630; }
  ul.apps strong { display: block; margin-bottom: 0.25rem; }
  ul.apps span { opacity: 0.7; font-size: 0.9rem; }
  header.bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
`;
