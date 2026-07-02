import { APPS } from './apps';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('missing #app mount point');

root.innerHTML = `
  <main>
    <h1>traduzco</h1>
    <p class="tagline">Spanish, played — not studied.</p>
    <ul class="apps">
      ${APPS.map(
        (a) => `
      <li>
        <a href="${a.path}">
          <strong>${a.title}</strong>
          <span>${a.blurb}</span>
        </a>
      </li>`
      ).join('')}
    </ul>
  </main>
`;
