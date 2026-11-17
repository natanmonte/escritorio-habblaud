import type { UiComponent } from './context';

type ApiTask = { id: string; agent_id: string; title: string; description: string; status: string; result?: string; error?: string; created_at: string; parent_id?: string; project_id?: string; phase?: string };
type ApiMessage = { id: string; from_agent: string; to_agent?: string; content: string; created_at: string };
type StaffTask = { id: string; title: string; role: string; status: string; result?: string; error?: string };
type StaffOrder = { id: string; instruction: string; status: string; tasks: StaffTask[]; messages: { id: string; from: string; to: string; text: string; at: number }[]; report?: string; createdAt: number };
const API = 'https://escritorio-ia-api.natanmonte1.workers.dev';
const STATUS: Record<string, string> = { queued: 'Na fila', running: 'Trabalhando', done: 'Concluído', failed: 'Falhou' };
const ROLE: Record<string, string> = { theo: 'Theo · gerente', nina: 'Nina · pesquisa', maya: 'Maya · marketing', luca: 'Luca · copy' };
const NAMES: Record<string, string> = { user: 'Natan', theo: 'Theo', nina: 'Nina', maya: 'Maya', luca: 'Luca' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el;
}
function state(s: string): string { return s === 'completed' ? 'done' : s === 'processing' || s === 'coordinating' ? 'running' : s; }
function dateMs(s: string): number { const n = Date.parse(s); return Number.isFinite(n) ? n : Date.now(); }

