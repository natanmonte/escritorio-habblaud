import type { UiComponent } from './context';

type StaffTask = { id: string; title: string; role: string; status: string; result?: string; error?: string };
type StaffOrder = { id: string; instruction: string; status: string; tasks: StaffTask[]; messages: { id: string; from: string; to: string; text: string; at: number }[]; report?: string; createdAt: number };
type ApiState = { orders: StaffOrder[]; configured: boolean };

const STATUS: Record<string, string> = { queued: 'Na fila', running: 'Trabalhando', done: 'Concluído', failed: 'Falhou' };
const ROLE: Record<string, string> = { operacoes: 'Theo · gerente', pesquisa: 'Nina · pesquisa', marketing: 'Maya · marketing', copy: 'Luca · copy', design: 'Íris · design' };

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export class StaffWorkspace implements UiComponent {
  readonly button: HTMLButtonElement;
  readonly el: HTMLElement;
  private list: HTMLElement;
  private notice: HTMLElement;
  private input: HTMLTextAreaElement;
  private configured = false;
  private orders: StaffOrder[] = [];
  private open = false;
  private loading = false;
  private selected: string | null = null;
  private lastError = '';

  constructor() {
    this.button = node('button', 'ui-btn-staff', 'Equipe');
    this.button.type = 'button';
    this.button.title = 'Abrir equipe de trabalho';
    this.button.addEventListener('click', () => { this.open = !this.open; this.el.hidden = !this.open; if (this.open) void this.refresh(); });
    this.el = node('section', 'staff-workspace');
    this.el.hidden = true;
    const header = node('header', 'staff-workspace__header');
    const heading = node('div');
    heading.append(node('h2', '', 'Escritório · Equipe'), node('p', '', 'Dê uma ordem ao Theo. Ele distribui o trabalho e acompanha as entregas.'));
    const close = node('button', 'staff-workspace__close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Fechar'); close.addEventListener('click', () => { this.open = false; this.el.hidden = true; });
    header.append(heading, close);
    this.notice = node('div', 'staff-workspace__notice');
    const composer = node('form', 'staff-workspace__composer');
    this.input = node('textarea');
    this.input.placeholder = 'Ex.: Planeje uma campanha para captar pacientes para uma clínica...';
    this.input.required = true;
    this.input.maxLength = 12000;
    const send = node('button', 'staff-workspace__send', 'Enviar ordem');
    send.type = 'submit';
    composer.append(this.input, send);
    composer.addEventListener('submit', (event) => { event.preventDefault(); void this.submit(); });
    this.list = node('div', 'staff-workspace__orders');
    this.el.append(header, this.notice, composer, this.list);
    window.setInterval(() => { if (this.open) void this.refresh(); }, 2500);
  }

  render(): void { this.button.setAttribute('aria-expanded', String(this.open)); }

  private async refresh(): Promise<void> {
    try {
      const response = await fetch('/api/workspace/orders', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const data = await response.json() as ApiState & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a equipe.');
      this.orders = data.orders || [];
      this.configured = !!data.configured;
      this.lastError = '';
      this.paint();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.paint();
    }
  }

  private async submit(): Promise<void> {
    const instruction = this.input.value.trim();
    if (!instruction || this.loading) return;
    this.loading = true;
    this.notice.textContent = 'Enviando ordem ao gerente...';
    try {
      const response = await fetch('/api/workspace/orders', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ instruction }) });
      const data = await response.json() as { order?: StaffOrder; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a ordem.');
      this.input.value = '';
      if (data.order) this.selected = data.order.id;
      await this.refresh();
    } catch (error) {
      this.notice.textContent = error instanceof Error ? error.message : String(error);
    } finally { this.loading = false; }
  }

  private paint(): void {
    this.notice.textContent = this.lastError || (this.configured ? 'IA conectada · o gerente pode distribuir ordens.' : 'A equipe está pronta, mas falta configurar a chave de IA no servidor (HABBLAUD_AI_API_KEY ou OPENAI_API_KEY).');
    this.list.replaceChildren();
    if (!this.orders.length) {
      this.list.append(node('p', 'staff-workspace__empty', 'Nenhuma ordem ainda. Escreva acima o que precisa ser feito.'));
      return;
    }
    for (const order of this.orders) {
      const card = node('article', 'staff-order');
      const top = node('button', 'staff-order__top');
      top.type = 'button';
      const title = node('strong', '', order.instruction);
      const state = node('span', 'staff-order__status', STATUS[order.status] || order.status);
      top.append(title, state);
      top.addEventListener('click', () => { this.selected = this.selected === order.id ? null : order.id; this.paint(); });
      card.append(top);
      const tasks = node('div', 'staff-order__tasks');
      for (const task of order.tasks) {
        const line = node('div', 'staff-task');
        const name = node('strong', '', ROLE[task.role] || task.role);
        const status = node('span', 'staff-task__status', STATUS[task.status] || task.status);
        line.append(name, node('span', '', task.title), status);
        if (task.error) line.append(node('p', 'staff-task__error', task.error));
        if (task.result) line.append(node('details', 'staff-task__result'));
        const details = line.querySelector('details');
        if (details) { const summary = node('summary', '', 'Ver entrega'); details.append(summary, node('p', '', task.result || '')); }
        tasks.append(line);
      }
      card.append(tasks);
      if (this.selected === order.id) {
        const conversation = node('div', 'staff-order__conversation');
        conversation.append(node('h3', '', 'Conversa da equipe'));
        for (const message of order.messages) {
          const msg = node('p', 'staff-message');
          msg.append(node('strong', '', message.from + ' → ' + message.to + ': '), document.createTextNode(message.text));
          conversation.append(msg);
        }
        if (order.report) conversation.append(node('h3', '', 'Relatório do Theo'), node('p', 'staff-order__report', order.report));
        card.append(conversation);
      }
      this.list.append(card);
    }
  }
}
