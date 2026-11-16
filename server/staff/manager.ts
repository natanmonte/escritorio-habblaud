import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type StaffRole = 'operacoes' | 'pesquisa' | 'marketing' | 'copy' | 'design';
export type WorkStatus = 'queued' | 'running' | 'done' | 'failed';
export interface StaffMessage { id: string; from: string; to: string; text: string; at: number }
export interface StaffTask { id: string; title: string; brief: string; role: StaffRole; status: WorkStatus; result?: string; error?: string; createdAt: number; updatedAt: number }
export interface WorkOrder { id: string; instruction: string; status: WorkStatus; tasks: StaffTask[]; messages: StaffMessage[]; report?: string; createdAt: number; updatedAt: number }
interface State { orders: WorkOrder[] }

const STAFF: Record<StaffRole, { name: string; specialty: string }> = {
  operacoes: { name: 'Theo', specialty: 'gestão operacional, planejamento, decomposição de objetivos e controle de qualidade' },
  pesquisa: { name: 'Nina', specialty: 'pesquisa, análise de mercado, validação de informações e síntese de evidências' },
  marketing: { name: 'Maya', specialty: 'estratégia de marketing, posicionamento, aquisição e campanhas' },
  copy: { name: 'Luca', specialty: 'copywriting, comunicação, ofertas, páginas e mensagens comerciais' },
  design: { name: 'Íris', specialty: 'direção de arte, experiência do usuário, identidade visual e especificações de design' },
};

function splitOrder(instruction: string): Array<{ role: StaffRole; title: string; brief: string }> {
  const lower = instruction.toLocaleLowerCase('pt-BR');
  const parts: Array<{ role: StaffRole; title: string; brief: string }> = [];
  const add = (role: StaffRole, title: string, brief: string) => parts.push({ role, title, brief });
  add('operacoes', 'Planejar e coordenar a entrega', 'Analise a ordem, defina o resultado esperado, critérios de qualidade e dependências. Não invente fatos.');
  if (/pesquis|concorr|mercado|referên|dados|levant|analis|estud/.test(lower)) add('pesquisa', 'Pesquisar e fundamentar decisões', 'Pesquise e estruture os dados necessários. Se não houver ferramenta de navegação, declare claramente o que não pôde verificar e trabalhe apenas com o contexto fornecido.');
  if (/marketing|campanh|divulga|anúncio|trafego|tráfego|posicion|marca|aquisi/.test(lower)) add('marketing', 'Desenvolver estratégia de marketing', 'Crie a estratégia aplicável, com público, mensagem, canais, sequência e métricas.');
  if (/copy|texto|página|pagina|site|landing|venda|oferta|whatsapp|email|e-mail/.test(lower)) add('copy', 'Produzir comunicação e copy', 'Produza os textos solicitados com linguagem natural, direta e orientada ao objetivo.');
  if (/design|visual|layout|identidade|interface|ui|ux/.test(lower)) add('design', 'Definir direção visual e experiência', 'Entregue uma especificação visual concreta: hierarquia, componentes, layout, cores e comportamento.');
  if (parts.length === 1) add('pesquisa', 'Analisar riscos e oportunidades', 'Faça uma análise independente da ordem, identifique lacunas, riscos e oportunidades e recomende próximos passos.');
  return parts;
}

