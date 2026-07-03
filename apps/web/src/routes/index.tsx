import { createFileRoute } from '@tanstack/react-router';
import { Show, SignInButton, SignUpButton } from '@clerk/react';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

export function LandingPage() {
  return (
    <main>
      <h1>traduzco</h1>
      <p className="tagline">Spanish, played — not studied.</p>
      <Show when="signed-out">
        <div className="actions">
          <SignUpButton mode="modal">
            <button type="button">Sign up</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button type="button">Sign in</button>
          </SignInButton>
        </div>
      </Show>
      <Show when="signed-in">
        {/* becomes <Link> once the /home route lands (next task) */}
        <a className="cta" href="/home">
          Go to home
        </a>
      </Show>
    </main>
  );
}
