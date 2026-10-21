const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 把 ui/color.ts 产生的 ANSI 颜色转成 span，并把菜单编号变成可点击的按钮 */
export function ansiToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\x1b\[(\d+)m/g, (_, code: string) => (code === '0' ? '</span>' : `<span class="c${code}">`))
    .replace(/\[(\d+)\]/g, '<button class="opt" data-cmd="$1">[$1]</button>')
    .replace(/^(\s+)(\d+)\. /gm, '$1<button class="opt" data-cmd="$2">$2.</button> ');
}
