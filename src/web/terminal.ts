import { setColorEnabled } from '../ui/color.js';
import type { SaveStore } from '../ui/io.js';
import { runSession } from '../ui/session.js';
import { ansiToHtml } from './ansi.js';

const HISTORY_LIMIT = 50;

/** 高级模式：和 CLI 相同的文字终端，共用同一个存档槽 */
export function startTerminal(saveKey: string): void {
  const output = document.getElementById('t-output')!;
  const form = document.getElementById('t-form') as HTMLFormElement;
  const input = document.getElementById('t-input') as HTMLInputElement;
  const promptEl = document.getElementById('t-prompt')!;

  const queue: string[] = [];
  let waiting: ((line: string | null) => void) | null = null;
  let currentPrompt = '';
  const history: string[] = [];
  let historyIndex = 0;

  function print(text: string): void {
    const line = document.createElement('div');
    line.innerHTML = ansiToHtml(text);
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function submit(line: string): void {
    for (const button of output.querySelectorAll<HTMLElement>('[data-cmd]')) {
      button.removeAttribute('data-cmd');
      button.classList.add('stale');
    }
    print(currentPrompt + line);
    if (line.trim()) {
      history.push(line);
      if (history.length > HISTORY_LIMIT) history.shift();
    }
    historyIndex = history.length;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(line);
    } else {
      queue.push(line);
    }
  }

  function ask(prompt: string): Promise<string | null> {
    currentPrompt = prompt;
    promptEl.innerHTML = ansiToHtml(prompt);
    const next = queue.shift();
    if (next !== undefined) return Promise.resolve(next);
    return new Promise((resolve) => {
      waiting = resolve;
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(input.value);
    input.value = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && historyIndex > 0) {
      input.value = history[--historyIndex];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
      e.preventDefault();
    }
  });

  output.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]');
    if (button?.dataset.cmd) submit(button.dataset.cmd);
  });

  const store: SaveStore = {
    load: () => localStorage.getItem(saveKey),
    save: (data) => localStorage.setItem(saveKey, data),
  };

  setColorEnabled(true);
  runSession({ print, ask }, store, Date.now()).then(() => {
    promptEl.textContent = '';
    input.disabled = true;
    print('终端已退出，刷新页面可以重新开始。');
  });
}
