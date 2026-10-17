type ThemeName = 'light' | 'dark';

const TOKENS = {
  ink: 'ink',
  inkSoft: 'ink-soft',
  inkFaint: 'ink-faint',
  paper: 'paper',
  paperDeep: 'paper-deep',
  tag: 'tag',
  open: 'open',
  closed: 'closed',
  unknown: 'unknown',
  grid: 'grid',
} as const;

type Palette = Record<keyof typeof TOKENS, string>;

export const palette = {} as Palette;

const listeners: Array<() => void> = [];

function readPalette(): void {
  const style = getComputedStyle(document.documentElement);
  for (const [key, token] of Object.entries(TOKENS)) {
    palette[key as keyof Palette] = style.getPropertyValue(`--color-${token}`).trim();
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.paper);
}

function currentTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function onThemeChange(cb: () => void): void {
  listeners.push(cb);
}

function setTheme(name: ThemeName): void {
  document.documentElement.dataset.theme = name;
  try {
    localStorage.setItem('theme', name);
  } catch {
    console.warn('Theme preference could not be saved');
  }
  readPalette();
  listeners.forEach(l => l());
}

export function initTheme(toggle: HTMLButtonElement): void {
  readPalette();

  const sync = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    toggle.textContent = next === 'light' ? '☀' : '☾';
    toggle.setAttribute('aria-label', `Switch to ${next} theme`);
    toggle.title = `Switch to ${next} theme`;
  };

  sync();
  toggle.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    sync();
  });
}
