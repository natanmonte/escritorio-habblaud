import type { UiComponent } from './context';

type ApiTask = { id: string; agent_id: string; title: string; description: string; status: string; result?: string; error?: string; created_at: string; parent_id?: string; project_id?: string; phase?: string };
type ApiMessage = { id: string; from_agent: string; to_agent?: string; content: string; created_at: string };
type StaffTask = { id: string; title: string; role: string; status: string; result?: string; error?: string };
type StaffOrder = { id: string; instruction: string; status: string; tasks: StaffTask[]; messages: { id: string; from: string; to: string; text: string; at: number }[]; report?: string; createdAt: number };
const API = 'https://escritorio-ia-api.natanmonte1.workers.dev';
const STATUS: Record<string, string> = { queued: 'Na fila', running: 'Trabalhando', done: 'Concluído', failed: 'Falhou' };
const ROLE: Record<string, string> = { theo: 'Theo · gerente', nina: 'Nina · pesquisa', maya: 'Maya · marketing', luca: 'Luca · copy', julio: 'Julio · desenvolvedor web' };
const NAMES: Record<string, string> = { user: 'Natan', theo: 'Theo', nina: 'Nina', maya: 'Maya', luca: 'Luca', julio: 'Julio' };
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
  private assignee: HTMLSelectElement;
  private configured = true;
  private orders: StaffOrder[] = [];
  private open = false;
  private loading = false;
  private selected: string | null = null;
  private lastError = '';
  private management: HTMLElement;
  private currentTab = 'orders';
  private authMode = false;
  constructor() {
    this.button = node('button', 'ui-btn-staff', 'Equipe'); this.button.type = 'button'; this.button.title = 'Abrir equipe de trabalho';
    this.button.addEventListener('click', () => { this.open = !this.open; this.el.hidden = !this.open; if (this.open) void this.enter(); });
    this.el = node('section', 'staff-workspace'); this.el.hidden = true;
    const header = node('header', 'staff-workspace__header'), heading = node('div');
    heading.append(node('h2', '', 'Escritório · Equipe'), node('p', '', 'Dê uma ordem ao Theo. Ele distribui o trabalho e acompanha as entregas.'));
    const close = node('button', 'staff-workspace__close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar');
    close.addEventListener('click', () => { this.open = false; this.el.hidden = true; }); header.append(heading, close);
    this.notice = node('div', 'staff-workspace__notice');
    const composer = node('form', 'staff-workspace__composer');
    this.assignee = node('select','staff-select');
    for (const [id,label] of [['theo','Theo · distribuir entre a equipe'],['julio','Julio · desenvolvedor web'],['maya','Maya · marketing'],['luca','Luca · copy'],['nina','Nina · pesquisa']] as const) { const option=node('option','',label) as HTMLOptionElement; option.value=id; this.assignee.append(option); }
    this.assignee.setAttribute('aria-label','Enviar ordem para');
    this.input = node('textarea');
    this.input.placeholder = 'Ex.: Planeje uma campanha para captar pacientes para uma clínica...'; this.input.required = true; this.input.maxLength = 12000;
    const send = node('button', 'staff-workspace__send', 'Enviar ordem'); send.type = 'submit';
    composer.append(this.assignee, this.input, send); composer.addEventListener('submit', e => { e.preventDefault(); void this.submit(); });
    const nav = node('nav', 'staff-workspace__nav');
    for (const [id,label] of [['orders','Ordens'],['team','Equipe'],['training','Treinamento'],['company','Empresa']] as const) {
      const tab=node('button','staff-workspace__tab',label); tab.type='button';
      tab.addEventListener('click',()=>{this.currentTab=id;this.renderTab();});
      nav.append(tab);
    }
    this.management=node('div','staff-workspace__management');
    this.list = node('div', 'staff-workspace__orders'); this.el.append(header, nav, this.notice, composer, this.list, this.management);
    window.setInterval(() => { if (this.open && !this.authMode && localStorage.getItem('pixello-office-token')) void this.refresh(); }, 2500);
    // Primeiro acesso: abre diretamente o cadastro do administrador, sem exigir um clique no botão Equipe.
    if (!localStorage.getItem('pixello-office-token')) {
      this.open = true;
      this.el.hidden = false;
      void this.enter();
    }
  }
  render(): void { this.button.setAttribute('aria-expanded', String(this.open)); }
  private async api(path:string,method='GET',body?:unknown):Promise<any>{
    return this.request<any>(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
  }
  private async enter():Promise<void>{
    try{
      const token=localStorage.getItem('pixello-office-token');
      if(token){await this.api('/api/agents');this.authMode=false;this.renderTab();await this.refresh();return;}
      this.showAuth();
    }catch{localStorage.removeItem('pixello-office-token');this.showAuth();}
  }
  private showAuth():void{
    this.authMode=true;this.notice.hidden=true;this.input.closest('form')!.hidden=true;this.list.hidden=true;
    this.management.hidden=false;delete this.management.dataset.tab;this.el.querySelector('.staff-workspace__nav')?.setAttribute('hidden','');
    this.el.querySelector('.staff-workspace__logout')?.setAttribute('hidden','');
    const status=fetch(API+'/api/auth/status').then(r=>r.json()).catch(()=>({setupRequired:false}));
    void status.then((state:any)=>{
      const setup=!!state.setupRequired;
      const wrap=node('div','staff-management staff-auth');
      wrap.append(node('h3','',setup?'Criar acesso do escritório':'Entrar no escritório'),node('p','staff-help',setup?'Crie o usuário e a senha de administrador. Esse cadastro inicial só poderá ser feito uma vez.':'Entre com seu usuário e senha para acessar a equipe e os projetos.'));
      const username=this.field('Usuário');const password=this.field('Senha');(password.control as HTMLInputElement).type='password';
      if(setup)(password.control as HTMLInputElement).autocomplete='new-password';else (password.control as HTMLInputElement).autocomplete='current-password';
      const feedback=node('p','staff-task__error','');
      const submit=this.action(setup?'Criar conta e entrar':'Entrar',async()=>{
        submit.disabled=true;feedback.textContent='Verificando acesso...';
        try{
          const result=await this.api(setup?'/api/auth/setup':'/api/auth/login','POST',{username:username.control.value,password:password.control.value});
          localStorage.setItem('pixello-office-token',result.token);this.authMode=false;
          this.el.querySelector('.staff-workspace__nav')?.removeAttribute('hidden');this.el.querySelector('.staff-workspace__logout')?.removeAttribute('hidden');
          this.currentTab='orders';this.management.hidden=true;this.renderTab();await this.refresh();
        }catch(e){feedback.textContent=e instanceof Error?e.message:String(e);submit.disabled=false;}
      },'primary');
      wrap.append(username.wrap,password.wrap,submit,feedback);this.management.replaceChildren(wrap);
    });
  }
  private async logout():Promise<void>{
    try{await this.api('/api/auth/logout','POST');}catch{}
    localStorage.removeItem('pixello-office-token');this.showAuth();
  }
  private renderTab():void {
    if(this.authMode)return;
    const orders=this.currentTab==='orders';
    this.notice.hidden=!orders; this.input.closest('form')!.hidden=!orders; this.list.hidden=!orders;
    this.management.hidden=orders;
    const labels:Record<string,string>={orders:'Ordens',team:'Equipe',training:'Treinamento',company:'Empresa'};
    this.el.querySelectorAll<HTMLButtonElement>('.staff-workspace__tab').forEach(b=>b.classList.toggle('is-active',b.textContent===labels[this.currentTab]));
    if(!orders && this.management.dataset.tab!==this.currentTab){this.management.dataset.tab=this.currentTab;void this.loadManagement();}
  }
  private field(label:string,value='',multiline=false):{wrap:HTMLElement;control:HTMLInputElement|HTMLTextAreaElement}{
    const wrap=node('label','staff-field');wrap.append(node('span','',label));
    const control=multiline?node('textarea') as HTMLTextAreaElement:node('input') as HTMLInputElement;
    control.value=value;control.setAttribute('aria-label',label);wrap.append(control);return {wrap,control};
  }
  private action(label:string,fn:()=>void,kind=''):HTMLButtonElement{
    const b=node('button','staff-action '+kind,label);b.type='button';b.addEventListener('click',fn);return b;
  }
  private async loadManagement():Promise<void>{
    this.management.replaceChildren(node('p','staff-workspace__empty','Carregando...'));
    try{
      if(this.currentTab==='team') await this.renderTeam();
      else if(this.currentTab==='training') await this.renderTraining();
      else if(this.currentTab==='company') await this.renderCompany();
    }catch(e){this.management.replaceChildren(node('p','staff-task__error',e instanceof Error?e.message:String(e)));}
  }
  private async renderTeam():Promise<void>{
    const agents=await this.api('/api/agents') as any[];
    const wrap=node('div','staff-management');
    wrap.append(node('h3','','Funcionários ativos'),node('p','staff-help','Contrate especialistas, ajuste suas funções ou demita quem não faz mais parte da equipe.'));
    for(const a of agents){
      const card=node('section','staff-person');
      const top=node('div','staff-person__top');top.append(node('strong','',a.name),node('span','',a.role));card.append(top,node('p','staff-help',a.specialty));
      if(a.id!=='theo') card.append(this.action('Demitir',async()=>{if(!confirm('Demitir '+a.name+'? O histórico e as entregas serão preservados.'))return;await this.api('/api/agents/'+a.id,'DELETE');await this.renderTeam();},'danger'));
      wrap.append(card);
    }
    wrap.append(node('h3','','Contratar funcionário'));
    const name=this.field('Nome'),role=this.field('Cargo'),specialty=this.field('Especialidade','',true),training=this.field('Treinamento inicial','Instruções profissionais que o funcionário deve seguir...',true);
    const hire=this.action('Contratar',async()=>{
      const n=name.control.value.trim(),r=role.control.value.trim(),sp=specialty.control.value.trim();
      if(!n||!r||!sp){this.notice.textContent='Preencha nome, cargo e especialidade.';return;}
      await this.api('/api/agents','POST',{name:n,role:r,specialty:sp,training:training.control.value});
      await this.renderTeam();
    },'primary');
    wrap.append(name.wrap,role.wrap,specialty.wrap,training.wrap,hire);this.management.replaceChildren(wrap);
  }
  private async renderTraining():Promise<void>{
    const agents=await this.api('/api/training') as any[];
    const wrap=node('div','staff-management');wrap.append(node('h3','','Centro de treinamento'),node('p','staff-help','O treinamento é salvo e enviado ao funcionário em todas as novas tarefas. Complementa o conhecimento profissional com os padrões da Pixello.'));
    const select=node('select','staff-select');for(const a of agents){const o=node('option','',a.name+' · '+a.role) as HTMLOptionElement;o.value=a.id;select.append(o);}
    const prompt=this.field('Instruções profissionais permanentes','',true),training=this.field('Treinamento adicional da Pixello','',true);
    const load=()=>{const a=agents.find(x=>x.id===select.value);if(!a)return;prompt.control.value=a.system_prompt||'';training.control.value=a.training||'';};
    select.addEventListener('change',load);load();
    const save=this.action('Salvar treinamento',async()=>{await this.api('/api/agents/'+select.value,'PATCH',{system_prompt:prompt.control.value,training:training.control.value});this.notice.textContent='Treinamento salvo. Será aplicado nas próximas tarefas.';},'primary');
    wrap.append(select,prompt.wrap,training.wrap,save);this.management.replaceChildren(wrap);
  }
  private async renderCompany():Promise<void>{
    const data=await this.api('/api/company') as Record<string,any>;
    const wrap=node('div','staff-management');wrap.append(node('h3','','Informações da empresa'),node('p','staff-help','Essas informações formam o contexto permanente usado pela equipe ao planejar e executar trabalhos.'));
    const fields=[
      this.field('Nome da empresa',data.name||'Pixello'),
      this.field('Descrição',data.description||'',true),
      this.field('Segmento',data.segment||''),
      this.field('Serviços oferecidos',data.services||'',true),
      this.field('Público-alvo',data.audience||'',true),
      this.field('Diferenciais',data.differentials||'',true),
      this.field('Site',data.website||''),
      this.field('Instagram',data.instagram||''),
      this.field('Tom de voz da marca',data.brand_voice||'',true)
    ];
    const save=this.action('Salvar informações',async()=>{const keys=['name','description','segment','services','audience','differentials','website','instagram','brand_voice'];const payload:Record<string,string>={};keys.forEach((k,i)=>payload[k]=fields[i].control.value);await this.api('/api/company','POST',payload);this.notice.textContent='Informações da empresa salvas.';},'primary');
    fields.forEach(x=>wrap.append(x.wrap));wrap.append(save);this.management.replaceChildren(wrap);
  }
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token=localStorage.getItem('pixello-office-token');
    const response = await fetch(API + path, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(token?{Authorization:'Bearer '+token}:{}), ...init?.headers } });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error || 'Não foi possível acessar a equipe.');
    return data;
  }
  private async refresh(): Promise<void> {
    try {
      const [rawTasks, rawMessages] = await Promise.all([
        this.request<ApiTask[]>('/api/tasks'), this.request<ApiMessage[]>('/api/messages')
      ]);
      const roots = rawTasks.filter(t => !t.parent_id);
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
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      if(this.lastError.includes('Faça login')){localStorage.removeItem('pixello-office-token');this.showAuth();return;}
      this.paint();
    }
  }
  private async submit(): Promise<void> {
    const instruction = this.input.value.trim(); if (!instruction || this.loading) return;
    this.loading = true; this.notice.textContent = 'Enviando ordem para ' + (this.assignee.selectedOptions[0]?.textContent || 'a equipe') + '...';
    try {
      const title = instruction.split('\n')[0].slice(0, 110) || 'Nova ordem';
      const data = await this.request<{ id: string }>('/api/tasks', { method: 'POST', body: JSON.stringify({ agent_id: this.assignee.value || 'theo', title, description: instruction }) });
      this.input.value = ''; this.selected = data.id; await this.refresh();
    } catch (error) { this.notice.textContent = error instanceof Error ? error.message : String(error); }
    finally { this.loading = false; }
  }
  private paint(): void {
    this.notice.textContent = this.lastError || 'Equipe conectada · Theo recebe suas ordens e distribui o trabalho entre os especialistas.';
    this.renderTab();
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
        if (task.result) {
          const details=node('details');details.append(node('summary','','Ver entrega'));
          const lowerResult=task.result.toLowerCase();
          const fenceStart=lowerResult.indexOf('```html');
          const htmlStart=lowerResult.indexOf('<!doctype html')>=0?lowerResult.indexOf('<!doctype html'):lowerResult.indexOf('<html');
          const htmlEnd=lowerResult.lastIndexOf('</html>')+7;
          let rawHtml='';
          if(fenceStart>=0){const bodyStart=task.result.indexOf('\n',fenceStart)+1;const fenceEnd=task.result.indexOf('```',bodyStart);if(fenceEnd>bodyStart)rawHtml=task.result.slice(bodyStart,fenceEnd).trim();}
          else if(htmlStart>=0&&htmlEnd>htmlStart)rawHtml=task.result.slice(htmlStart,htmlEnd).trim();
          if(rawHtml){
            const tools=node('div','staff-deliverable-actions');
            const preview=this.action('Visualizar página',()=>{const url=URL.createObjectURL(new Blob([rawHtml],{type:'text/html;charset=utf-8'}));window.open(url,'_blank','noopener');window.setTimeout(()=>URL.revokeObjectURL(url),60000);},'primary');
            const download=this.action('Baixar HTML',()=>{const blob=new Blob([rawHtml],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=node('a') as HTMLAnchorElement;a.href=url;a.download='pagina-vendas.html';document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);});
            tools.append(preview,download);details.append(tools);
          }
          const result=node('pre','staff-task__result');result.textContent=task.result;details.append(result);line.append(details);
        }
        tasks.append(line);
      }
      card.append(tasks);
      if (this.selected === order.id) {
        const conversation = node('div', 'staff-order__conversation'); conversation.append(node('h3', '', 'Conversa da equipe'));
        for (const message of order.messages) { const msg = node('p', 'staff-message'); msg.append(node('strong', '', message.from + ' → ' + message.to + ': '), document.createTextNode(message.text)); conversation.append(msg); }
        if (order.report) conversation.append(node('h3', '', 'Relatório do Theo'), node('p', 'staff-order__report', order.report));
        const next=node('div','staff-next-step');next.append(node('h3','','Adicionar nova etapa ao projeto'));
        const chooser=node('select','staff-select');
        void this.api('/api/agents').then((rows:any[])=>{for(const a of rows.filter(a=>a.id!=='theo')){const o=node('option','',a.name+' · '+a.role) as HTMLOptionElement;o.value=a.id;chooser.append(o);}});
        const continueBtn=this.action('Enviar nova etapa',async()=>{if(!chooser.value){this.notice.textContent='Não há funcionário disponível.';return;}await this.api('/api/tasks/'+order.id+'/continue','POST',{agent_id:chooser.value});this.notice.textContent='Nova etapa enviada. O funcionário recebeu o histórico e as entregas anteriores.';await this.refresh();});
        next.append(chooser,continueBtn);conversation.append(next);
        card.append(conversation);
      }
      this.list.append(card);
    }
  }
}
