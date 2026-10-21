import * as readline from 'node:readline';

/** 自己维护行队列：管道输入时 readline 会在没有等待者时丢行 */
export class LineInput {
  private rl: readline.Interface;
  private queue: string[] = [];
  private waiters: ((line: string | null) => void)[] = [];
  private closed = false;
  private readonly echo = !process.stdin.isTTY;

  constructor() {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.on('line', (line) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter(line);
      else this.queue.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) waiter(null);
    });
    this.rl.on('SIGINT', () => this.rl.close());
  }

  ask(prompt: string): Promise<string | null> {
    this.rl.setPrompt(prompt);
    this.rl.prompt();
    const next = this.queue.length > 0 ? Promise.resolve(this.queue.shift()!) : this.wait();
    return next.then((line) => {
      if (this.echo && line !== null) process.stdout.write(`${line}\n`);
      return line;
    });
  }

  close(): void {
    this.rl.close();
  }

  private wait(): Promise<string | null> {
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}
