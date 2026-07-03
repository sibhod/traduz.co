import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <main>
      <h1>traduzco</h1>
      <p className="tagline">Spanish, played — not studied.</p>
    </main>
  );
}
