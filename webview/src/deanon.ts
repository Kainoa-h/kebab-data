const map = new Map<string, string>(); // alias → real username
const listeners: Array<() => void> = [];

export function deAnon(alias: string): string {
  return map.get(alias) ?? alias;
}

export function loadDeAnonMap(data: Record<string, { id: number; username: string }>): number {
  map.clear();
  for (const [alias, { username }] of Object.entries(data)) {
    map.set(alias, username);
  }
  listeners.forEach(l => l());
  return map.size;
}

export function onDeAnonChange(cb: () => void): void {
  listeners.push(cb);
}

export function initDeAnonUI(): void {
  const btn = document.getElementById('btn-deanon')!;
  const modal = document.getElementById('modal-deanon')!;
  const closeBtn = document.getElementById('btn-deanon-close')!;
  const input = document.getElementById('input-deanon') as HTMLInputElement;
  const status = document.getElementById('deanon-status')!;

  const openModal = () => modal.classList.remove('hidden');
  const closeModal = () => modal.classList.add('hidden');

  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = 'Loading…';
    status.className = 'text-xs text-gray-400 min-h-[1.25rem] mb-4';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = loadDeAnonMap(data);
      status.textContent = `✓ Loaded ${count} aliases`;
      status.className = 'text-xs text-green-500 min-h-[1.25rem] mb-4';
    } catch {
      status.textContent = '✗ Invalid file — expected anon_map.json format';
      status.className = 'text-xs text-red-500 min-h-[1.25rem] mb-4';
    }
  });
}