export class StaffWorkspace implements UiComponent {
  readonly button: HTMLButtonElement;
  readonly el: HTMLElement;
  private list: HTMLElement;
  private notice: HTMLElement;
  private input: HTMLTextAreaElement;
  private configured = true;
  private orders: StaffOrder[] = [];
  private open = false;
  private loading = false;
  private selected: string | null = null;
  private lastError = '';
  constructor() {
    this.button = node('button', 'ui-btn-staff', 'Equipe'); this.button.type = 'button'; this.button.title = 'Abrir equipe de trabalho';
    this.button.addEventListener('click', () => { this.open = !this.open; this.el.hidden = !this.open; if (this.open) void this.refresh(); });
    this.el = node('section', 'staff-workspace'); this.el.hidden = true;
    const header = node('header', 'staff-workspace__header'), heading = node('div');
    heading.append(node('h2', '', 'Escritório · Equipe'), node('p', '', 'Dê uma ordem ao Theo. Ele distribui o trabalho e acompanha as entregas.'));
    const close = node('button', 'staff-workspace__close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar');
    close.addEventListener('click', () => { this.open = false; this.el.hidden = true; }); header.append(heading, close);
    this.notice = node('div', 'staff-workspace__notice');
    const composer = node('form', 'staff-workspace__composer'); this.input = node('textarea');
    this.input.placeholder = 'Ex.: Planeje uma campanha para captar pacientes para uma clínica...'; this.input.required = true; this.input.maxLength = 12000;
    const send = node('button', 'staff-workspace__send', 'Enviar ordem'); send.type = 'submit';
    composer.append(this.input, send); composer.addEventListener('submit', e => { e.preventDefault(); void this.submit(); });
    this.list = node('div', 'staff-workspace__orders'); this.el.append(header, this.notice, composer, this.list);
    window.setInterval(() => { if (this.open) void this.refresh(); }, 2500);
  }
  render(): void { this.button.setAttribute('aria-expanded', String(this.open)); }
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(API + path, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error || 'Não foi possível acessar a equipe.');
    return data;
  }
  private async refresh(): Promise<void> {
    try {
      const [rawTasks, rawMessages] = await Promise.all([
        this.request<ApiTask[]>('/api/tasks'), this.request<ApiMessage[]>('/api/messages')
      ]);
      const roots = rawTasks.filter(t => !t.parent_id && t.agent_id === 'theo');
      this.orders = roots.map(root => {
        const children = rawTasks.filter(t => t.parent_id === root.id);
        const all = [root, ...children];
        const failed = all.some(t => t.status === 'failed');
        const complete = root.status === 'completed' || root.status === 'completed';
        const messages = rawMessages.filter(m => all.some(t => t.id === (m as ApiMessage & { task_id?: string }).task_id) || (!!root.project_id && (m as ApiMessage & { project_id?: string }).project_id === root.project_id));
        const final = messages.find(m => m.from_agent === 'theo' && m.content && m.content.length > 180);
        return {
          id: root.id, instruction: root.title + (root.description ? '\n' + root.description : ''),
          status: failed ? 'failed' : complete ? 'done' : 'running',
          tasks: children.map(t => ({ id: t.id, title: t.title, role: t.agent_id, status: state(t.status), result: t.result, error: t.error })),
          messages: messages.map(m => ({ id: m.id, from: NAMES[m.from_agent] || m.from_agent, to: NAMES[m.to_agent || ''] || m.to_agent || 'Equipe', text: m.content, at: dateMs(m.created_at) })),
          report: root.result || final?.content, createdAt: dateMs(root.created_at)
        } as StaffOrder;
      }).sort((a,b) => b.createdAt-a.createdAt);
      this.lastError = ''; this.paint();
    } catch (error) { this.lastError = error instanceof Error ? error.message : String(error); this.paint(); }
  }
  private async submit(): Promise<void> {
    const instruction = this.input.value.trim(); if (!instruction || this.loading) return;
    this.loading = true; this.notice.textContent = 'Enviando ordem ao Theo...';
    try {
      const title = instruction.split('\n')[0].slice(0, 110) || 'Nova ordem';
      const data = await this.request<{ id: string }>('/api/tasks', { method: 'POST', body: JSON.stringify({ agent_id: 'theo', title, description: instruction }) });
      this.input.value = ''; this.selected = data.id; await this.refresh();
    } catch (error) { this.notice.textContent = error instanceof Error ? error.message : String(error); }
    finally { this.loading = false; }
  }
  private paint(): void {
    this.notice.textContent = this.lastError || 'Equipe conectada · Theo recebe suas ordens e distribui o trabalho entre os especialistas.';
    this.list.replaceChildren();
    if (!this.orders.length) { this.list.append(node('p', 'staff-workspace__empty', 'Nenhuma ordem ainda. Escreva acima o que precisa ser feito.')); return; }
    for (const order of this.orders) {
      const card = node('article', 'staff-order'), top = node('button', 'staff-order__top'); top.type = 'button';
      top.append(node('strong', '', order.instruction), node('span', 'staff-order__status', STATUS[order.status] || order.status));
      top.addEventListener('click', () => { this.selected = this.selected === order.id ? null : order.id; this.paint(); }); card.append(top);
      const tasks = node('div', 'staff-order__tasks');
      for (const task of order.tasks) {
        const line = node('div', 'staff-task');
        line.append(node('strong', '', ROLE[task.role] || task.role), node('span', '', task.title), node('span', 'staff-task__status', STATUS[task.status] || task.status));
        if (task.error) line.append(node('p', 'staff-task__error', task.error));
        if (task.result) { const details = node('details'); details.append(node('summary', '', 'Ver entrega'), node('p', '', task.result)); line.append(details); }
        tasks.append(line);
      }
      card.append(tasks);
      if (this.selected === order.id) {
        const conversation = node('div', 'staff-order__conversation'); conversation.append(node('h3', '', 'Conversa da equipe'));
        for (const message of order.messages) { const msg = node('p', 'staff-message'); msg.append(node('strong', '', message.from + ' → ' + message.to + ': '), document.createTextNode(message.text)); conversation.append(msg); }
        if (order.report) conversation.append(node('h3', '', 'Relatório do Theo'), node('p', 'staff-order__report', order.report));
        card.append(conversation);
      }
      this.list.append(card);
    }
  }
}
