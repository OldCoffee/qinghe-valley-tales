export interface GameIO {
  print(text: string): void;
  /** 返回 null 表示输入已关闭 */
  ask(prompt: string): Promise<string | null>;
}

export interface SaveStore {
  load(): string | null;
  save(data: string): void;
}
