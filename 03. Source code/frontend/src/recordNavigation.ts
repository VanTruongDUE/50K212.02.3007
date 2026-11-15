export type RecordContext = { key: string; id: string };
export type Navigate = (screen: string, context?: RecordContext) => void;
const entryScreens = ['contact-lists', 'manager-review', 'campaign-list', 'campaign-create', 'response-list', 'response-add', 'followup-list', 'sender-list', 'manager-account-list', 'manager-account-check', 'manager-account-add', 'templates', 'template-create'];

export function recordKey(screen: string): string {
  if (/^manager-review|^contact-|^(all-contacts|check|check-rejected|confirm|confirmed|export|export-success)$/.test(screen)) return 'listId';
  if (screen.startsWith('campaign-')) return 'campaignId';
  if (screen.startsWith('response-') || ['followup-create', 'followup-duplicate', 'followup-optout'].includes(screen)) return 'responseId';
  if (screen.startsWith('followup-')) return 'followupId';
  if (screen.startsWith('manager-account-') || screen.startsWith('sender-')) return 'senderId';
  if (screen.startsWith('template')) return 'filterId';
  return '';
}

export function recordContext(screen: string, search: string): RecordContext {
  const key = recordKey(screen);
  return { key, id: key ? new URLSearchParams(search).get(key) || '' : '' };
}

export function recordRequired(screen: string): boolean {
  return !!recordKey(screen) && !entryScreens.includes(screen) && screen !== 'followup-create';
}

export function navigationParams(next: string, current: URLSearchParams, context?: RecordContext): URLSearchParams {
  const params = new URLSearchParams();
  const key = recordKey(next);
  const entry = entryScreens.includes(next);
  if (key && !entry) {
    const id = context?.key === key ? context.id
      : recordKey(current.get('screen') || '') === key ? current.get(key) : null;
    if (id) params.set(key, id);
  }
  if (/^(criteria|review|search|results|history)/.test(next)) {
    const id = current.get('searchId');
    if (id) params.set('searchId', id);
  }
  return params;
}

export function selectedRecord<T extends { id: string }>(items: T[], id: string): T | undefined {
  return id ? items.find(item => item.id === id) : items[0];
}