export class StaffManager {
  private state: State = { orders: [] };
  private busy = false;
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly model: string;
  constructor(private readonly file: string, opts: { endpoint?: string; apiKey?: string; model?: string } = {}) {
    this.endpoint = (opts.endpoint ?? process.env.HABBLAUD_AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = opts.apiKey ?? process.env.HABBLAUD_AI_API_KEY ?? process.env.OPENAI_API_KEY;
    this.model = opts.model ?? process.env.HABBLAUD_AI_MODEL ?? 'gpt-4.1-mini';
  }
  async load(): Promise<void> {
    try { const raw = JSON.parse(await readFile(this.file, 'utf8')) as State; if (Array.isArray(raw.orders)) this.state = raw; } catch { /* first run */ }
    void this.drain();
  }
  list(): WorkOrder[] { return this.state.orders.slice().sort((a,b)=>b.createdAt-a.createdAt); }
  get(id: string): WorkOrder | undefined { return this.state.orders.find(o=>o.id===id); }
  async submit(instruction: string): Promise<WorkOrder> {
    const text = instruction.trim();
    if (!text || text.length > 12000) throw new Error('A ordem deve ter entre 1 e 12.000 caracteres.');
    const now=Date.now();
    const order: WorkOrder={id:randomUUID(),instruction:text,status:'queued',tasks:splitOrder(text).map(t=>({...t,id:randomUUID(),status:'queued',createdAt:now,updatedAt:now})),messages:[],createdAt:now,updatedAt:now};
    this.state.orders.unshift(order); this.state.orders=this.state.orders.slice(0,100);
    this.message(order,'Natan','Theo', 'Recebi a ordem. Vou organizar as frentes e distribuir o trabalho.');
    await this.save(); void this.drain(); return order;
  }
  private message(order:WorkOrder,from:string,to:string,text:string) { order.messages.push({id:randomUUID(),from,to,text,at:Date.now()}); }
  private async save() { await mkdir(dirname(this.file),{recursive:true}); await writeFile(this.file,JSON.stringify(this.state,null,2),'utf8'); }
  private async ask(system:string,user:string):Promise<string> {
    if (!this.apiKey) throw new Error('Falta configurar HABBLAUD_AI_API_KEY (ou OPENAI_API_KEY) no servidor.');
    const response=await fetch(this.endpoint+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+this.apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,temperature:0.4,messages:[{role:'system',content:system},{role:'user',content:user}]})});
    if(!response.ok) throw new Error('Provedor de IA respondeu HTTP '+response.status+': '+(await response.text()).slice(0,500));
    const data=await response.json() as {choices?:Array<{message?:{content?:string}}>} ;
    const content=data.choices?.[0]?.message?.content;
    if(typeof content!=='string'||!content.trim()) throw new Error('O modelo não retornou conteúdo.');
    return content.trim();
  }
  private async drain() {
    if(this.busy) return; this.busy=true;
    try {
      for(const order of this.state.orders.filter(o=>o.status==='queued'||o.status==='running')) {
        order.status='running'; order.updatedAt=Date.now(); await this.save();
        for(const task of order.tasks) {
          if(task.status==='done') continue;
          const staff=STAFF[task.role]; task.status='running'; task.updatedAt=Date.now();
          this.message(order,'Theo',staff.name,'Você recebeu: '+task.title+'. Sua entrega será compartilhada com a equipe.');
          await this.save();
          try {
            task.result=await this.ask('Você é '+staff.name+', especialista em '+staff.specialty+'. Trabalhe em português. Seja objetivo, entregue material utilizável, diferencie fatos de hipóteses e nunca afirme que pesquisou na internet se não teve ferramenta de busca.', 'ORDEM GERAL:\n'+order.instruction+'\n\nSUA TAREFA:\n'+task.brief+'\n\nTÍTULO: '+task.title+'\n\nConsidere o que os outros colegas já produziram:\n'+order.tasks.filter(t=>t.id!==task.id&&t.result).map(t=>STAFF[t.role].name+': '+t.result).join('\n\n'));
            task.status='done'; this.message(order,staff.name,'Theo',task.result);
          } catch(e) { task.status='failed'; task.error=e instanceof Error?e.message:String(e); this.message(order,staff.name,'Theo','Não consegui concluir: '+task.error); }
          task.updatedAt=Date.now(); order.updatedAt=Date.now(); await this.save();
        }
        const successes=order.tasks.filter(t=>t.status==='done');
        try {
          order.report=await this.ask('Você é Theo, gerente do escritório. Consolide as entregas da equipe em um relatório final claro, indique pendências e próximos passos. Não esconda falhas.', 'ORDEM DO Natan:\n'+order.instruction+'\n\nENTREGAS:\n'+successes.map(t=>STAFF[t.role].name+' ('+t.title+'):\n'+t.result).join('\n\n')+'\n\nFALHAS:\n'+order.tasks.filter(t=>t.status==='failed').map(t=>STAFF[t.role].name+': '+t.error).join('\n'));
          this.message(order,'Theo','Natan',order.report);
        } catch(e) { order.report='As tarefas terminaram, mas não foi possível gerar a consolidação: '+(e instanceof Error?e.message:String(e)); }
        order.status=order.tasks.some(t=>t.status==='failed')?'failed':'done'; order.updatedAt=Date.now(); await this.save();
      }
    } finally { this.busy=false; }
  }
}
