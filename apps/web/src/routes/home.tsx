import { createFileRoute } from '@tanstack/react-router';
import { RedirectToSignIn, Show, UserButton } from '@clerk/react';
import { APPS } from '../apps';

export const Route = createFileRoute('/home')({
  component: HomeRoute,
});

export function HomeRoute() {
  return (
    <>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
      <Show when="signed-in">
        <HomePage />
      </Show>
    </>
  );
}

export function HomePage() {
  return (
    <main>
      <header className="bar">
        <h1>Home</h1>
        <UserButton />
      </header>
      <ul className="apps">
        {APPS.map((app) => (
          <li key={app.path}>
            <a href={app.path}>
              <strong>{app.title}</strong>
              <span>{app.blurb}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
