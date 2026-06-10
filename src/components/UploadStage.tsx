import React, { useState, useRef } from 'react';
import { Upload, FileVideo, Sparkles, AlertCircle, Play, CheckCircle2, ChevronRight, MessageSquareCode } from 'lucide-react';
import { VIDEO_PRESETS, SUBTITLE_STYLE_PRESETS } from '../utils/videoPresets';
import { VideoPreset, SubtitleStylePreset } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface UploadStageProps {
  onStartAnalysis: (params: {
    title: string;
    transcript: string;
    originalFileName: string;
    customPrompt: string;
    stylePreset: SubtitleStylePreset;
    videoUrl?: string;
  }) => void;
  isLoading: boolean;
}

export default function UploadStage({ onStartAnalysis, isLoading }: UploadStageProps) {
  const [videoTitle, setVideoTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('Procure ganchos de alta retenção, use emojis engraçados e quebre frases grandes.');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<string>('hormozi');
  
  // Custom file upload state that holds the file and its object URL
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; file?: File; videoUrl?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      // Create a blob URL to render the uploaded video in real-time in the workspace!
      const objectUrl = URL.createObjectURL(file);
      setUploadedFile({ name: file.name, size: `${sizeMB} MB`, file, videoUrl: objectUrl });
      if (!videoTitle) {
        setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      // Create a blob URL to render the uploaded video in real-time in the workspace!
      const objectUrl = URL.createObjectURL(file);
      setUploadedFile({ name: file.name, size: `${sizeMB} MB`, file, videoUrl: objectUrl });
      if (!videoTitle) {
        setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Select a preset video to populate immediately
  const handleSelectPreset = (preset: VideoPreset) => {
    setSelectedPresetId(preset.id);
    setVideoTitle(preset.title);
    setTranscriptText(preset.transcript);
    setUploadedFile({ name: `${preset.id}.mp4 (Preset Premium)`, size: '42.5 MB', videoUrl: preset.videoUrl });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stylePreset = SUBTITLE_STYLE_PRESETS.find(p => p.id === selectedStylePresetId) || SUBTITLE_STYLE_PRESETS[0];
    onStartAnalysis({
      title: videoTitle || "Meu Vídeo Viral",
      transcript: transcriptText,
      originalFileName: uploadedFile ? uploadedFile.name : "upload_video.mp4",
      customPrompt,
      stylePreset,
      videoUrl: uploadedFile ? uploadedFile.videoUrl : ""
    });
  };

  return (
    <div id="upload-stage-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-100 max-w-7xl mx-auto px-4 py-6">
      {/* Flight Left: Configuration Form */}
      <div className="lg:col-span-7 bg-slate-950/80 border border-slate-850 rounded-2xl p-6 shadow-3xl space-y-6 relative overflow-hidden">
        {/* Decorative thin blur spot inside card */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/3 rounded-full blur-[40px] pointer-events-none" />
        
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-850/80">
          <div className="p-2.5 bg-purple-550/10 rounded-xl text-lime-400 border border-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 drop-shadow-[0_0_5px_rgba(163,230,53,0.5)] animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black font-display text-white tracking-tight uppercase text-xs">Criar Novo Projeto Viral</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Carregue ou selecione uma demo para fatiar seus clipes instantaneamente com IA.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Up file or URL */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest font-display">Passo 1: Enviar Vídeo de Origem</label>
            
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragActive 
                  ? 'border-lime-400 bg-lime-950/20 neon-glow-lime' 
                  : uploadedFile 
                    ? 'border-lime-500/50 bg-lime-950/10 shadow-[0_0_15px_rgba(163,230,53,0.06)]' 
                    : 'border-slate-850 hover:border-purple-550/40 bg-slate-900/20'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="video/*, .mp4, .mov, .avi, .mkv, .webm, .m4v, .3gp, .flv, .mpeg, .mpg, .wmv, .ogv, .ts, .mts, .m2ts, .asf, .vob" 
                className="hidden" 
              />
              
              <AnimatePresence mode="wait">
                {uploadedFile ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center space-y-2 text-lime-400"
                  >
                    <CheckCircle2 className="w-10 h-10 text-lime-400 drop-shadow-[0_0_5px_rgba(163,230,53,0.4)]" />
                    <span className="font-bold text-slate-100 text-sm max-w-[280px] truncate">{uploadedFile.name}</span>
                    <span className="text-[10px] text-slate-450 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-850">{uploadedFile.size}</span>
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                        setSelectedPresetId('');
                      }} 
                      className="mt-2 text-xs text-red-400 font-bold hover:underline hover:text-red-300 cursor-pointer"
                    >
                      Remover arquivo
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl text-slate-400">
                      <Upload className="w-5 h-5 text-lime-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">Arraste seu vídeo aqui ou clique para selecionar</p>
                      <p className="text-[10px] text-slate-500 mt-1">MP4, MOV ou WebM (Simulado - Processamento nativo em background)</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Preset Demos Quick Pick */}
          <div className="bg-slate-950/80 p-5 border border-slate-850/80 rounded-xl space-y-3.5 shadow-inner">
            <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest font-display">🎬 Teste Prático Onboarding (Demos Premium Rápidas):</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VIDEO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex flex-col justify-between text-left p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'bg-purple-950/30 border-lime-400/80 text-white shadow-[0_0_15px_rgba(163,230,53,0.1)] ring-1 ring-lime-400/30'
                      : 'bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  <span className="font-bold text-slate-200 line-clamp-1">{preset.title.split(' (')[0]}</span>
                  <span className="text-[9px] text-slate-500 mt-1.5 font-mono font-bold uppercase tracking-wider">🎙️ {preset.speaker}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs Section */}
          <div className="space-y-4">
            <div>
              <label htmlFor="video-title-input" className="block text-[10px] font-black text-slate-450 uppercase tracking-widest font-display mb-2">
                Título do Vídeo ou Campanha
              </label>
              <input
                id="video-title-input"
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Exemplo: Cortes do Bilionário Hormozi"
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-xl py-3 px-3 text-slate-100 font-semibold focus:outline-none focus:border-purple-550 transition shadow-inner placeholder:text-slate-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label htmlFor="transcript-input" className="block text-[10px] font-black text-slate-450 uppercase tracking-widest font-display">
                  Transcrição do Áudio (Opcional)
                </label>
                <div className="flex items-center space-x-1 text-[9px] text-lime-400 font-black uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" />
                  <span>A IA gera caso fique vago</span>
                </div>
              </div>
              <textarea
                id="transcript-input"
                rows={4}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Cole a transcrição do áudio aqui caso queira cortar um vídeo original... Ou simplesmente deixe em branco para simularmos uma transcrição dinâmica por Inteligência Artificial!"
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-xl p-3.5 text-slate-300 focus:outline-none focus:border-purple-550 font-sans leading-relaxed transition shadow-inner placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Step 2: Choose Captain Styles */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest font-display block">Passo 2: Estilos Premium de Legendagem</label>
            <div className="grid grid-cols-2 gap-3">
              {SUBTITLE_STYLE_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => setSelectedStylePresetId(preset.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedStylePresetId === preset.id
                      ? 'border-purple-550 bg-gradient-to-br from-purple-950/40 to-slate-950 shadow-[0_0_18px_rgba(139,92,246,0.18)]'
                      : 'bg-slate-950 border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-slate-100 uppercase tracking-wider font-display">{preset.name}</span>
                    <input 
                      type="radio" 
                      name="style-group" 
                      checked={selectedStylePresetId === preset.id}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 text-lime-400 bg-slate-900 border-slate-800 accent-lime-450"
                    />
                  </div>
                  
                  {/* Miniature text preview */}
                  <div className="text-[10px] bg-slate-905 p-2 rounded-lg border border-slate-850 flex items-center justify-center h-8 font-mono select-none">
                    <span style={{ 
                      fontFamily: preset.fontFamily,
                      color: preset.primaryColor,
                      fontSize: '11px',
                      textShadow: preset.textShadow,
                      textTransform: preset.uppercase ? 'uppercase' : 'none'
                    }}>
                      CRIE CLIPS <span style={{ color: preset.accentColor }}>VIRAIS</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced prompt customizer */}
          <div>
            <label htmlFor="custom-prompt-input" className="block text-[10px] font-black text-slate-450 uppercase tracking-widest font-display mb-2">
              🧠 Diretivas de IA (Custom Prompt)
            </label>
            <input
              id="custom-prompt-input"
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-xl py-3 px-3 text-slate-400 focus:outline-none focus:border-purple-555 placeholder:text-slate-600"
            />
          </div>

          {/* Submit Action - PLAYsquad High Energy Glow Button */}
          <button
            type="submit"
            disabled={isLoading || (!videoTitle && !uploadedFile)}
            className="w-full py-4 px-5 bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 text-slate-950 font-display font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2.5 transition duration-155 cursor-pointer shadow-lg hover:shadow-lime-400/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30 disabled:pointer-events-none"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processando Vídeo em Alta Frequência...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950 animate-bounce" />
                <span>Cortar Clipes e Gerar Legendas Virais (IA)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Flight Right: Feature Showcase & Instructional Tips */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
        <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-6 shadow-3xl flex-1 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/1 rounded-full blur-[40px] pointer-events-none" />
          
          <div>
            <h3 className="text-lg font-black font-display text-white uppercase text-xs flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-lime-400 animate-pulse" />
              Como a IA encontra clipes virais?
            </h3>
            <p className="text-[11px] text-slate-400 mt-2">
              Nossa tecnologia faz a mesma triagem que as grandes agências de conteúdo, analisando a psicologia do espectador:
            </p>

            <div className="space-y-4 mt-6">
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-lime-450/10 text-lime-400 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 border border-lime-450/20 font-mono">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Ganchos de Ultra-Retenção (Hook)</h4>
                  <p className="text-[11px] text-slate-450 mt-0.5">Captura imediata de retenção através de declarações fortes, polêmicas ou paradoxos.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 bg-lime-450/10 text-lime-400 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 border border-lime-450/20 font-mono">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Reframing 9:16 Inteligente</h4>
                  <p className="text-[11px] text-slate-450 mt-0.5">Encorpora o locutor no centro do vídeo 9:16 gerando cortes focados e prontos para publicar.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 bg-lime-450/10 text-lime-400 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 border border-lime-450/20 font-mono">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Legendas Estilo CapCut Pro</h4>
                  <p className="text-[11px] text-slate-450 mt-0.5">Frases divididas com picos de cores de alto contraste para prender 100% da retenção.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-850/80 space-y-3">
            <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest font-display">📊 Métricas Previstas de Viralidade</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-850">
                <p className="text-xl font-black font-mono text-lime-450 text-glow-lime">+185%</p>
                <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">Retenção Estimada</p>
              </div>
              <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-850">
                <p className="text-xl font-black font-mono text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">4X Mais</p>
                <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">Compartilhamentos</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Tips Box */}
        <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 flex gap-3 text-slate-400 shadow-lg">
          <MessageSquareCode className="w-5 h-5 text-lime-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-450">
            <strong className="text-slate-350">Dica do Creator:</strong> Caso não tenha um vídeo em mãos, aproveite uma de nossas <strong className="text-lime-400">Demos Premium</strong> acima para ver como o algoritmo auto-vocal funciona imediatamente!
          </p>
        </div>
      </div>
    </div>
  );
}
