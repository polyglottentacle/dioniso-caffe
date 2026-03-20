import React, { useState, useEffect, useReducer } from 'react';
import {
  Activity, Map as MapIcon,
  Kanban as LayoutKanban, Brain, Target, MessageSquare, Send, Sparkles
} from 'lucide-react';

// ==========================================
// 1. TIPI E INTERFACCE
// ==========================================
type AgentState = 'IDLE' | 'WALKING' | 'WORKING';
type TaskStatus = 'TODO' | 'DOING' | 'DONE';

interface Agent {
  id: string;
  name: string;
  role: string;
  state: AgentState;
  position: { x: number; y: number };
  target?: { x: number; y: number };
  currentTaskId?: string;
  thoughtBubble?: string;
  color: string;
  icon: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  assignedTo?: string;
  location: { x: number; y: number };
  progress: number; // 0 to 100
}

interface AppEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  isAI?: boolean;
}

// ==========================================
// 2. STATO INIZIALE E MOTORE LOGICO
// ==========================================
const initialState = {
  agents: {
    ATHENA: { id: 'ATHENA', name: 'Athena', role: 'Costruttore', state: 'IDLE', position: { x: 150, y: 150 }, color: 'bg-blue-500', icon: '🦉' },
    ARES: { id: 'ARES', name: 'Ares', role: 'Difesa', state: 'IDLE', position: { x: 50, y: 50 }, color: 'bg-red-500', icon: '⚔️' },
    HERMES: { id: 'HERMES', name: 'Hermes', role: 'Esploratore', state: 'IDLE', position: { x: 250, y: 250 }, color: 'bg-orange-400', icon: '🪽' },
  } as Record<string, Agent>,
  tasks: {} as Record<string, Task>,
  logs: [] as AppEvent[],
  isThinking: false
};

function reducer(state: typeof initialState, action: { type: string; payload?: any }): typeof initialState {
  switch (action.type) {
    case 'SET_THINKING':
      return { ...state, isThinking: action.payload };
    case 'ADD_LOG':
      return { ...state, logs: [{ id: Math.random().toString(), createdAt: new Date().toLocaleTimeString('it-IT'), ...action.payload }, ...state.logs] };
    case 'ADD_TASK':
      return { ...state, tasks: { ...state.tasks, [action.payload.id]: action.payload } };
    case 'ASSIGN_TASK': {
      const { taskId, agentId } = action.payload;
      const task = state.tasks[taskId];
      if (!task || task.status !== 'TODO') return state;
      return {
        ...state,
        tasks: { ...state.tasks, [taskId]: { ...task, status: 'DOING', assignedTo: agentId } },
        agents: { ...state.agents, [agentId]: { ...state.agents[agentId], currentTaskId: taskId, target: task.location, state: 'WALKING', thoughtBubble: `Vado a: ${task.title}` } }
      };
    }
    case 'ENGINE_TICK': {
      const newAgents = { ...state.agents };
      const newTasks = { ...state.tasks };
      const newLogs = [...state.logs];
      let agentsChanged = false;
      let tasksChanged = false;

      // 1. Assegnazione Automatica (Agenti IDLE cercano Task TODO)
      const idleAgents = Object.values(newAgents).filter(a => a.state === 'IDLE');
      const todoTasks = Object.values(newTasks).filter(t => t.status === 'TODO');

      idleAgents.forEach(agent => {
        const suitableTask = todoTasks.find(t => {
          if (t.assignedTo) return false;
          if (agent.role === 'Costruttore' && t.title.toLowerCase().includes('costruisci')) return true;
          if (agent.role === 'Difesa' && t.title.toLowerCase().includes('difesa')) return true;
          if (agent.role === 'Esploratore' && t.title.toLowerCase().includes('esplora')) return true;
          return false;
        }) || todoTasks.find(t => !t.assignedTo);

        if (suitableTask) {
          const updatedTask = { ...newTasks[suitableTask.id], assignedTo: agent.id, status: 'DOING' as TaskStatus };
          newTasks[suitableTask.id] = updatedTask;
          newAgents[agent.id] = {
            ...newAgents[agent.id],
            currentTaskId: suitableTask.id,
            target: suitableTask.location,
            state: 'WALKING',
            thoughtBubble: `Accetto: ${suitableTask.title}`
          };
          agentsChanged = true;
          tasksChanged = true;

          newLogs.unshift({
            id: Math.random().toString(), createdAt: new Date().toLocaleTimeString('it-IT'),
            type: 'AUTO_ASSIGN', message: `${agent.name} ha preso in carico "${suitableTask.title}"`, isAI: true
          });
        }
      });

      // 2. Movimento e Lavoro
      Object.values(newAgents).forEach(agent => {
        if (agent.state === 'WALKING' && agent.target) {
          const dx = agent.target.x - agent.position.x;
          const dy = agent.target.y - agent.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 5) {
            newAgents[agent.id] = { ...newAgents[agent.id], state: 'WORKING', position: agent.target, thoughtBubble: 'Lavorando...' };
            agentsChanged = true;
          } else {
            const speed = 4;
            newAgents[agent.id] = {
              ...newAgents[agent.id],
              position: {
                x: agent.position.x + (dx / dist) * speed,
                y: agent.position.y + (dy / dist) * speed
              }
            };
            agentsChanged = true;
          }
        }
        else if (agent.state === 'WORKING' && agent.currentTaskId) {
          const task = newTasks[agent.currentTaskId];
          if (task && task.status === 'DOING') {
            const newProgress = task.progress + 2;
            tasksChanged = true;
            if (newProgress >= 100) {
              newTasks[agent.currentTaskId] = { ...task, status: 'DONE', progress: 100 };
              newAgents[agent.id] = { ...newAgents[agent.id], state: 'IDLE', currentTaskId: undefined, thoughtBubble: 'Finito!', target: undefined };
              agentsChanged = true;

              newLogs.unshift({
                id: Math.random().toString(), createdAt: new Date().toLocaleTimeString('it-IT'),
                type: 'TASK_COMPLETED', message: `${agent.name} ha completato "${task.title}"`, isAI: true
              });
            } else {
              newTasks[agent.currentTaskId] = { ...task, progress: newProgress };
            }
          }
        }
      });

      return (agentsChanged || tasksChanged)
        ? { ...state, agents: newAgents, tasks: newTasks, logs: newLogs }
        : state;
    }
    default: return state;
  }
}

