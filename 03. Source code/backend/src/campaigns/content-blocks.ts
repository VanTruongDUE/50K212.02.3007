import { BadRequestException } from '@nestjs/common';

export type CampaignBlock =
  | { kind: 'text'; value: string }
  | { kind: 'image'; id: number }
  | { kind: 'button'; label: string; url: string }
  | { kind: 'divider' };

export function parseCampaignBody(body: string): CampaignBlock[] {
  const blocks: CampaignBlock[] = [];
  const markers = /\[\[([^\]\r\n]*)\]\]/g;
  let position = 0;
  for (const match of body.matchAll(markers)) {
    const before = body.slice(position, match.index);
    if (before.includes('[[') || before.includes(']]'))
      throw new BadRequestException('Khối nội dung email chưa hoàn chỉnh.');
    if (before) blocks.push({ kind: 'text', value: before });
    const value = match[1];
    if (value === 'Đường phân cách') blocks.push({ kind: 'divider' });
    else if (value.startsWith('Hình ảnh:')) {
      const id = Number(value.slice('Hình ảnh:'.length));
      if (!Number.isSafeInteger(id) || id < 1)
        throw new BadRequestException('Ảnh trong nội dung email không hợp lệ.');
      blocks.push({ kind: 'image', id });
    } else if (value.startsWith('Nút:')) {
      const separator = value.indexOf('|');
      const label = value.slice(4, separator).trim();
      const url = value.slice(separator + 1).trim();
      let valid = false;
      try {
        const parsed = new URL(url);
        valid =
          parsed.protocol === 'https:' && !parsed.username && !parsed.password;
      } catch {
        /* Invalid link is reported below. */
      }
      if (
        separator < 5 ||
        !label ||
        label.length > 80 ||
        url.length > 2048 ||
        !valid
      )
        throw new BadRequestException(
          'Nút email cần tên và liên kết HTTPS hợp lệ.',
        );
      blocks.push({ kind: 'button', label, url });
    } else
      throw new BadRequestException('Khối nội dung email không được hỗ trợ.');
    position = match.index + match[0].length;
  }
  const after = body.slice(position);
  if (after.includes('[[') || after.includes(']]'))
    throw new BadRequestException('Khối nội dung email chưa hoàn chỉnh.');
  if (after) blocks.push({ kind: 'text', value: after });
  return blocks;
}

export function renderCampaignBody(
  body: string,
  assets: { id: string; kind: string; file_name: string }[],
  personalize: (value: string) => string = (value) => value,
) {
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const format = (value: string) =>
    escape(personalize(value))
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/~([^~]+)~/g, '<u>$1</u>');
  const blocks = parseCampaignBody(body);
  return {
    text: blocks
      .map((block) => {
        if (block.kind === 'text') return personalize(block.value);
        if (block.kind === 'button')
          return `${personalize(block.label)}: ${block.url}`;
        if (block.kind === 'divider') return '\n────────\n';
        const image = assets.find(
          (asset) => asset.kind === 'image' && asset.id === String(block.id),
        );
        if (!image)
          throw new BadRequestException(
            'Ảnh trong nội dung email không còn tồn tại.',
          );
        return `[Hình ảnh: ${image.file_name}]`;
      })
      .join(''),
    html: blocks
      .map((block) => {
        if (block.kind === 'text') return format(block.value);
        if (block.kind === 'button')
          return `<a href="${escape(block.url)}" style="display:inline-block;padding:10px 16px;background:#2f6edb;color:#ffffff;text-decoration:none;border-radius:4px">${escape(personalize(block.label))}</a>`;
        if (block.kind === 'divider')
          return '<hr style="border:0;border-top:1px solid #ccd8e8;margin:16px 0">';
        const image = assets.find(
          (asset) => asset.kind === 'image' && asset.id === String(block.id),
        );
        if (!image)
          throw new BadRequestException(
            'Ảnh trong nội dung email không còn tồn tại.',
          );
        return `<img src="cid:v5-image-${block.id}" alt="${escape(image.file_name)}" style="display:block;max-width:100%;height:auto">`;
      })
      .join(''),
  };
}
