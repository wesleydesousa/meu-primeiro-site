import React from 'react';
import { 
  History, Plus, Trash2, Folder, Video, Clock, 
  ChevronLeft, ChevronRight, X, Sparkles, Film, CheckCircle2 
} from 'lucide-react';
import { Project } from '../types';
import { motion } from 'motion/react';

interface RecentProjectsSidebarProps {
  projects: Project[];
  activeProjectId?: string;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function RecentProjectsSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onNewProject,
  isOpen,
  setIsOpen
}: RecentProjectsSidebarProps) {
  return (
    <>
      {/* Mobile absolute overlay drawer backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <div 
        id="recent-projects-sidebar"
        className={`fixed inset-y-0 left-0 z-45 lg:relative flex flex-col h-full bg-[#07070a] border-r border-slate-900 transition-all duration-300 ease-in-out ${
          isOpen ? 'w-[280px] translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Toggle Collapse Button for desktop */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden lg:flex absolute top-5 -right-3.5 z-50 w-7 h-7 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-full items-center justify-center cursor-pointer transition shadow-xl"
          title={isOpen ? "Recolher barra lateral" : "Expandir barra lateral"}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Top Header Section */}
        <div className="p-4 border-b border-slate-900 flex items-center justify-between min-h-[4.5rem]">
          {isOpen ? (
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-650/10 border border-indigo-550/20 text-indigo-400 rounded-lg">
                <History className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-250 font-mono">
                  Seus Projetos
                </h3>
                <p className="text-[9px] text-slate-500 font-medium font-sans">Histórico de edições</p>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <History className="w-5 h-5 text-emerald-400 animate-pulse" title="Visualizar Projetos" />
            </div>
          )}

          {/* Close button for Mobile only */}
          {isOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Button: NEW PROJECT */}
        <div className="p-3">
          {isOpen ? (
            <button
              type="button"
              onClick={() => {
                onNewProject();
                // Close drawer on mobile if clicked
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 hover:brightness-110 text-slate-950 font-display font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2 transition duration-150 cursor-pointer shadow-lg active:scale-98"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Novo Projeto</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNewProject}
              className="w-10 h-10 mx-auto bg-gradient-to-br from-lime-400 to-emerald-400 text-slate-950 rounded-xl flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95 cursor-pointer"
              title="Iniciar Novo Projeto"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation History List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-900">
          {isOpen ? (
            projects.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-2">
                <Folder className="w-8 h-8 text-slate-800 mx-auto" />
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Histórico Vazio</p>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Seus projetos concluídos e simulações aparecerão armazenados aqui automaticamente!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5Packed">
                <p className="text-[8.5px] font-black text-slate-550 uppercase tracking-wider px-2 mb-2 font-mono">
                  Recentes ({projects.length})
                </p>
                
                {projects.map((proj) => {
                  const isActive = proj.id === activeProjectId;
                  const isSeed = proj.id.startsWith('p-seed-');
                  const clipsCount = proj.clips?.length || 0;
                  
                  return (
                    <div 
                      key={proj.id}
                      className={`group relative flex items-center justify-between p-2 rounded-xl border transition-all duration-200 select-none ${
                        isActive
                          ? 'bg-indigo-950/30 border-indigo-500/40 text-white shadow-[0_0_15px_rgba(99,102,241,0.08)]'
                          : 'bg-slate-950/30 border-transparent hover:bg-slate-900/50 hover:border-slate-850 text-slate-400'
                      }`}
                    >
                      {/* Left click area to activate project selection */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(proj);
                          if (window.innerWidth < 1024) setIsOpen(false);
                        }}
                        className="flex-1 text-left flex gap-2.5 items-start min-w-0 cursor-pointer"
                      >
                        <div className={`p-1.5 rounded-lg border flex-shrink-0 mt-0.5 ${
                          isActive 
                            ? 'bg-indigo-600/15 border-indigo-500/20 text-indigo-400 animate-pulse' 
                            : 'bg-slate-900 border-slate-850 text-slate-400 group-hover:text-slate-300'
                        }`}>
                          <Film className="w-3.5 h-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className={`text-[10.5px] font-bold leading-tight truncate ${
                            isActive ? 'text-lime-400' : 'text-slate-200 group-hover:text-white'
                          }`}>
                            {proj.title}
                          </h4>
                          
                          <p className="text-[9px] text-slate-450 truncate mt-0.5" title={proj.originalVideoName}>
                            {proj.originalVideoName}
                          </p>

                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[8px] font-mono font-bold uppercase text-slate-500 bg-slate-900/80 px-1 py-0.5 rounded border border-slate-850/60 break-all leading-none inline-flex items-center gap-0.5">
                              {isSeed ? (
                                <>
                                  <Sparkles className="w-2 h-2 text-yellow-400 animate-pulse" />
                                  <span>DEMO</span>
                                </>
                              ) : (
                                <span>IA RAW</span>
                              )}
                            </span>

                            <span className="text-[8px] font-mono text-slate-500 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                              {clipsCount} {clipsCount === 1 ? 'corte' : 'cortes'}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Right Delete Trigger button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(proj.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-400 transition text-slate-600 focus:opacity-100 cursor-pointer ml-1 self-start mt-0.5"
                        title="Remover do histórico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center space-y-3.5 py-4">
              {projects.map((proj) => {
                const isActive = proj.id === activeProjectId;
                return (
                  <button
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className={`p-2 rounded-lg border transition ${
                      isActive 
                        ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400' 
                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
                    }`}
                    title={`${proj.title} (${proj.clips?.length || 0} cortes)`}
                  >
                    <Film className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom stats/footer */}
        {isOpen && (
          <div className="p-3 border-t border-slate-900 bg-slate-950/20 text-center space-y-1.5">
            <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-500">
              <span>PROJETOS DA SESSÃO</span>
              <span className="font-bold text-slate-400">{projects.length}/10</span>
            </div>
            <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (projects.length / 10) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