// ==========================================
// 3. COMPONENTE PRINCIPALE
// ==========================================
export default function OlimpoOSV2() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [prompt, setPrompt] = useState('');

  // Motore di Gioco (Game Loop a ~30fps)
  useEffect(() => {
    const ticker = setInterval(() => {
      dispatch({ type: 'ENGINE_TICK' });
    }, 50);
    return () => clearInterval(ticker);
  }, []);

  // Simulazione RAG / Agente Orchestratore (Zeus)
  const handleGodPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || state.isThinking) return;

    const userCmd = prompt;
    setPrompt('');

    dispatch({ type: 'ADD_LOG', payload: { type: 'USER_COMMAND', message: `Direttiva: "${userCmd}"`, isAI: false } });
    dispatch({ type: 'SET_THINKING', payload: true });

    setTimeout(() => {
      dispatch({ type: 'ADD_LOG', payload: { type: 'LLM_REASONING', message: `Analisi sintattica della direttiva completata. Scomposizione in sub-task in corso...`, isAI: true } });

      setTimeout(() => {
        const cmdLower = userCmd.toLowerCase();
        const baseId = Date.now().toString();

        if (cmdLower.includes('difesa') || cmdLower.includes('nemici') || cmdLower.includes('mura')) {
          dispatch({ type: 'ADD_TASK', payload: { id: `T1_${baseId}`, title: 'Costruisci Mura', description: 'Rinforzare il perimetro', status: 'TODO', priority: 1, location: { x: 50, y: 150 }, progress: 0 }});
          dispatch({ type: 'ADD_TASK', payload: { id: `T2_${baseId}`, title: 'Pattuglia Difesa', description: 'Supervisionare area', status: 'TODO', priority: 2, location: { x: 80, y: 180 }, progress: 0 }});
        }
        else if (cmdLower.includes('esplora') || cmdLower.includes('risorse') || cmdLower.includes('nord')) {
          dispatch({ type: 'ADD_TASK', payload: { id: `T1_${baseId}`, title: 'Esplora Nord', description: 'Mappatura del territorio ignoto', status: 'TODO', priority: 1, location: { x: 150, y: 20 }, progress: 0 }});
        }
        else {
          const rndX = Math.floor(Math.random() * 250) + 20;
          const rndY = Math.floor(Math.random() * 250) + 20;
          dispatch({ type: 'ADD_TASK', payload: { id: `TG_${baseId}`, title: `Incarico: ${userCmd.substring(0, 15)}...`, description: 'Direttiva generale divina', status: 'TODO', priority: 3, location: { x: rndX, y: rndY }, progress: 0 }});
        }

        dispatch({ type: 'ADD_LOG', payload: { type: 'TASKS_GENERATED', message: `Task generati e pubblicati sulla Kanban. Attendo che gli agenti se li assegnino.`, isAI: true } });
        dispatch({ type: 'SET_THINKING', payload: false });
      }, 1500);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1a] text-slate-200 font-sans overflow-hidden">

      {/* HEADER / GOD PROMPT BAR */}
      <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center px-6 gap-6 shrink-0 relative z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
            <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
            Olimpo OS <span className="text-xs font-mono text-slate-500 tracking-normal ml-2">v2.GodMode</span>
          </h1>
        </div>

        <form onSubmit={handleGodPromptSubmit} className="flex-1 max-w-2xl relative group">
          <div className={`absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full blur-md transition-opacity duration-500 ${state.isThinking ? 'opacity-100 animate-pulse' : 'opacity-0 group-hover:opacity-100'}`}></div>
          <div className="relative flex items-center bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
            <MessageSquare size={16} className={state.isThinking ? "text-cyan-400 animate-bounce" : "text-slate-500"} />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={state.isThinking}
              placeholder={state.isThinking ? "Zeus sta processando le direttive..." : "Scrivi un comando (es. 'Costruisci mura di difesa' o 'Esplora le rovine a nord')..."}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm px-3 py-1 text-slate-200 placeholder-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={state.isThinking || !prompt.trim()}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors"
            >
              {state.isThinking ? <Activity size={12} className="animate-spin" /> : <Send size={12} className="translate-x-[1px]" />}
            </button>
          </div>
        </form>
      </header>

      {/* WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT COLUMN: EMBODIED WORLD */}
        <div className="w-[350px] lg:w-[400px] border-r border-slate-800 flex flex-col bg-slate-900/40 relative z-10">
          <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center gap-2">
            <MapIcon className="text-cyan-400" size={16} />
            <h2 className="font-bold tracking-widest uppercase text-[10px] text-cyan-50">Regno Fisico (Embodiment)</h2>
          </div>

          {/* Mappa Interattiva Simulata */}
          <div className="relative h-[350px] border-b border-slate-800 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950 to-black overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '25px 25px' }}></div>

            {/* Markers Task sulla mappa */}
            {Object.values(state.tasks).filter(t => t.status !== 'DONE').map(task => (
              <div key={task.id} className="absolute flex flex-col items-center justify-center transition-all duration-300"
                   style={{ left: task.location.x, top: task.location.y }}>
                 <div className="w-8 h-8 rounded-full border border-dashed border-cyan-500/50 animate-[spin_6s_linear_infinite] flex items-center justify-center relative">
                    <Target size={12} className="text-cyan-400 absolute" />
                 </div>
                 <span className="text-[8px] font-mono text-cyan-300 mt-1 bg-slate-900/80 px-1 rounded whitespace-nowrap">{task.title.substring(0,10)}</span>
                 {task.status === 'DOING' && (
                   <div className="w-12 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                     <div className="h-full bg-emerald-500" style={{ width: `${task.progress}%` }}></div>
                   </div>
                 )}
              </div>
            ))}

            {/* Agenti */}
            {Object.values(state.agents).map(agent => (
              <div
                key={agent.id}
                className="absolute flex flex-col items-center justify-center transition-transform duration-[50ms] ease-linear z-10"
                style={{ transform: `translate(${agent.position.x - 16}px, ${agent.position.y - 16}px)` }}
              >
                {agent.thoughtBubble && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-[9px] px-2 py-0.5 rounded shadow-xl font-bold whitespace-nowrap z-20 animate-in fade-in zoom-in duration-200">
                    {agent.thoughtBubble}
                  </div>
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-slate-800 ${agent.color} relative group`}>
                  {agent.icon}
                  {agent.state === 'WORKING' && <div className="absolute -right-1 -top-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></div>}
                </div>
                <div className="mt-1 bg-slate-900/90 px-1.5 py-[2px] rounded text-[8px] font-black tracking-widest uppercase border border-slate-700">
                  {agent.name}
                </div>
              </div>
            ))}
          </div>

          {/* Telemetria Agenti */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-black/20">
            {Object.values(state.agents).map(agent => (
              <div key={agent.id} className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-base drop-shadow-md">{agent.icon}</span>
                    <div>
                      <div className="font-bold text-[11px] text-slate-200 uppercase">{agent.name}</div>
                      <div className="text-[9px] text-slate-500">{agent.role}</div>
                    </div>
                  </div>
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    agent.state === 'WORKING' ? 'bg-emerald-500/20 text-emerald-400' :
                    agent.state === 'WALKING' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {agent.state}
                  </span>
                </div>
                {agent.currentTaskId && state.tasks[agent.currentTaskId] && (
                  <div className="text-[9px] bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-400 flex justify-between items-center">
                    <span className="truncate">Task: {state.tasks[agent.currentTaskId].title}</span>
                    <span className="font-mono text-emerald-500">{Math.round(state.tasks[agent.currentTaskId].progress)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE COLUMN: KANBAN BOARD */}
        <div className="flex-1 flex flex-col border-r border-slate-800 bg-[#0a0f1a]">
          <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center gap-2">
            <LayoutKanban className="text-emerald-400" size={16} />
            <h2 className="font-bold tracking-widest uppercase text-[10px] text-emerald-50">Task Layer (Auto-Assegnazione)</h2>
          </div>

          <div className="flex-1 p-4 grid grid-cols-3 gap-4 overflow-hidden">
            {(['TODO', 'DOING', 'DONE'] as TaskStatus[]).map(status => (
              <div key={status} className="flex flex-col bg-slate-900/30 rounded-xl border border-slate-800/50 overflow-hidden">
                <div className="p-2.5 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50">
                  <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{status}</h3>
                  <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                    {Object.values(state.tasks).filter(t => t.status === status).length}
                  </span>
                </div>

                <div className="flex-1 p-2 overflow-y-auto space-y-2">
                  {Object.values(state.tasks).filter(t => t.status === status).map(task => (
                    <div key={task.id} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors relative overflow-hidden group">
                      {status === 'DOING' && (
                        <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/50 transition-all duration-300" style={{ width: `${task.progress}%` }}></div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[8px] font-mono text-purple-400 bg-purple-900/30 px-1 rounded uppercase">Prio {task.priority}</span>
                        {task.assignedTo && state.agents[task.assignedTo] && (
                          <span className="text-sm drop-shadow-md" title={state.agents[task.assignedTo].name}>{state.agents[task.assignedTo].icon}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-[11px] text-slate-200 mb-1">{task.title}</h4>
                      <p className="text-[9px] text-slate-400 line-clamp-2">{task.description}</p>
                    </div>
                  ))}
                  {Object.values(state.tasks).filter(t => t.status === status).length === 0 && (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-600 italic border-2 border-dashed border-slate-800 rounded-lg m-2">Nessun task</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: COGNITIVE LOGS */}
        <div className="w-[300px] flex flex-col bg-slate-900/20">
          <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center gap-2">
            <Brain className="text-purple-400" size={16} />
            <h2 className="font-bold tracking-widest uppercase text-[10px] text-purple-50">Log Cognitivi & Eventi</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {state.logs.map(log => (
              <div key={log.id} className={`p-2.5 rounded-lg border text-sm ${
                log.isAI ? 'bg-purple-900/10 border-purple-500/20' : 'bg-cyan-900/10 border-cyan-500/20'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${
                    log.isAI ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
                  }`}>
                    {log.type.replace('_', ' ')}
                  </span>
                  <span className="text-[8px] font-mono text-slate-500">{log.createdAt}</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">{log.message}</p>
              </div>
            ))}
            {state.logs.length === 0 && (
              <div className="text-[10px] text-slate-600 italic text-center mt-10 flex flex-col items-center gap-2">
                <Sparkles size={24} className="text-slate-700" />
                Invia un comando a Zeus per iniziare.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
