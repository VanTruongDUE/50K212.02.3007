export function invalidEmailVariable(value: string) {
  const variables = [...value.matchAll(/\{\{([^{}]+)\}\}/g)];
  const unsupported = variables.find(([, name]) => !['Họ tên', 'Tên doanh nghiệp'].includes(name))?.[0];
  if (unsupported) return `Biến ${unsupported} không nằm trong danh sách biến hệ thống hỗ trợ.`;
  return /\{\{|\}\}/.test(value.replace(/\{\{[^{}]+\}\}/g, '')) ? 'Biến cá nhân hóa sai cú pháp.' : '';
}

export type InlinePart = string | { tag: 'strong' | 'em' | 'u'; parts: InlinePart[] };
export function inlineParts(value: string, depth = 0): InlinePart[] {
  if (depth >= 8) return [value];
  return value.split(/(\*\*[^*]+\*\*|_[^_\n]+_|~[^~\n]+~)/g).filter(Boolean).map(token => {
    if (/^\*\*[^*]+\*\*$/.test(token)) return { tag: 'strong', parts: inlineParts(token.slice(2, -2), depth + 1) };
    if (/^_[^_\n]+_$/.test(token)) return { tag: 'em', parts: inlineParts(token.slice(1, -1), depth + 1) };
    if (/^~[^~\n]+~$/.test(token)) return { tag: 'u', parts: inlineParts(token.slice(1, -1), depth + 1) };
    return token;
  });
}
