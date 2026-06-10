import React, { useState, useEffect } from 'react';
import { Sparkles, Video, Settings, Flame, Moon, Compass, Menu, Laptop, Heart, Info, AlertTriangle, Key } from 'lucide-react';
import UploadStage from './components/UploadStage';
import ClipDashboard from './components/ClipDashboard';
import RecentProjectsSidebar from './components/RecentProjectsSidebar';
import { Project, SubtitleStylePreset, ViralClip } from './types';
import { PRESET_CLIPS, SUBTITLE_STYLE_PRESETS, generateWordsFromText } from './utils/videoPresets';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [recentProjects, setRecentProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('playsquad-recent-projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not load recent projects:", e);
    }
    // Seed high-fidelity, high-performance preset projects
    return [
      {
        id: 'p-seed-deepwork',
        title: 'O Segredo das Duas Primeiras Horas',
        originalVideoName: 'deep-work.mp4 (Demo Premium)',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-explaining-something-with-hand-gestures-42289-large.mp4',
        duration: 80,
        status: 'completed',
        clips: PRESET_CLIPS['deep-work'],
        selectedClipId: PRESET_CLIPS['deep-work']?.[0]?.id,
        subtitleStyle: SUBTITLE_STYLE_PRESETS[0], // Hormozi
        aspectRatio: '9:16',
        createdAt: new Date('2026-06-08T18:00:00Z').toISOString()
      },
      {
        id: 'p-seed-successcost',
        title: 'Empreendedorismo vs Amadorismo',
        originalVideoName: 'success-cost.mp4 (Demo Premium)',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-businessman-gesticulating-during-a-speech-41007-large.mp4',
        duration: 75,
        status: 'completed',
        clips: PRESET_CLIPS['success-cost'],
        selectedClipId: PRESET_CLIPS['success-cost']?.[0]?.id,
        subtitleStyle: SUBTITLE_STYLE_PRESETS[2], // MrBeast
        aspectRatio: '9:16',
        createdAt: new Date('2026-06-08T15:30:00Z').toISOString()
      }
    ] as Project[];
  });
  const [apiStatus, setApiStatus] = useState<{ alive: boolean; geminiConfigured: boolean }>({
    alive: false,
    geminiConfigured: false
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize active project to the recent list whenever it reaches 'completed' or is updated!
  useEffect(() => {
    if (project && project.status === 'completed') {
      setRecentProjects((prev) => {
        const index = prev.findIndex(p => p.id === project.id);
        if (index !== -1) {
          if (JSON.stringify(prev[index]) === JSON.stringify(project)) {
            return prev;
          }
          const updated = [...prev];
          updated[index] = project;
          try {
            localStorage.setItem('playsquad-recent-projects', JSON.stringify(updated));
          } catch (e) {
            console.warn("Could not save recent projects list:", e);
          }
          return updated;
        } else {
          const newRecent = [project, ...prev];
          try {
            localStorage.setItem('playsquad-recent-projects', JSON.stringify(newRecent));
          } catch (e) {
            console.warn("Could not save recent projects list:", e);
          }
          return newRecent;
        }
      });
    }
  }, [project]);

  const handleDeleteProject = (id: string) => {
    if (project && project.id === id) {
      setProject(null);
    }
    setRecentProjects((prev) => {
      const filtered = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('playsquad-recent-projects', JSON.stringify(filtered));
      } catch (e) {
        console.warn("Could not delete project from list:", e);
      }
      return filtered;
    });
  };

  // Check API status & secret key configuration on startup
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        setApiStatus({
          alive: data.status === 'alive',
          geminiConfigured: data.geminiConfigured
        });
      })
      .catch((err) => {
        console.warn("Could not reach background API health route - probably running in static client mode:", err);
      });
  }, []);

  // Handle analytical post route to get dynamic clip suggestions word-by-word
  const handleStartAnalysis = async (params: {
    title: string;
    transcript: string;
    originalFileName: string;
    customPrompt: string;
    stylePreset: SubtitleStylePreset;
    videoUrl?: string;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    // Initial draft project setup
    const draftProject: Project = {
      id: `p-${Date.now()}`,
      title: params.title,
      originalVideoName: params.originalFileName,
      videoUrl: params.videoUrl || '',
      duration: 60,
      status: 'analyzing',
      subtitleStyle: params.stylePreset,
      aspectRatio: '9:16',
      createdAt: new Date().toISOString()
    };
    
    setProject(draftProject);

    // Check if the uploaded file/input matches a preset to offer fast onboarding
    const matchedPresetKey = Object.keys(PRESET_CLIPS).find(
      key => params.originalFileName.includes(key) || params.title.toLowerCase().includes(key.replace('-', ' '))
    );

    if (matchedPresetKey) {
      // Simulate real delay for effect then load high-fidelity prebuilt clips!
      setTimeout(() => {
        const prebuiltClips = PRESET_CLIPS[matchedPresetKey];
        const completedProject: Project = {
          ...draftProject,
          status: 'completed',
          clips: prebuiltClips,
          selectedClipId: prebuiltClips[0]?.id
        };
        setProject(completedProject);
        setIsLoading(false);
      }, 2500);
      return;
    }

    // Otherwise, call actual background server route
    try {
      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          originalFileName: params.originalFileName,
          transcript: params.transcript || "Roteiro promocional sobre crescimento e mentalidade de foco.",
          customPrompt: params.customPrompt,
          stylePresetName: params.stylePreset.name
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Falha na resposta do servidor.");
      }

      const completedProject: Project = {
        ...draftProject,
        status: 'completed',
        clips: data.clips,
        selectedClipId: data.clips[0]?.id
      };
      setProject(completedProject);

    } catch (err: any) {
      console.warn("API Error caught, falling back to dynamic simulated generation:", err);
      
      // Let's generate nice smart random fallback clips immediately so the app never hangs cold!
      const fallbackTopic = params.title || "Marketing & Vendas no Digital";
      const fallbackTranscript = params.transcript || "Esta é uma demonstração de legenda gerada automaticamente com ganchos de alta retenção produzidos por algoritmos de engajamento do TikTok e Instagram.";
      
      setTimeout(() => {
        const fallbacks: ViralClip[] = [
          {
            id: 'fb-clip-1',
            title: `Sacada de Ouro: ${fallbackTopic.split(' ')[0]}`,
            start: 0,
            end: 25,
            duration: 25,
            viralScore: 92,
            viralityReason: 'Gancho voltado para resolução de problemas e mistério implícito sobre estratégias de crescimento acelerado.',
            hook: 'Se você realmente quer crescer este ano, pare de seguir a manada.',
            suggestedTitle: `${fallbackTopic} Revelado! 🤫📈`,
            suggestedDescription: 'O segredo mais bem guardado do mercado digital explicado em menos de 1 minuto.',
            tags: ['cortes', 'marketing', 'sucesso', 'viralizar', 'shorts', 'reels'],
            captions: generateWordsFromText(fallbackTranscript.slice(0, 150), 0)
          },
          {
            id: 'fb-clip-2',
            title: 'O Erro Oculto que de Detona',
            start: 25,
            end: 50,
            duration: 25,
            viralScore: 87,
            viralityReason: 'Usa a técnica de aversão à perda, incentivando o público a ver o clipe inteiro para descobrir do que se proteger.',
            hook: 'A maioria comete este exato erro todos os dias...',
            suggestedTitle: 'PARE de fazer isso agora mesmo! 🚫🤯',
            suggestedDescription: 'Descubra como pequenos detalhes estão sabotando seu engajamento diário.',
            tags: ['erro', 'correcao', 'dica', 'mindset', 'negocios', 'desenvolvimento'],
            captions: generateWordsFromText(fallbackTranscript.slice(50, 180), 25)
          }
        ];

        const fallbackProject: Project = {
          ...draftProject,
          status: 'completed',
          clips: fallbacks,
          selectedClipId: fallbacks[0].id
        };
        
        setProject(fallbackProject);
        
        // Show non-blocking feedback warning about missing API configuration
        setErrorMessage(
          err.message?.includes('GEMINI_API_KEY') 
            ? "💡 Rodando em Modo Simulado: adicione sua 'GEMINI_API_KEY' na aba Secrets do AI Studio para usar inteligência artificial real nos seus próprios vídeos e roteiros personalizados!"
            : `💡 Modo Simulado de Demonstração ativado. [Motivo: ${err.message}]`
        );
        
      }, 3000);
      
    } finally {
      setIsLoading(false);
    }
  };

  // Re-run segment search via customize text/tags
  const handleRefineClips = async (promptText: string, activeStyle: SubtitleStylePreset, hookIntensity: number = 75) => {
    if (!project) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          originalFileName: project.originalVideoName,
          transcript: "Roteiro alternativo de alta energia contendo dicas extras de vendas, mindset milionário e foco implacável.",
          customPrompt: promptText,
          stylePresetName: activeStyle.name,
          hookIntensity
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível refinar os cortes.");
      }

      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'completed',
          clips: data.clips,
          selectedClipId: data.clips[0]?.id
        };
      });

    } catch (err: any) {
      console.warn("Refining error fallback:", err);
      // Fallback with a mock refresh sequence
      alert("Refinando através de simulação local: Seus novos clipes já foram atualizados com o novo parâmetro da IA!");
      
      const newClips: ViralClip[] = [
        {
          id: 'ref-clip-1',
          title: 'A Nova Sacada Oculta',
          start: 0,
          end: 22,
          duration: 22,
          viralScore: 98,
          viralityReason: 'Re-fatiado especificando ganchos emocionais refinados com altíssimo índice de retenção.',
          hook: 'Ninguém tem coragem de te dizer isto, mas eu vou falar.',
          suggestedTitle: 'O segredo mais polêmico sobre escalar negócios 🤫🔥',
          suggestedDescription: 'Fale a verdade de frente e veja suas conversões decolarem absurdamente.',
          tags: ['polemica', 'mentiras', 'marketing', 'sucesso', 'retencao'],
          captions: generateWordsFromText(
            "Se você quer expandir de verdade, você precisa parar de agradar a todos no seu nicho. Quem tenta falar com todo mundo, acaba não falando com ninguém! Tome uma decisão polarizante hoje de noite.",
            0
          )
        }
      ];

      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          clips: newClips,
          selectedClipId: newClips[0].id
        };
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="main-app" className="min-h-screen bg-[#030304] bg-grid-cyber text-slate-100 flex flex-col font-sans selection:bg-lime-500/30 selection:text-lime-205">
      
      {/* Dynamic Floating Subtitle alert if configuring */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-purple-950 border-b border-purple-550/30 text-purple-200 text-xs px-4 py-3 text-center flex items-center justify-center space-x-2 relative z-50 shadow-lg"
          >
            <Key className="w-4 h-4 text-lime-400 flex-shrink-0 animate-bounce" />
            <span className="font-medium text-slate-200">{errorMessage}</span>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="underline text-[10px] hover:text-white ml-4 font-bold border border-purple-500/20 px-2 py-0.5 rounded cursor-pointer transition hover:bg-purple-900/30"
            >
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Navbar Header: Pure PLAYsquad Visual Vibe */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-18 flex items-center justify-between">
          
          {/* PLAYsquad Branded Logo */}
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="p-2.5 bg-gradient-to-br from-indigo-550 via-purple-600 to-pink-500 rounded-xl shadow-lg ring-1 ring-purple-400/20 flex items-center justify-center transition group-hover:scale-105">
              <Flame className="w-5 h-5 text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.7)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display font-black text-white tracking-tight text-xl">
                  PLAY<span className="text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.45)]">squad</span>
                </span>
                <span className="text-[9px] font-mono bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-black text-purple-300 uppercase tracking-widest">
                  AI CO-PILOT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider font-medium">Clips AI • Renderizador Automático</p>
            </div>
          </div>

          {/* Center Navigation placeholder (Pure look aesthetic) */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold uppercase tracking-wider text-slate-450">
            <a href="#dashboard" className="text-lime-400 hover:text-white transition flex items-center gap-1.5 font-display">
              <Compass className="w-3.5 h-3.5" /> Clips AI Creator
            </a>
          </nav>

          {/* Quick system status */}
          <div className="flex items-center space-x-3">
            {/* Mobile History Toggle Drawer Button */}
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="lg:hidden p-2.5 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-300 hover:text-white transition flex items-center gap-1.5 border border-slate-800 cursor-pointer"
              title="Histórico de Projetos"
            >
              <Menu className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-wider font-mono">Projetos</span>
            </button>

            <div className="hidden sm:flex items-center space-x-2.5 px-3 py-1.5 bg-slate-900/80 border border-slate-850 rounded-xl text-[10px] text-slate-400 font-medium">
              <span className={`w-2 h-2 rounded-full ${apiStatus.geminiConfigured ? 'bg-lime-400 animate-pulse shadow-[0_0_6px_rgba(163,230,53,0.8)]' : 'bg-purple-400'}`}></span>
              <span>Motor Gemini: <strong className={apiStatus.geminiConfigured ? 'text-lime-400' : 'text-purple-300'}>{apiStatus.geminiConfigured ? 'Premium' : 'Simulado'}</strong></span>
            </div>
            <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 py-1.5 px-3 rounded-xl">
              v2.5.0
            </span>
          </div>

        </div>
      </header>

      {/* Side-by-Side Workspace Layout Wrapper */}
      <div className="flex-1 flex flex-row min-h-0 relative">
        <RecentProjectsSidebar
          projects={recentProjects}
          activeProjectId={project?.id}
          onSelectProject={setProject}
          onDeleteProject={handleDeleteProject}
          onNewProject={() => setProject(null)}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
          {/* Main Container Hero / Playground view */}
          <main className="flex-1 py-10 relative">
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[380px] h-[380px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
            <div className="absolute top-40 left-1/3 -translate-x-1/2 w-[220px] h-[220px] bg-lime-500/3 rounded-full blur-[90px] pointer-events-none -z-10" />
            
            {/* Intro Hero Section (Dynamic conditional when no project loaded) */}
            {!project && (
              <div className="max-w-4xl mx-auto text-center px-4 mb-10 space-y-4">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-950/70 to-slate-900/90 border border-purple-500/20 rounded-full px-4 py-1.5 text-xs text-purple-300 font-bold mb-2 shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5 text-lime-400 animate-spin" />
                  <span>Multiplique sua produção de conteúdo em 12x com Inteligência Artificial</span>
                </motion.div>
                
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none font-display">
                  Vire Vídeos Longos em <span className="bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(163,230,53,0.15)]">Clipes Virais 9:16</span> em 1-Clique
                </h1>
                
                <p className="text-xs md:text-[13px] text-slate-450 max-w-2xl mx-auto leading-relaxed font-medium">
                  A ferramenta definitiva de clipes inteligentes rápida e prática. O algoritmo analisa picos vocais, seleciona os hooks com maior pontuação de engajamento e gera legendas animadas em estilos de alta retenção (Alex Hormozi, MrBeast, entre outros).
                </p>
              </div>
            )}

            {/* Workspace Switcher Component Wrapper */}
            <AnimatePresence mode="wait">
              {!project || project.status === 'analyzing' ? (
                <motion.div
                  key="stage"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <UploadStage 
                    onStartAnalysis={handleStartAnalysis} 
                    isLoading={isLoading} 
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ClipDashboard 
                    project={project} 
                    onBack={() => setProject(null)}
                    onUpdateProject={setProject}
                    onRefineClips={handleRefineClips}
                    isRefining={isLoading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

          </main>

          {/* Modern styled margin aesthetic signature */}
          <footer className="border-t border-slate-900 bg-slate-950/40 py-8 text-center text-xs text-slate-500 space-y-3.5 select-none font-medium">
            <p className="flex items-center justify-center gap-2 font-mono text-[10px] text-slate-450 uppercase tracking-widest">
              <Laptop className="w-4 h-4 text-lime-400" />
              <span>PLAYsquad Clíper AI • A escolha definitiva dos top criadores de conteúdo</span>
            </p>
            <p className="text-[10px] text-slate-600 max-w-md mx-auto leading-relaxed">
              Sincronização vocálica imediata em frames com renderização de legendas dinâmicas coloridas de altíssima conversão. Todos os direitos reservados.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
