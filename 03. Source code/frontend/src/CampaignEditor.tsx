import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import { inlineParts, type InlinePart } from './campaignContent';

export type EditorHandle = { insert: (before: string, after?: string) => void; format: (command: string) => void };

function read(node: Node): string {
  if (node.nodeType === 3) return node.textContent || '';
  if (!(node instanceof HTMLElement)) return '';
  if (node.dataset.block) return node.dataset.block;
  if (node.tagName === 'BR') return '\n';
  const text = [...node.childNodes].map(read).join('');
  if (['B', 'STRONG'].includes(node.tagName)) return '**' + text + '**';
  if (['I', 'EM'].includes(node.tagName)) return '_' + text + '_';
  if (node.tagName === 'U') return '~' + text + '~';
  return (['DIV', 'P'].includes(node.tagName) && node.previousSibling ? '\n' : '') + text;
}

function fragment(value: string, campaignId: string) {
  const result = document.createDocumentFragment();
  const tokens = value.split(/(\[\[[^\]\r\n]*\]\])/g);
  for (const token of tokens) {
    if (!token) continue;
    const image = token.match(/^\[\[Hình ảnh:(\d+)\]\]$/);
    const button = token.match(/^\[\[Nút:([^|]+)\|([^\]]+)\]\]$/);
    if (image || button || token === '[[Đường phân cách]]') {
      const block = document.createElement('span');
      block.contentEditable = 'false'; block.dataset.block = token; block.className = 'next-editor-block';
      if (image) {
        const img = document.createElement('img'); img.src = `/api/campaigns/${campaignId}/assets/${image[1]}`; img.alt = 'Hình ảnh nội dung email'; block.append(img);
      } else if (button) {
        const link = document.createElement('span'); link.className = 'next-email-cta'; link.textContent = button[1]; block.append(link);
      } else block.append(document.createElement('hr'));
      result.append(block);
    } else {
      drawInline(result, inlineParts(token));
    }
  }
  return result;
}

function drawInline(parent: Node, parts: InlinePart[]) {
  for (const part of parts) {
    if (typeof part === 'string') parent.appendChild(document.createTextNode(part));
    else { const element = document.createElement(part.tag); drawInline(element, part.parts); parent.appendChild(element); }
  }
}

export default function CampaignEditor({ value, campaignId, onChange, onBlock, ref, disabled = false }: {
  value: string; campaignId: string; onChange: (value: string) => void; onBlock: (kind: string) => void; ref: Ref<EditorHandle>; disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null), selection = useRef<Range | null>(null), current = useRef<string | null>(null);
  const remember = () => { const active = window.getSelection(); if (active?.rangeCount && root.current?.contains(active.anchorNode)) selection.current = active.getRangeAt(0).cloneRange(); };
  const update = () => { const next = [...(root.current?.childNodes || [])].map(read).join(''); current.current = next; onChange(next); remember(); };
  const restore = () => {
    const host = root.current; if (!host) return;
    host.focus(); const active = window.getSelection();
    const range = selection.current && host.contains(selection.current.commonAncestorContainer) ? selection.current : document.createRange();
    if (!selection.current || !host.contains(range.commonAncestorContainer)) { range.selectNodeContents(host); range.collapse(false); }
    active?.removeAllRanges(); active?.addRange(range); return range;
  };
  const insert = (before: string, after = '') => {
    const range = restore(); if (!range) return;
    const selected = range.toString(); range.deleteContents();
    const content = fragment(before + selected + after, campaignId), end = content.lastChild;
    range.insertNode(content);
    if (end) { range.setStartAfter(end); range.collapse(true); selection.current = range.cloneRange(); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range); }
    update();
  };
  useImperativeHandle(ref, () => ({ insert, format(command) { restore(); document.execCommand(command); update(); } }));
  useLayoutEffect(() => {
    if (root.current && current.current !== value) { root.current.replaceChildren(fragment(value, campaignId)); current.current = value; selection.current = null; }
  }, [value, campaignId]);
  return <div id="campaign-body" ref={root} className="next-rich-editor" role="textbox" aria-label="Nội dung email" aria-multiline aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning
    onInput={update} onKeyUp={remember} onMouseUp={remember} onBlur={remember}
    onPaste={event => { event.preventDefault(); restore(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); update(); }}
    onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (disabled) return; const kind = event.dataTransfer.getData('application/x-v5-block'); if (kind) onBlock(kind); else insert(event.dataTransfer.getData('text/plain')); }} />;
}
