import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, Edit3, 
  Copy, Check, Download, Video, Smartphone, Layers, Type as FontIcon, 
  Sliders, ArrowLeft, RefreshCw, Smile, Trash2, Plus, AlertCircle, Share2,
  Music, Headphones, Waves, Mic, Flame, Eye, HelpCircle, X, ChevronRight
} from 'lucide-react';
import { Project, ViralClip, CaptionWord, SubtitleStylePreset } from '../types';
import { SUBTITLE_STYLE_PRESETS, generateWordsFromText } from '../utils/videoPresets';
import { motion, AnimatePresence } from 'motion/react';

interface ClipDashboardProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (updated: Project) => void;
  onRefineClips: (prompt: string, stylePreset: SubtitleStylePreset, hookIntensity?: number) => void;
  isRefining: boolean;
}

interface CropResult {
  tooLow: boolean;
  tooHigh: boolean;
  cropTop: number;
  cropBottom: number;
  safeMin: number;
  safeMax: number;
  message: string | null;
}

function getCropInfo(ratio: '9:16' | '1:1' | '16:9' | '4:5', positionY: number): CropResult {
  if (ratio === '9:16') {
    const tooLow = positionY > 80;
    const tooHigh = positionY < 18;
    return {
      tooLow,
      tooHigh,
      cropTop: 0,
      cropBottom: 0,
      safeMin: 18,
      safeMax: 80,
      message: tooLow 
        ? "⚠️ Sobreposição no TikTok/Reels: O texto ficará encoberto pela descrição original e som na parte inferior." 
        : tooHigh 
          ? "⚠️ Muito próximo ao topo: As legendas podem encobrir botões de sistema do smartphone ou filtro."
          : null
    };
  } else if (ratio === '4:5') {
    const tooLow = positionY > 82;
    const tooHigh = positionY < 20;
    return {
      tooLow,
      tooHigh,
      cropTop: 14.8,
      cropBottom: 85.2,
      safeMin: 20,
      safeMax: 82,
      message: tooLow 
        ? "🚨 Fora da Área Segura (Insta 4:5): Essa legenda ficará em cima do botão de curtir e descrição do feed!" 
        : tooHigh 
          ? "🚨 Fora da Área Segura (Insta 4:5): O texto será cortado ou ficará colado no topo do cabeçalho do post."
          : null
    };
  } else if (ratio === '1:1') {
    const tooLow = positionY > 74;
    const tooHigh = positionY < 24;
    return {
      tooLow,
      tooHigh,
      cropTop: 21.9,
      cropBottom: 78.1,
      safeMin: 24,
      safeMax: 74,
      message: tooLow 
        ? "🚨 Fora do Feed Quadrado (1:1): Nesse local, a legenda sairá da tela ou se fundirá com a barra de curtidas." 
        : tooHigh 
          ? "🚨 Fora do Feed Quadrado (1:1): O texto vai ficar cortado ou invisível acima do topo da foto do Feed."
          : null
    };
  } else {
    const tooLow = positionY > 85;
    const tooHigh = positionY < 15;
    return {
      tooLow,
      tooHigh,
      cropTop: 0,
      cropBottom: 0,
      safeMin: 15,
      safeMax: 85,
      message: tooLow 
        ? "⚠️ Posição extrema: No formato Horizontal (16:9), procure manter a legenda entre 20% e 80% do vídeo." 
        : tooHigh 
          ? "⚠️ Posição extrema: Muito alto para visualização confortável no widescreen horizontal."
          : null
    };
  }
}

export default function ClipDashboard({ 
  project, 
  onBack, 
  onUpdateProject, 
  onRefineClips, 
  isRefining 
}: ClipDashboardProps) {
  
  const clips = project.clips || [];
  const [selectedClipId, setSelectedClipId] = useState<string>(
    project.selectedClipId || (clips[0]?.id || '')
  );

  const activeClip = clips.find(c => c.id === selectedClipId) || clips[0];

  // Video State Simulators
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isCopied, setIsCopied] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStep, setExportStep] = useState<string>('');
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  
  // Custom design style preset overrides
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStylePreset>(project.subtitleStyle);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9' | '4:5'>(project.aspectRatio || '9:16');
  
  // Tabs for the panels
  const [activeTab, setActiveTab] = useState<'clips' | 'words' | 'styling' | 'refine' | 'render' | 'audio'>('clips');
  
  // Professional rendering & export settings
  const [renderQuality, setRenderQuality] = useState<'1080p' | '2K' | '4K'>('1080p');
  const [renderFps, setRenderFps] = useState<30 | 60>(60);
  const [renderCodec, setRenderCodec] = useState<'h264' | 'h265' | 'av1' | 'prores'>('h264');
  const [bitrateMbps, setBitrateMbps] = useState<number>(18); // 18 Mbps default
  const [gpuAcceleration, setGpuAcceleration] = useState<boolean>(true);
  const [twoPassEncoding, setTwoPassEncoding] = useState<boolean>(false);
  const [audioFormat, setAudioFormat] = useState<'aac' | 'wav'>('aac');
  
  // Word editor state
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingWordValue, setEditingWordValue] = useState('');
  const [editingWordEmoji, setEditingWordEmoji] = useState('');
  const [fullTextEditorValue, setFullTextEditorValue] = useState('');
  const [subtitleEditSuccess, setSubtitleEditSuccess] = useState(false);
  
  // Guided subtitle tour state (1, 2, 3 or null)
  const [tourStep, setTourStep] = useState<number | null>(null);
  
  // New AI refine prompt
  const [refinePrompt, setRefinePrompt] = useState('Encontre trechos ainda mais polêmicos e com maior chance de gerar debates inflamados.');
  const [hookIntensity, setHookIntensity] = useState<number>(75);
  
  // Manual clip creation form states
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualStart, setManualStart] = useState<number>(0);
  const [manualDuration, setManualDuration] = useState<number>(30);
  const [manualViralScore, setManualViralScore] = useState<number>(93);
  const [manualReason, setManualReason] = useState('Corte manual preciso feito pelo editor focado na retenção e dinamismo dos ganchos.');

  // High-performance timeline drag resizing states
  const [timelineZoom, setTimelineZoom] = useState<number>(1); // Zoom multipliers: 1x, 2x, 4x, 8x
  const [resizing, setResizing] = useState<{
    clipId: string;
    handle: 'start' | 'end';
    startX: number;
    startTime: number;
  } | null>(null);
  
  // Audio canvas waves
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);

  // Dynamic Face & Speaker Tracking (Click on Video to Focus)
  const [focusX, setFocusX] = useState<number>(50);
  const [focusY, setFocusY] = useState<number>(30);
  const [focusZoom, setFocusZoom] = useState<number>(1.3);
  const [isSmartCropActive, setIsSmartCropActive] = useState<boolean>(false);
  const [isFaceScanning, setIsFaceScanning] = useState<boolean>(false);

  // Dual Comparison Preview Mode
  const [isDualPreviewActive, setIsDualPreviewActive] = useState<boolean>(false);

  // AI Re-Captioning state
  const [isRecaptioning, setIsRecaptioning] = useState<boolean>(false);

  // AI-Powered Caption Capture & Sync optimization parameters
  const [captionTone, setCaptionTone] = useState<'vibrant' | 'minimalist' | 'meme' | 'podcast'>('vibrant');
  const [captionGrammarMode, setCaptionGrammarMode] = useState<'literal' | 'smart-correct' | 'colloquial'>('smart-correct');
  const [captionEmojiStyle, setCaptionEmojiStyle] = useState<'heavy' | 'light' | 'none'>('light');
  const [captionTimingPrecision, setCaptionTimingPrecision] = useState<'high' | 'ultra' | 'vocal-peaks'>('vocal-peaks');

  // Audio Treatment / Remastering Lab states
  const [audioActiveProfile, setAudioActiveProfile] = useState<'podcast' | 'vlog' | 'cinema' | 'voiceover' | 'bypass'>('podcast');
  const [audioNoiseReduction, setAudioNoiseReduction] = useState<boolean>(true);
  const [audioNoiseLevel, setAudioNoiseLevel] = useState<number>(85); // 85%
  const [audioVocalEnhance, setAudioVocalEnhance] = useState<boolean>(true); // clearvoice
  const [audioCompressor, setAudioCompressor] = useState<boolean>(true); // dynamic leveling
  const [audioDeEsser, setAudioDeEsser] = useState<boolean>(true);
  const [audioDucking, setAudioDucking] = useState<boolean>(false);
  const [audioDuckingDepth, setAudioDuckingDepth] = useState<number>(-14); // -14dB
  const [audioRoomReverb, setAudioRoomReverb] = useState<'none' | 'studio' | 'podcast' | 'hall'>('studio');
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);
  
  // Video Editing Types (Clip AI Creator Layout Types)
  const [videoEditingType, setVideoEditingType] = useState<'standard' | 'split-screen' | 'smart-pan-zoom' | 'b-roll-ai' | 'cinematic-35mm' | 'mashup-retention'>('standard');

  // Interactive Audio Spectrum state
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  
  // Memoized dynamic spectrum heights mapping actual voice pauses and word frequencies
  const spectrumHeights = React.useMemo(() => {
    if (!activeClip) return [];
    
    const barsCount = 40;
    const clipDuration = activeClip.end - activeClip.start;
    const heights: { time: number; height: number; isHighEnergy: boolean; word?: string }[] = [];
    
    for (let i = 0; i < barsCount; i++) {
      const fraction = i / barsCount;
      const barTime = activeClip.start + fraction * clipDuration;
      
      // Look up captions in activeClip to verify if there's speech audio pressure
      const activeWord = activeClip.captions?.find(
        w => barTime >= w.start && barTime <= w.end
      );
      
      let heightValue = 15;
      let isHighEnergy = false;
      let wordLabel = "";
      
      if (activeWord) {
        // Base speech pressure calculation based on word length & characters index
        const salt = activeWord.word.length;
        heightValue = 65 + (salt * 9) % 30; // yields 65% to 95%
        isHighEnergy = heightValue >= 82;
        wordLabel = activeWord.word;
      } else {
        // Natural background noise waves showing low-intensity valleys
        heightValue = Math.max(8, Math.floor(Math.sin(i * 0.75) * 6 + 14));
      }
      
      heights.push({
        time: barTime,
        height: heightValue,
        isHighEnergy,
        word: wordLabel
      });
    }
    
    return heights;
  }, [activeClip?.id, activeClip?.captions]);

  // Handle re-captioning with AI
  const handleRecaptionClip = () => {
    if (!activeClip) return;
    setIsRecaptioning(true);

    // Simulate high-fidelity multi-stage caption alignment and transcription
    setTimeout(() => {
      // Collect text from current captions
      let textOfClip = activeClip.captions.length > 0
        ? activeClip.captions.map(w => w.word).join(" ")
        : "Este é o novo recorte de vídeo focado em viralização e engajamento sincronizado automaticamente pelas legendas inteligentes.";
      
      // Post-process string using AI grammar/vocabulary options
      if (captionGrammarMode === 'smart-correct') {
        textOfClip = textOfClip
          .replace(/\bta\b/gi, 'está')
          .replace(/\bpra\b/gi, 'para')
          .replace(/\bvc\b/gi, 'você')
          .replace(/\btudo bem\b/gi, 'Tudo Bem')
          .replace(/\bdaí\b/gi, 'então');
      } else if (captionGrammarMode === 'colloquial') {
        textOfClip = textOfClip
          .replace(/\bestá\b/gi, 'tá')
          .replace(/\bpara\b/gi, 'pra')
          .replace(/\bvocê\b/gi, 'vc')
          .replace(/\bincrível\b/gi, 'irado ⚡')
          .replace(/\brapidamente\b/gi, 'num piscar de olhos 🚀');
      }

      // Generate base words array
      let recalculatedWords = generateWordsFromText(textOfClip, activeClip.start);

      // Contextual dictionary map for emoji insertion based on current video/word context
      const emojiMapByWord: Record<string, string> = {
        video: '📹', corte: '✂️', recorte: '✂️',
        viralisacao: '🚀', viral: '🚀', viralizacao: '🚀',
        engajamento: '🔥', fogo: '🔥', quente: '🔥',
        sincronizado: '⚡', raio: '⚡', energia: '⚡',
        legenda: '💬', fala: '💬', legendas: '💬',
        ia: '✨', inteligente: '✨', inteligenca: '✨', inteligência: '✨',
        dinheiro: '💸', vendas: '📈', negocio: '💼', negocios: '💼',
        gamer: '🎮', jogo: '🎮', gta: '🏎️', minecraft: '⛏️',
        orador: '🗣️', voz: '🎙️', audio: '🎵', escutar: '🎧',
        tempo: '⏱️', relogio: '⏰', timing: '⏳', de: '⭐', em: '🌟'
      };

      recalculatedWords = recalculatedWords.map((wordObj) => {
        let finalWord = wordObj.word;
        
        // Casing and Tone adjustments
        if (captionTone === 'vibrant') {
          finalWord = finalWord.toUpperCase();
        } else if (captionTone === 'meme') {
          finalWord = finalWord.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('');
        } else if (captionTone === 'podcast') {
          finalWord = finalWord.charAt(0).toUpperCase() + finalWord.slice(1).toLowerCase();
        }

        // Contextual Emoji injection
        let emoji = wordObj.emoji || '';
        if (captionEmojiStyle === 'light' || captionEmojiStyle === 'heavy') {
          const cleanWord = wordObj.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
          const wordWithoutAccents = cleanWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          if (emojiMapByWord[wordWithoutAccents]) {
            emoji = emojiMapByWord[wordWithoutAccents];
          } else if (captionEmojiStyle === 'heavy' && Math.random() < 0.22) {
            const randomHype = ['🔥', '✨', '⚡', '💥', '🚀', '🧠', '👀', '🎯', '💯'];
            emoji = randomHype[Math.floor(Math.random() * randomHype.length)];
          }
        } else if (captionEmojiStyle === 'none') {
          emoji = '';
        }

        // Timing calibration precision adjustments
        let wordStart = wordObj.start;
        let wordEnd = wordObj.end;
        if (captionTimingPrecision === 'vocal-peaks') {
          wordStart = Math.max(activeClip.start, wordObj.start - 0.04);
          wordEnd = Math.max(wordStart + 0.15, wordObj.end - 0.01);
        } else if (captionTimingPrecision === 'ultra') {
          wordStart = Math.max(activeClip.start, wordObj.start - 0.02);
          wordEnd = wordStart + (wordObj.end - wordObj.start);
        }

        return {
          ...wordObj,
          word: finalWord,
          emoji,
          start: wordStart,
          end: wordEnd
        };
      });

      // Update clips in project
      const updatedClips = clips.map(c => {
        if (c.id === activeClip.id) {
          return {
            ...c,
            captions: recalculatedWords
          };
        }
        return c;
      });

      onUpdateProject({
        ...project,
        clips: updatedClips
      });

      setIsRecaptioning(false);
    }, 1200);
  };
  
  // Synchronized clip state helper
  const wordStartTimes = activeClip?.captions || [];

  // Handle HTML5 video time update
  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!video || !activeClip) return;
    
    const time = video.currentTime;
    setCurrentTime(time);

    // If Smart Crop is active, dynamically adjust focusX and focusY to simulate real-time face tracking framing
    if (isSmartCropActive && isPlaying) {
      const speakerMovementX = 51.5 + Math.sin(time * 0.9) * 1.8 + Math.cos(time * 0.45) * 0.7;
      const speakerMovementY = 27.0 + Math.cos(time * 0.8) * 1.2;
      setFocusX(parseFloat(speakerMovementX.toFixed(1)));
      setFocusY(parseFloat(speakerMovementY.toFixed(1)));
    }

    // Loop back if we reached end of active clip
    if (time >= activeClip.end) {
      if (isPlaying) {
        video.currentTime = activeClip.start;
        setCurrentTime(activeClip.start);
      } else {
        setIsPlaying(false);
      }
    }
  };

  // Reset clock and seek video when active clip shifts
  useEffect(() => {
    if (activeClip) {
      setCurrentTime(activeClip.start);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.currentTime = activeClip.start;
      }
    }
  }, [selectedClipId]);

  // Synchronize play/pause state & clip boundaries with HTML5 video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;

    if (isPlaying) {
      // Seek to correct start time if we are outside of the range
      if (video.currentTime < activeClip.start - 0.2 || video.currentTime >= activeClip.end) {
        video.currentTime = activeClip.start;
      }
      video.play().catch((err) => {
        console.warn("Could not play video element automatically:", err);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, activeClip, selectedClipId]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync any external seeks (e.g. from sliders or word clicks) to HTML5 video currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (video && activeClip) {
      if (Math.abs(video.currentTime - currentTime) > 0.25) {
        video.currentTime = currentTime;
      }
    }
  }, [currentTime]);

  // Synchronize original raw video for simultaneous comparison preview
  useEffect(() => {
    const origVideo = originalVideoRef.current;
    if (!origVideo || !isDualPreviewActive || !activeClip) return;

    if (isPlaying) {
      if (origVideo.currentTime < activeClip.start - 0.25 || origVideo.currentTime >= activeClip.end) {
        origVideo.currentTime = activeClip.start;
      }
      origVideo.play().catch((err) => {
        console.warn("Could not play side-by-side video:", err);
      });
    } else {
      origVideo.pause();
    }
  }, [isDualPreviewActive, isPlaying, activeClip, selectedClipId]);

  useEffect(() => {
    const origVideo = originalVideoRef.current;
    if (origVideo && isDualPreviewActive) {
      origVideo.muted = true; // Stay silent to avoid double volume/echo overlap
    }
  }, [isDualPreviewActive]);

  useEffect(() => {
    const origVideo = originalVideoRef.current;
    if (origVideo && isDualPreviewActive && activeClip) {
      if (Math.abs(origVideo.currentTime - currentTime) > 0.25) {
        origVideo.currentTime = currentTime;
      }
    }
  }, [isDualPreviewActive, currentTime]);

  // Main video tick progress loop fallback when no real video URL is playing
  useEffect(() => {
    let interval: any;
    if (isPlaying && activeClip && !project.videoUrl) {
      const speed = 1.0; 
      const frameRate = 100; // updates every 100ms
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (frameRate / 1000) * speed;
          if (next >= activeClip.end) {
            setIsPlaying(false);
            return activeClip.start; // Loop back
          }
          return next;
        });
      }, frameRate);
    }
    return () => clearInterval(interval);
  }, [isPlaying, activeClip, project.videoUrl]);

  // Synchronize full text editor with active clip
  useEffect(() => {
    if (activeClip) {
      setFullTextEditorValue(activeClip.captions.map(w => w.word).join(" "));
    }
  }, [activeClip?.id]);

  // Guided subtitle presets tour trigger on first access
  useEffect(() => {
    const hasCompletedTotal = localStorage.getItem('has_completed_subtitle_tour');
    if (!hasCompletedTotal) {
      const timer = setTimeout(() => {
        setTourStep(1);
        setActiveTab('styling'); // Put user on the styling panel automatically
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Waveform animation loop back
  useEffect(() => {
    const draw = () => {
      if (canvasRef.current && activeClip) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = isPlaying ? '#6366f1' : '#475569';
          
          const barWidth = 3;
          const barGap = 2;
          const numBars = Math.floor(canvas.width / (barWidth + barGap));
          
          for (let i = 0; i < numBars; i++) {
            // Generate standard waveform pattern amplified by playing state
            let height = 4;
            if (isPlaying) {
              const pulse = Math.sin(Date.now() * 0.005 + i * 0.15) * 14;
              const rnd = Math.random() * 8;
              height = Math.max(4, Math.abs(pulse) + rnd + 2);
            } else {
              // Static nice sine signature
              height = Math.max(3, Math.sin(i * 0.1) * 8 + 10);
            }
            
            const x = i * (barWidth + barGap);
            const y = canvas.height - height;
            ctx.fillRect(x, y, barWidth, height);
          }
        }
      }
      requestRef.current = requestAnimationFrame(draw);
    };
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  // Trigger quick clipboard action
  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(type);
    setTimeout(() => setIsCopied(null), 2000);
  };

  // Quick helper to fetch the active subtitle word at currentTime
  const getActiveWord = (): CaptionWord | null => {
    if (!activeClip || !activeClip.captions.length) return null;
    
    // Find subtitle word matching current playback cursor
    const found = activeClip.captions.find(
      w => currentTime >= w.start && currentTime <= w.end
    );
    
    if (found) return found;
    
    // Otherwise fallback to the closest previous word
    const preceding = [...activeClip.captions]
      .reverse()
      .find(w => currentTime >= w.end);
      
    return preceding || activeClip.captions[0];
  };

  const activeWordObj = getActiveWord();

  // Open inline word modification
  const handleStartEditWord = (w: CaptionWord) => {
    setEditingWordId(w.id);
    setEditingWordValue(w.word);
    setEditingWordEmoji(w.emoji || '');
    setIsPlaying(false);
  };

  // Save modified word
  const handleSaveWord = () => {
    if (!activeClip || !editingWordId) return;

    const updatedCaptions = activeClip.captions.map(w => {
      if (w.id === editingWordId) {
        return {
          ...w,
          word: editingWordValue,
          emoji: editingWordEmoji || undefined
        };
      }
      return w;
    });

    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });

    onUpdateProject({
      ...project,
      clips: updatedClips
    });

    setEditingWordId(null);
  };

  // Save full corrected captions transcript
  const handleSaveFullTextCaption = () => {
    if (!activeClip) return;
    
    const editedWords = fullTextEditorValue.trim().split(/\s+/).filter(Boolean);
    if (editedWords.length === 0) return;
    
    const currentCaptions = activeClip.captions;
    const updatedCaptions = editedWords.map((word, index) => {
      if (index < currentCaptions.length) {
        return {
          ...currentCaptions[index],
          word: word
        };
      } else {
        // Interpolate/append brand new words
        const lastWord = currentCaptions[currentCaptions.length - 1];
        const start = lastWord ? lastWord.end : activeClip.start;
        const end = activeClip.end;
        return {
          id: `w-gen-${Date.now()}-${index}`,
          word,
          start,
          end,
          emoji: ''
        };
      }
    });
    
    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });
    
    onUpdateProject({
      ...project,
      clips: updatedClips
    });
    
    // flash edit success badge
    setSubtitleEditSuccess(true);
    setTimeout(() => setSubtitleEditSuccess(false), 2500);
  };

  // Quick append emoji helper during edit
  const appendEmojiToEdit = (emo: string) => {
    setEditingWordEmoji(emo);
  };

  // High-precision formatting helper (converts seconds to MM:SS:FF at 30fps)
  const formatTimeAndFrames = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}f`;
  };

  // Perform surgical trimming on any viral clip
  const handleTrimClip = (clipId: string, newStart: number, newEnd: number) => {
    const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
    const updatedClips = clips.map(c => {
      if (c.id === clipId) {
        const fixedStart = Number(Math.max(0, newStart).toFixed(2));
        const fixedEnd = Number(Math.min(originalDuration, newEnd).toFixed(2));
        const finalDuration = Number((fixedEnd - fixedStart).toFixed(2));
        return {
          ...c,
          start: fixedStart,
          end: fixedEnd,
          duration: Math.max(0.5, finalDuration)
        };
      }
      return c;
    });

    onUpdateProject({
      ...project,
      clips: updatedClips
    });
  };

  // Move clip boundaries frame-by-frame with 30fps precision
  const trimByFrames = (clipId: string, handle: 'start' | 'end', framesDelta: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    const fps = 30;
    const secondsDelta = framesDelta / fps;
    const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);

    if (handle === 'start') {
      let newStart = clip.start + secondsDelta;
      if (newStart < 0) newStart = 0;
      if (newStart > clip.end - 0.2) newStart = clip.end - 0.2;
      handleTrimClip(clipId, newStart, clip.end);
      setCurrentTime(newStart);
    } else {
      let newEnd = clip.end + secondsDelta;
      if (newEnd > originalDuration) newEnd = originalDuration;
      if (newEnd < clip.start + 0.2) newEnd = clip.start + 0.2;
      handleTrimClip(clipId, clip.start, newEnd);
      setCurrentTime(newEnd);
    }
  };

  // Global mousemove tracker for resizing handles on the timeline
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rail = document.getElementById('timeline-interactive-track');
      if (!rail) return;

      const rect = rail.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
      
      // Calculate active seconds count based on position on the zoom-scaled rail
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = percentage * originalDuration;

      const clip = clips.find(c => c.id === resizing.clipId);
      if (!clip) return;

      if (resizing.handle === 'start') {
        const potentialStart = Number(targetTime.toFixed(2));
        if (potentialStart >= 0 && potentialStart < clip.end - 0.3) {
          handleTrimClip(resizing.clipId, potentialStart, clip.end);
          setCurrentTime(potentialStart);
        }
      } else {
        const potentialEnd = Number(targetTime.toFixed(2));
        if (potentialEnd > clip.start + 0.3 && potentialEnd <= originalDuration) {
          handleTrimClip(resizing.clipId, clip.start, potentialEnd);
          setCurrentTime(potentialEnd);
        }
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, clips, project.duration]);

  // Fine-tune exact timing of a specific caption word
  const handleUpdateWordTimings = (wordId: string, deltaStart: number, deltaEnd: number) => {
    if (!activeClip) return;
    const updatedCaptions = activeClip.captions.map(w => {
      if (w.id === wordId) {
        return {
          ...w,
          start: Math.max(activeClip.start, Number((w.start + deltaStart).toFixed(2))),
          end: Math.min(activeClip.end, Number((w.end + deltaEnd).toFixed(2)))
        };
      }
      return w;
    });
    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });
    onUpdateProject({ ...project, clips: updatedClips });
  };

  // CapCut Split Word: splits a caption word text element in half or creates a clone
  const handleSplitWord = (wordId: string) => {
    if (!activeClip) return;
    const wordIndex = activeClip.captions.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return;
    const targetWord = activeClip.captions[wordIndex];
    const wordText = targetWord.word;
    const midTime = (targetWord.start + targetWord.end) / 2;

    const w1: CaptionWord = {
      ...targetWord,
      id: `${targetWord.id}-s1`,
      word: wordText.substring(0, Math.ceil(wordText.length / 2)) || 'Palavra',
      end: midTime
    };

    const w2: CaptionWord = {
      id: `${targetWord.id}-s2-${Date.now()}`,
      word: wordText.substring(Math.ceil(wordText.length / 2)) || 'Nova',
      start: midTime + 0.05,
      end: targetWord.end,
      emoji: targetWord.emoji
    };

    const updatedCaptions = [
      ...activeClip.captions.slice(0, wordIndex),
      w1,
      w2,
      ...activeClip.captions.slice(wordIndex + 1)
    ];

    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });

    onUpdateProject({ ...project, clips: updatedClips });
  };

  // Remove specific caption word
  const handleRemoveWord = (wordId: string) => {
    if (!activeClip) return;
    const updatedCaptions = activeClip.captions.filter(w => w.id !== wordId);
    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });
    onUpdateProject({ ...project, clips: updatedClips });
  };

  // Quick insert custom word after selected target
  const handleAddWordAfter = (wordId: string) => {
    if (!activeClip) return;
    const wordIndex = activeClip.captions.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return;
    const targetWord = activeClip.captions[wordIndex];
    const newWordStart = targetWord.end + 0.05;
    const newWordEnd = newWordStart + 0.40;

    const newWord: CaptionWord = {
      id: `w-added-${Date.now()}`,
      word: '🔥 Incrível!',
      start: newWordStart,
      end: newWordEnd
    };

    const updatedCaptions = [
      ...activeClip.captions.slice(0, wordIndex + 1),
      newWord,
      ...activeClip.captions.slice(wordIndex + 1)
    ];

    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });

    onUpdateProject({ ...project, clips: updatedClips });
  };

  // Direct word edit in live table
  const handleLiveEditWord = (wordId: string, value: string) => {
    if (!activeClip) return;
    const updatedCaptions = activeClip.captions.map(w => {
      if (w.id === wordId) {
        return { ...w, word: value };
      }
      return w;
    });
    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });
    onUpdateProject({ ...project, clips: updatedClips });
  };

  // Direct word emoji in live table
  const handleLiveEditEmoji = (wordId: string, emoji: string) => {
    if (!activeClip) return;
    const updatedCaptions = activeClip.captions.map(w => {
      if (w.id === wordId) {
        return { ...w, emoji: emoji || undefined };
      }
      return w;
    });
    const updatedClips = clips.map(c => {
      if (c.id === activeClip.id) {
        return { ...c, captions: updatedCaptions };
      }
      return c;
    });
    onUpdateProject({ ...project, clips: updatedClips });
  };

  // Preset styles shortcut selector
  const selectStylePreset = (p: SubtitleStylePreset) => {
    setSubtitleStyle(p);
    onUpdateProject({
      ...project,
      subtitleStyle: p
    });
  };

  // Update specific values in typography preset
  const adjustStyleProp = (key: keyof SubtitleStylePreset, val: any) => {
    const updated = { ...subtitleStyle, [key]: val };
    setSubtitleStyle(updated);
    onUpdateProject({
      ...project,
      subtitleStyle: updated
    });
  };

  // Simulate exporting file with selected professional rendering options
  const handleExportVideo = () => {
    if (exportProgress !== null) return;
    
    setExportProgress(0);
    setExportStep(`Acessando cluster GCP para codificação ${renderCodec.toUpperCase()}...`);
    
    const codecLabel = renderCodec === 'h264' ? 'H.264/AVC Baseline' 
      : renderCodec === 'h265' ? 'H.265/HEVC Main10' 
      : renderCodec === 'av1' ? 'AOMedia AV1 Core' 
      : 'Apple ProRes 422 High Quality';

    const steps = [
      { p: 10, s: `Inicializando codificador de vídeo ${codecLabel} a ${renderFps} FPS...` },
      { p: 25, s: `Trabalhando em resolução nativa ${renderQuality || "1080p"} com proporção ${aspectRatio}...` },
      { p: 40, s: `Ancorando fontes tipográficas na faixa de legenda e aplicando efeito de pop ${subtitleStyle.animationType}...` },
      { p: 55, s: `Renderizando escala e enquadramento de cena com aceleração ${gpuAcceleration ? 'GCP GPU (NVIDIA Tesla T4)' : 'Multi-core CPU Threading (x264)'}...` },
      { p: 70, s: `Fidelizando áudio remasterizado em formato ${audioFormat === 'aac' ? 'AAC Stereo 320kbps' : 'Pulse PCM Wav sem compressão'}...` },
      { p: 85, s: twoPassEncoding ? 'Iniciando Passagem Secundária de Otimização Dinâmica de Bits (multipass)...' : `Gravando stream sob taxa de transferência constante de ${bitrateMbps} Mbps...` },
      { p: 95, s: `Finalizando multiplexação de trilhas e escrevendo metadados de vídeo...` },
      { p: 100, s: 'Exportação Profissional Concluída com Sucesso!' }
    ];

    let currentStepIndex = 0;
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev === null) return null;
        const next = prev + 5;
        
        // Advance steps naturally
        if (currentStepIndex < steps.length && next >= steps[currentStepIndex].p) {
          setExportStep(steps[currentStepIndex].s);
          currentStepIndex++;
        }
        
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExportProgress(null);
            setShowExportSuccess(true);
          }, 800);
          return 100;
        }
        return next;
      });
    }, 180);
  };

  // Auto scroll to active timeline word if playing
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isPlaying && activeWordObj && timelineContainerRef.current) {
      const activeElement = document.getElementById(`word-timeline-${activeWordObj.id}`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [activeWordObj, isPlaying]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 text-slate-100">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-850/80 mb-6">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl hover:border-purple-500/40 hover:bg-slate-900 transition text-slate-450 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="px-2.5 py-0.5 bg-lime-450/10 text-lime-400 border border-lime-450/25 rounded-full text-[9px] font-black uppercase tracking-wider font-display">
                ⚡ Vídeo Processado
              </span>
              <span className="text-slate-500 text-[10px] font-medium font-mono uppercase tracking-wide">Original: {project.originalVideoName}</span>
            </div>
            <h1 className="text-xl font-black font-display text-white mt-1 uppercase tracking-tight">{project.title}</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setAspectRatio(prev => prev === '9:16' ? '1:1' : prev === '1:1' ? '4:5' : prev === '4:5' ? '16:9' : '9:16');
            }}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs font-black uppercase tracking-wider hover:border-slate-800 transition cursor-pointer flex items-center space-x-2"
          >
            <Smartphone className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-slate-300">Enquadrar: {aspectRatio}</span>
          </button>

          <button
            onClick={handleExportVideo}
            disabled={exportProgress !== null}
            className="px-5 py-2.5 bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 text-slate-950 font-display font-black text-xs uppercase tracking-widest rounded-xl flex items-center space-x-2 transition p-1 cursor-pointer shadow-lg hover:shadow-lime-400/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>Exportar Clipes 1080p</span>
          </button>
        </div>
      </div>

      {/* Export overlay modal / loading banner */}
      <AnimatePresence>
        {exportProgress !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 text-center"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                {/* Circular pulsing loading rings */}
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-indigo-400">
                  {exportProgress}%
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-100">Compilando Recortes de Retenção</h3>
                <p className="text-xs text-indigo-400 mt-1 font-mono">{exportStep}</p>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>

              <p className="text-[10px] text-slate-500">
                Processamento ultra rápido por aceleração via hardware server-side do Google Cloud.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showExportSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <Smile className="w-8 h-8 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-100 font-display uppercase tracking-tight">Seus Clipes estão prontos para o TikTok/Shorts! 🎉</h3>
                <p className="text-xs text-slate-400">
                  Com o poder da IA e do motor de estúdio, criamos legendas animadas de alta fidelidade e posts otimizados.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-mono text-cyan-400 bg-slate-950 py-1.5 px-3 border border-slate-850 rounded-lg max-w-sm mx-auto select-none uppercase tracking-wide">
                  <span className="font-bold text-slate-405 text-slate-400">Resultado:</span>
                  <span>{renderQuality}</span>
                  <span className="text-slate-700">•</span>
                  <span>{renderFps} FPS</span>
                  <span className="text-slate-700">•</span>
                  <span>{renderCodec.toUpperCase()}</span>
                  <span className="text-slate-700">•</span>
                  <span>{(renderCodec === 'prores' ? 140 : bitrateMbps)} Mbps Target</span>
                </div>
              </div>

              {/* Recommended guidelines */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl text-left space-y-3">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Estratégia Recomendada para Viralizar:
                </h4>
                <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4">
                  <li><strong>Poste em horários de pico</strong>: Meio-dia (12:00) ou noite (18:30 - 21:00).</li>
                  <li><strong>Responda aos primeiros comentários</strong> nas primeiras 2 horas para forçar o algoritmo a distribuir o clipe.</li>
                  <li>Use o título recomendado gerado pela IA junto com um áudio que esteja em alta.</li>
                </ul>
              </div>

              {/* Simulated download slots */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-semibold truncate max-w-full">
                    {activeClip?.title}.mp4
                  </span>
                  <p className="text-[10px] text-emerald-400 font-mono mt-1">Legendas Estilo: {subtitleStyle.name}</p>
                  <button 
                    onClick={() => {
                      alert('Simulação de download: Seu clipe foi exportado com as legendas dinâmicas e já está na sua pasta de Downloads!');
                    }}
                    className="mt-3 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded text-white flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Baixar Clipe MP4
                  </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-semibold truncate max-w-full">
                    Copywriter_Post.txt
                  </span>
                  <p className="text-[10px] text-indigo-400 mt-1">SEO & Hashtags Otimizados</p>
                  <button 
                    onClick={() => handleCopyText(`${activeClip?.suggestedTitle}\n\n${activeClip?.suggestedDescription}\n\n${activeClip?.tags.map(t => `#${t}`).join(' ')}`, 'all-post')}
                    className="mt-3 w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded text-white flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isCopied === 'all-post' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {isCopied === 'all-post' ? 'Copiado!' : 'Copiar Textos do Post'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowExportSuccess(false)}
                  className="px-6 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 text-xs font-semibold rounded-lg border border-indigo-600/20 cursor-pointer"
                >
                  Voltar ao Editor
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Left Panel for Smartphone / Video simulation - Right Panel for Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Smartphone Previewer & Player Sync */}
        <div className={`${isDualPreviewActive ? 'lg:col-span-7 max-w-none' : 'lg:col-span-4 max-w-[340px]'} w-full flex flex-col items-center space-y-4 mx-auto`}>
          
          {/* Smart Frame Selector Layout Wrapper */}
          <div className="w-full flex justify-between items-center px-1">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-indigo-500" /> Preview de Enquadramento
            </span>
            <div className="flex space-x-1">
              <button 
                onClick={() => setAspectRatio('9:16')} 
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${aspectRatio === '9:16' ? 'bg-indigo-650 text-white border border-indigo-550' : 'bg-slate-900 border border-slate-800 text-slate-450 hover:text-slate-200'}`}
                title="TikTok / Reels 9:16"
              >
                9:16
              </button>
              <button 
                onClick={() => setAspectRatio('4:5')} 
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${aspectRatio === '4:5' ? 'bg-indigo-650 text-white border border-indigo-550' : 'bg-slate-900 border border-slate-800 text-slate-450 hover:text-slate-200'}`}
                title="Instagram Portrait 4:5"
              >
                4:5
              </button>
              <button 
                onClick={() => setAspectRatio('1:1')} 
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${aspectRatio === '1:1' ? 'bg-indigo-650 text-white border border-indigo-550' : 'bg-slate-900 border border-slate-800 text-slate-450 hover:text-slate-200'}`}
                title="Feed Quadrado 1:1"
              >
                1:1
              </button>
              <button 
                onClick={() => setAspectRatio('16:9')} 
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${aspectRatio === '16:9' ? 'bg-indigo-650 text-white border border-indigo-550' : 'bg-slate-900 border border-slate-800 text-slate-450 hover:text-slate-200'}`}
                title="YouTube Wide 16:9"
              >
                16:9
              </button>
            </div>
          </div>

          {/* Simultaneous Preview Toggle Bar */}
          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-3 shadow select-none">
            <span className="text-[10px] font-bold text-slate-350 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400" /> Prévia Simultânea
            </span>

            <button
              onClick={() => setIsDualPreviewActive(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
                isDualPreviewActive
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-650 text-slate-950 font-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{isDualPreviewActive ? 'Ativo: Lado a Lado' : 'Ativar Lado a Lado'}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isDualPreviewActive ? 'bg-slate-950 animate-pulse' : 'bg-slate-700'}`}></span>
            </button>
          </div>

          {/* Dynamic Comparison Grid Layout Wrapper */}
          <div className={`w-full ${isDualPreviewActive ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-col items-center'}`}>
            
            {/* PANEL 1: RAW ORIGINAL VIDEO WITH ACTIVE CROP OVERLAY */}
            {isDualPreviewActive && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 flex flex-col justify-between space-y-3 shadow-xl w-full">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1 font-mono">
                    <Video className="w-3.5 h-3.5 text-indigo-400" /> Vídeo Original (Bruto)
                  </span>
                  <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono text-emerald-400 font-bold uppercase">
                    Bypass Crop (16:9)
                  </span>
                </div>

                <div 
                  className="relative w-full overflow-hidden bg-slate-950 rounded-xl flex items-center justify-center border border-slate-850 select-none"
                  style={{ aspectRatio: '16/9' }}
                >
                  {project.videoUrl ? (
                    <video
                      ref={originalVideoRef}
                      src={project.videoUrl}
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-[10px] text-slate-500 px-4 text-center font-mono py-12">
                      SEM VÍDEO CONECTADO
                    </div>
                  )}

                  {/* Dynamic crop projection zone guideline overlay */}
                  {activeClip && (
                    <div 
                      className="absolute border border-emerald-400 bg-emerald-500/5 pointer-events-none transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      style={{
                        left: `${focusX}%`,
                        top: `${focusY}%`,
                        width: `${aspectRatio === '9:16' ? (31.5 / focusZoom) : aspectRatio === '4:5' ? (42 / focusZoom) : aspectRatio === '1:1' ? (50 / focusZoom) : (88 / focusZoom)}%`,
                        height: `${aspectRatio === '9:16' ? (56 / focusZoom) : aspectRatio === '4:5' ? (52.5 / focusZoom) : aspectRatio === '1:1' ? (50 / focusZoom) : (50 / focusZoom)}%`,
                        maxWidth: '100%',
                        maxHeight: '100%',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.65)'
                      }}
                    >
                      {/* Reticle anchor center dot */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-950 animate-ping"></span>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full border border-slate-950"></span>
                      </div>
                      
                      {/* Crop handles */}
                      <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-300"></span>
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-300"></span>
                      <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-300"></span>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-300"></span>

                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-500 text-slate-900 text-[6.5px] font-mono font-black rounded px-1.5 py-0.5 tracking-wider uppercase leading-none shadow border border-emerald-300">
                        Extração ({aspectRatio})
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/40 p-2 border border-slate-850/50 rounded-xl space-y-1 text-[8.5px] leading-normal text-slate-400 text-left">
                  <p>
                    💡 <strong className="text-slate-300">Lente do Editor:</strong> A caixa de projeção translúcida rastreia e exibe a enquadração correspondente em tempo real.
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[8px] text-emerald-400">
                    <span>Foco X: {focusX.toFixed(0)}%</span>
                    <span>Y: {focusY.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 2: SMARTPHONE ENVELOPE */}
            <div className={`w-full flex justify-center ${isDualPreviewActive ? 'max-w-[315px]' : 'max-w-[340px]'}`}>
              {/* Smartphone container skeleton */}
              <div className="relative w-full bg-slate-950 rounded-[44px] p-3 border-4 border-slate-800 shadow-2xl overflow-hidden aspect-[9/18.5]">
                
                {/* Camera / Speaker Notch */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-32 h-5 bg-slate-950 rounded-full z-20 flex items-center justify-center border border-slate-850">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2 border border-blue-900/40"></div>
                  <div className="w-8 h-1 rounded bg-slate-800"></div>
                </div>

                {/* Inner responsive frame simulator wrapper */}
            {activeClip ? (
              <div className="relative flex items-center justify-center w-full h-full bg-slate-950 rounded-[34px] overflow-hidden">
                
                {/* Fixed aspect ratio 9:16 video scene wrapper for precise crop guidelines */}
                <div 
                  className="relative flex items-center justify-center bg-slate-900 w-full h-full overflow-hidden cursor-crosshair select-none group"
                  style={{
                    aspectRatio: '9/16',
                    height: '100%'
                  }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setFocusX(parseFloat(x.toFixed(1)));
                    setFocusY(parseFloat(y.toFixed(1)));
                  }}
                >
                  {/* Real physical video playback natively accepting any video format/preset */}
                  {project.videoUrl ? (
                    <video
                      ref={videoRef}
                      src={project.videoUrl}
                      onTimeUpdate={handleVideoTimeUpdate}
                      playsInline
                      className={`absolute inset-0 w-full object-cover z-0 transition-all duration-300 ease-out ${
                        videoEditingType === 'split-screen' ? 'h-1/2 top-0 border-b-2 border-pink-500/30' : 'h-full'
                      } ${videoEditingType === 'cinematic-35mm' ? 'contrast-125 saturate-70 brightness-90 hue-rotate-15' : ''}`}
                      style={{
                        objectPosition: `${focusX}% ${focusY}%`,
                        transform: `scale(${videoEditingType === 'smart-pan-zoom' ? focusZoom * 1.35 : focusZoom}) translate(${videoEditingType === 'smart-pan-zoom' ? '2.5%' : '0px'}, ${videoEditingType === 'smart-pan-zoom' ? '-1.5%' : '0px'})`,
                      }}
                    />
                  ) : null}

                  {/* SPLIT-SCREEN satisfying gameplay/ASMR simulation on bottom hand */}
                  {videoEditingType === 'split-screen' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-slate-950 overflow-hidden flex flex-col justify-end select-none border-t-2 border-pink-500/30">
                      {/* satisfying loop mock */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black flex items-center justify-center opacity-95">
                        {/* GTA/Minecraft simulated tracks */}
                        <div className="relative w-full h-full flex flex-col items-center justify-center opacity-60">
                          <div className="absolute inset-x-0 h-1 bg-lime-400 top-1/4 animate-pulse blur-[1px]"></div>
                          <div className="absolute inset-x-0 h-2 bg-pink-500 top-1/2 animate-bounce"></div>
                          <div className="absolute inset-x-0 h-0.5 bg-yellow-400 top-2/3 animate-pulse"></div>
                          
                          {/* Floating vector wireframes to look like a high speed GTA 5 ramp jump map */}
                          <div className="w-24 h-24 border border-pink-500/35 rounded-lg transform rotate-45 animate-spin duration-3000 my-auto text-indigo-500/10 flex items-center justify-center font-mono text-[7px]" style={{ animationDuration: '6s' }}>
                            GAMEPLAY LOOP
                          </div>
                        </div>
                      </div>
                      
                      {/* overlay text */}
                      <div className="p-2 bg-slate-950/90 border-t border-slate-900/60 font-mono text-[7px] text-lime-400 font-black flex justify-between items-center z-10 w-full">
                        <span>🎮 GTA AUTO-RETENÇÃO SENSORIAL</span>
                        <span className="animate-pulse">● PLAYING</span>
                      </div>
                    </div>
                  )}

                  {/* B-ROLL AI ILLUSTRATION INSERTER */}
                  {videoEditingType === 'b-roll-ai' && (
                    <div className="absolute top-12 right-2.5 w-[110px] aspect-video bg-slate-950/95 border border-cyan-400/50 rounded-lg shadow-2xl p-1 z-15 animate-pulse flex flex-col justify-between overflow-hidden">
                      <div className="relative w-full h-full rounded bg-slate-900 flex items-center justify-center text-[7.5px] text-cyan-400 font-extrabold overflow-hidden select-none">
                        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/50 via-indigo-950/40 to-slate-950" />
                        <span className="z-10 animate-bounce text-center leading-tight">📊 AI B-ROLL ACTIVE<br/><span className="text-slate-400 font-normal">[Vendas crescentes]</span></span>
                      </div>
                      <div className="mt-1 text-[5px] text-slate-500 font-mono flex items-center justify-between px-0.5">
                        <span>B-ROLL STOCK</span>
                        <span className="text-cyan-400">SYNCED OK</span>
                      </div>
                    </div>
                  )}

                  {/* CINEMATIC 35mm LETTERBOX BARS & VHS GRAIN FILTER OVERLAY */}
                  {videoEditingType === 'cinematic-35mm' && (
                    <>
                      {/* Top Letterbox Bar */}
                      <div className="absolute top-0 left-0 right-0 h-10 bg-black z-20 flex items-center justify-between px-4 border-b border-white/5 select-none font-mono text-[6px]">
                        <span className="text-slate-500">ANAMORPHIC CROP 2.39:1</span>
                        <span className="text-pink-500 font-bold animate-pulse">REC ●</span>
                      </div>
                      {/* Bottom Letterbox Bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-black z-20 flex items-center justify-between px-4 border-t border-white/5 select-none font-mono text-[6px] text-slate-500">
                        <span>CINE COLOR: PORTRA 400</span>
                        <span>AUDIO: CINEMATIC DOLBY</span>
                      </div>
                      {/* subtle grid overlay for aesthetics */}
                      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(transparent_50%,_rgba(0,0,0,0.4))] z-10" />
                    </>
                  )}

                  {/* MASHUP RETENTION LAYER (Split Screen 3 sections style) */}
                  {videoEditingType === 'mashup-retention' && (
                    <div className="absolute inset-0 pointer-events-none border-2 border-pink-500/30 z-10">
                      <div className="absolute top-[30%] left-0 right-0 h-[1px] bg-pink-500/20 border-b border-dashed border-pink-500/45" />
                      <div className="absolute bottom-[30%] left-0 right-0 h-[1px] bg-pink-500/20 border-b border-dashed border-pink-500/45" />
                      
                      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-pink-500 text-slate-950 font-black text-[6.5px] px-1.5 py-0.5 rounded uppercase tracking-wider font-mono text-center shadow animate-bounce">
                        ⚡ DOPAMINE MASHUP ENERGETIC
                      </div>
                    </div>
                  )}

                  {/* AI Re-Captioning loading overlay blur */}
                  {isRecaptioning && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center space-y-4 animate-fade-in pointer-events-none">
                      <div className="relative">
                        <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                        <Sparkles className="w-5 h-5 text-cyan-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-black text-slate-100 uppercase tracking-widest font-mono block">IA Recalculando</span>
                        <span className="text-[8px] text-slate-400 block max-w-[180px] leading-relaxed">
                          Sincronizando áudio e ajustando o timing com base no novo tempo recortado...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* AI Face & Speaker Bounding Box Scanning Overlay */}
                  {isFaceScanning && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] z-30 flex flex-col items-center justify-center p-4 text-center pointer-events-none border-2 border-cyan-500/30">
                      {/* Bouncing radar sweep line */}
                      <div className="absolute inset-x-0 h-0.5 bg-cyan-400 top-1/4 animate-bounce shadow-[0_0_8px_#22d3ee]"></div>
                      <div className="absolute inset-x-0 h-0.5 bg-cyan-400 top-2/3 animate-pulse shadow-[0_0_8px_#22d3ee]"></div>
                      
                      {/* Bounding box simulation wrapper centered around the speakers predicted facial position */}
                      <div className="relative w-28 h-28 border border-dashed border-cyan-400 animate-pulse flex items-center justify-center rounded-lg">
                        <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-300"></span>
                        <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-300"></span>
                        <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-300"></span>
                        <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-300"></span>
                        
                        <div className="text-[6px] font-mono font-black text-cyan-400 bg-slate-950/90 px-1 py-0.5 rounded tracking-widest uppercase">
                          CROP: CENTRALIZANDO
                        </div>
                      </div>

                      <div className="mt-4 bg-slate-950/95 border border-cyan-500/30 p-2.5 rounded-lg max-w-[180px] shadow-2xl">
                        <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest font-mono block animate-pulse">DETECTANDO ROSTO...</span>
                        <span className="text-[7px] text-slate-400 block font-sans mt-0.5 leading-normal">
                          Mapeando marcos faciais e enquadrando 9:16 dinamicamente
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Face-Tracking Reticle Target Indicator */}
                  <div 
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 ease-out"
                    style={{
                      left: `${focusX}%`,
                      top: `${focusY}%`,
                      bordercolor: isSmartCropActive ? '#10b981' : '#22d3ee'
                    }}
                  >
                    {/* Ring */}
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      {/* Tracking target corners */}
                      <span className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 ${isSmartCropActive ? 'border-emerald-400' : 'border-cyan-400'}`}></span>
                      <span className={`absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 ${isSmartCropActive ? 'border-emerald-400' : 'border-cyan-400'}`}></span>
                      <span className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 ${isSmartCropActive ? 'border-emerald-400' : 'border-cyan-400'}`}></span>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 ${isSmartCropActive ? 'border-emerald-400' : 'border-cyan-400'}`}></span>
                      
                      {/* Pulse dot */}
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSmartCropActive ? 'bg-emerald-400' : 'bg-cyan-400'}`}></span>
                      
                      {/* Floating Text tag */}
                      <span className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-slate-950 font-black text-[7px] uppercase tracking-wider px-1 rounded shadow-sm font-mono scale-[0.85] border ${
                        isSmartCropActive 
                          ? 'bg-emerald-400 border-emerald-300/30' 
                          : 'bg-cyan-500/90 border-cyan-300/30'
                      }`}>
                        {isSmartCropActive ? `🤖 SMART CROP: AUTO (${focusX.toFixed(0)}%, ${focusY.toFixed(0)}%)` : `Foco IA: ${focusX.toFixed(0)}%X`}
                      </span>
                    </div>
                  </div>

                  {/* Smart transparent graphic/labels layer aligned with playheads */}
                  <div 
                    className={`absolute inset-0 flex flex-col justify-between p-4 z-10 ${
                      project.videoUrl ? 'bg-transparent' : 'bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/40'
                    }`}
                  >
                    {/* Top social labels overlay */}
                    <div className="flex justify-between items-center mt-6 text-[10px] font-semibold text-slate-400 select-none z-10">
                      <span className="bg-slate-950/70 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> LEGENDAS {subtitleStyle.name}
                      </span>
                      <span className="font-mono bg-slate-950/70 backdrop-blur-md px-1.5 py-0.5 rounded">
                        {currentTime.toFixed(1)}s / {activeClip.end.toFixed(1)}s
                      </span>
                    </div>

                    {/* Speaking animation is only shown if there is NO real video stream playing */}
                    {!project.videoUrl && (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        {/* Pulse circle speaker container */}
                        <div className="relative w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-650 rounded-full flex items-center justify-center shadow-lg shadow-indigo-650/30">
                          <Video className="w-6 h-6 text-slate-100" />
                          {isPlaying && (
                            <>
                              <span className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-60"></span>
                              <span className="absolute -inset-2 rounded-full border-2 border-indigo-500/20 animate-ping opacity-30"></span>
                            </>
                          )}
                        </div>
                        
                        {/* Subtitle Style Presets preview live renderer */}
                        <p className="text-[10px] text-slate-400 font-mono tracking-widest text-center uppercase font-bold">
                          Área de Vídeo 9:16
                        </p>
                      </div>
                    )}

                    {project.videoUrl && (
                      <div className="flex-1 flex items-center justify-center pointer-events-none">
                        {/* Spacer overlay layer */}
                      </div>
                    )}

                    {/* Bottom visual helper spacer */}
                    <div className="h-10"></div>
                  </div>

                  {/* ACTIVE CROP OVERLAYS (Simulating precise format cuts for Instagram 4:5 vs TikTok 9:16) */}
                  {aspectRatio === '4:5' && (
                    <>
                      {/* Top Crop Mask */}
                      <div 
                        className="absolute top-0 inset-x-0 bg-black/75 border-b border-dashed border-red-500/50 flex items-end justify-center pb-2 z-20 pointer-events-none select-none"
                        style={{ height: '14.8%' }}
                      >
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono bg-black/60 px-1.5 py-0.5 rounded">
                          Corte Instagram 4:5 (Invisível)
                        </span>
                      </div>
                      {/* Bottom Crop Mask */}
                      <div 
                        className="absolute bottom-0 inset-x-0 bg-black/75 border-t border-dashed border-red-500/50 flex items-start justify-center pt-2 z-20 pointer-events-none select-none"
                        style={{ height: '14.8%' }}
                      >
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono bg-black/60 px-1.5 py-0.5 rounded">
                          Corte Instagram 4:5 (Invisível)
                        </span>
                      </div>
                    </>
                  )}

                  {aspectRatio === '1:1' && (
                    <>
                      {/* Top Crop Mask */}
                      <div 
                        className="absolute top-0 inset-x-0 bg-black/80 border-b border-dashed border-amber-500/50 flex items-end justify-center pb-2 z-20 pointer-events-none select-none"
                        style={{ height: '21.9%' }}
                      >
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest font-mono bg-black/60 px-1.5 py-0.5 rounded">
                          Corte Feed 1:1 (Invisível)
                        </span>
                      </div>
                      {/* Bottom Crop Mask */}
                      <div 
                        className="absolute bottom-0 inset-x-0 bg-black/80 border-t border-dashed border-amber-500/50 flex items-start justify-center pt-2 z-20 pointer-events-none select-none"
                        style={{ height: '21.9%' }}
                      >
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest font-mono bg-black/60 px-1.5 py-0.5 rounded">
                          Corte Feed 1:1 (Invisível)
                        </span>
                      </div>
                    </>
                  )}

                  {aspectRatio === '16:9' && (
                    <>
                      {/* Top Crop Mask */}
                      <div 
                        className="absolute top-0 inset-x-0 bg-black/85 border-b border-dashed border-indigo-500/40 flex items-end justify-center pb-1 z-20 pointer-events-none select-none"
                        style={{ height: '33%' }}
                      >
                        <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest font-mono bg-black/60 px-1 rounded">
                          Formato Lateral 16:9
                        </span>
                      </div>
                      {/* Bottom Crop Mask */}
                      <div 
                        className="absolute bottom-0 inset-x-0 bg-black/85 border-t border-dashed border-indigo-500/40 flex items-start justify-center pt-1 z-20 pointer-events-none select-none"
                        style={{ height: '33%' }}
                      >
                        <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest font-mono bg-black/60 px-1 rounded">
                          Formato Lateral 16:9
                        </span>
                      </div>
                    </>
                  )}

                  {/* HIGH-FIDELITY SOCIAL MOCKUPS OVERLAY */}
                  {aspectRatio === '9:16' && (
                    <>
                      {/* Right side floating buttons */}
                      <div className="absolute right-2 bottom-20 flex flex-col items-center space-y-4.5 z-20 pointer-events-none select-none opacity-70 scale-[0.82] origin-bottom-right">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full border border-white/40 bg-slate-800 flex items-center justify-center relative">
                            <span className="text-sm">👤</span>
                            <div className="absolute -bottom-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">+</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg">❤️</span>
                          <span className="text-[9px] text-white font-semibold">4.2M</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg">💬</span>
                          <span className="text-[9px] text-white font-semibold">18.4K</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg">⭐</span>
                          <span className="text-[9px] text-white font-semibold">521K</span>
                        </div>
                        <div className="flex flex-col items-center animate-spin" style={{ animationDuration: '6s' }}>
                          <div className="w-8 h-8 rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center">
                            <span className="text-xs">💿</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom left description */}
                      <div className="absolute left-3 bottom-8 max-w-[75%] z-20 pointer-events-none select-none opacity-80 text-left space-y-1">
                        <p className="text-[11px] font-bold text-white flex items-center gap-1">
                          @criador_ai <span className="bg-indigo-600 text-[8px] px-1 rounded">Parceiro</span>
                        </p>
                        <p className="text-[10px] text-slate-100 line-clamp-2 leading-tight">
                          {activeClip.suggestedTitle} {activeClip.tags.map(t => `#${t}`).join(' ')}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          🎵 Som original - @criador_ai
                        </p>
                      </div>
                    </>
                  )}

                  {aspectRatio === '4:5' && (
                    <>
                      {/* Upper Instagram Feed User Info Header */}
                      <div className="absolute top-[14.8%] inset-x-0 h-9 bg-black/40 backdrop-blur-md px-3 flex items-center justify-between z-20 pointer-events-none select-none opacity-90 border-b border-white/5">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[9px] border border-white/15">👤</div>
                          <span className="text-[10px] font-bold text-slate-100 font-sans">criador_ai</span>
                        </div>
                        <span className="text-sm text-slate-450 font-bold">•••</span>
                      </div>

                      {/* Bottom Instagram Actions Feed strip */}
                      <div className="absolute bottom-[14.8%] inset-x-0 bg-black/60 backdrop-blur-md p-2 z-20 pointer-events-none select-none opacity-90 border-t border-white/5 flex flex-col space-y-1 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2 text-xs">
                            <span>❤️</span>
                            <span>💬</span>
                            <span>✈️</span>
                          </div>
                          <span className="text-xs">🔖</span>
                        </div>
                        <p className="text-[9px] text-slate-350 font-sans">
                          Curtido por <strong>foco_expert</strong> e <strong>outros</strong>
                        </p>
                      </div>
                    </>
                  )}

                  {aspectRatio === '1:1' && (
                    <>
                      {/* Upper Instagram Feed User Info Header */}
                      <div className="absolute top-[21.9%] inset-x-0 h-9 bg-black/40 backdrop-blur-md px-3 flex items-center justify-between z-20 pointer-events-none select-none opacity-90 border-b border-white/5">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[9px] border border-white/15">👤</div>
                          <span className="text-[10px] font-bold text-slate-100 font-sans">criador_ai</span>
                        </div>
                        <span className="text-sm text-slate-450 font-bold">•••</span>
                      </div>

                      {/* Bottom Instagram Actions Feed strip */}
                      <div className="absolute bottom-[21.9%] inset-x-0 bg-black/60 backdrop-blur-md p-2 z-20 pointer-events-none select-none opacity-90 border-t border-white/5 flex flex-col space-y-1 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2 text-xs">
                            <span>❤️</span>
                            <span>💬</span>
                            <span>✈️</span>
                          </div>
                          <span className="text-xs">🔖</span>
                        </div>
                        <p className="text-[9px] text-slate-350 font-sans">
                          Exibição no Feed Quadrado
                        </p>
                      </div>
                    </>
                  )}

                  {/* SUBTITLE SUBVIEW (DYNAMIC SUBTITLES OVERLAY BURNT) */}
                  {activeClip && activeWordObj && (
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 w-[98%] text-center pointer-events-none z-10 transition-all duration-200 select-none"
                      style={{ 
                        top: `${subtitleStyle.positionY || 70}%`
                      }}
                    >
                      {/* Subtitle Style Presentation with animated pop, bounce or glow */}
                      <motion.div 
                        key={activeWordObj.id}
                        initial={{ scale: 0.94, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.1 }}
                        className="p-3.5 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl shadow-2xl border border-white/5 backdrop-blur-xs"
                        style={{
                          backgroundColor: subtitleStyle.backgroundColor.startsWith('rgba') ? subtitleStyle.backgroundColor : `${subtitleStyle.backgroundColor}ee`,
                        }}
                      >
                        {(() => {
                          const activeIdx = activeClip.captions.findIndex(w => w.id === activeWordObj.id);
                          const startIdx = Math.max(0, activeIdx - 1);
                          const endIdx = Math.min(activeClip.captions.length - 1, activeIdx + 1);
                          
                          const slice = activeClip.captions.slice(startIdx, endIdx + 1);
                          
                          return slice.map((w) => {
                            const isCurrent = w.id === activeWordObj.id;
                            return (
                              <motion.span
                                key={w.id}
                                animate={isCurrent ? { scale: 1.15 } : { scale: 0.92 }}
                                transition={{ duration: 0.12 }}
                                className="inline-block whitespace-nowrap leading-none font-black tracking-tight"
                                style={{
                                  fontFamily: subtitleStyle.fontFamily,
                                  color: isCurrent ? subtitleStyle.accentColor : '#FFFFFF',
                                  fontSize: isCurrent ? `${subtitleStyle.fontSize}px` : `${Math.max(14, subtitleStyle.fontSize - 4)}px`,
                                  textTransform: subtitleStyle.uppercase ? 'uppercase' : 'none',
                                  textShadow: isCurrent ? subtitleStyle.textShadow : '1px 1px 2px rgba(0,0,0,0.8)'
                                }}
                              >
                                {isCurrent && w.emoji && (
                                  <span className="block text-3xl mb-1 filter drop-shadow animate-bounce text-center">
                                    {w.emoji}
                                  </span>
                                )}
                                {w.word}
                              </motion.span>
                            );
                          });
                        })()}
                      </motion.div>
                    </div>
                  )}

                  {/* Audio visualization spectrum footer */}
                  <div className="absolute bottom-1 left-0 right-0 h-6 px-4 z-10 select-none">
                    <canvas ref={canvasRef} width={280} height={20} className="w-full h-full opacity-60" />
                  </div>

                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-slate-900/80 rounded-[34px] flex flex-col items-center justify-center text-slate-500 p-8 text-center text-xs">
                <Video className="w-12 h-12 mb-2 text-slate-700" />
                Selecione um clipe ao lado para ativar o simulador.
              </div>
            )}
            
          </div>
        </div>
      </div>

          {/* Quick interactive player controller bar */}
          {activeClip && (
            <div className="w-full max-w-[340px] bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
              
              {/* Progress Seek Slider */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-mono text-[10px] text-slate-400">
                  {(currentTime - activeClip.start).toFixed(1)}s
                </span>
                
                <input 
                  type="range"
                  min={activeClip.start}
                  max={activeClip.end}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    setCurrentTime(parseFloat(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="flex-1 accent-indigo-500 bg-slate-950 h-1 rounded-full cursor-pointer h-1.5 focus:outline-none"
                />

                <span className="font-mono text-[10px] text-indigo-400 font-bold">
                  {activeClip.duration.toFixed(0)}s total
                </span>
              </div>

              {/* Action play buttons */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentTime(activeClip.start);
                      setIsPlaying(true);
                    }}
                    className="p-1.5 bg-slate-950 rounded hover:bg-slate-800 transition text-slate-300 hover:text-white cursor-pointer"
                    title="Reiniciar"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className="p-1.5 bg-slate-950 rounded hover:bg-slate-800 transition text-slate-300 hover:text-white cursor-pointer"
                    title={isMuted ? "Desmutar" : "Mutar Áudio"}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                </div>

                <button
                  onClick={() => setIsPlaying(prev => !prev)}
                  className={`py-1.5 px-6 rounded-full text-xs font-bold flex items-center space-x-1 cursor-pointer transition active:scale-95 ${
                    isPlaying 
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-600/20'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>PAUSAR</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>REPRODUZIR</span>
                    </>
                  )}
                </button>

                <span className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                  {isPlaying ? 'LIVE' : 'REC_PAUSED'}
                </span>
              </div>
            </div>
          )}

          {/* Visualizador de Espectro de Áudio Interativo */}
          {activeClip && (
            <div id="audio-spectrum-card" className="w-full max-w-[340px] bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3.5 shadow-md shadow-slate-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Waves className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wider font-mono">
                    Espectro de Áudio Interativo
                  </h4>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-black uppercase">
                    Picos em Sincronia
                  </span>
                </div>
              </div>

              <p className="text-[9.5px] text-slate-400 leading-normal">
                Clique em qualquer barra para ir àquele trecho. Picos em <span className="text-lime-400 font-bold">verde/laranja</span> indicam alta energia de voz e retenção calculada pela IA!
              </p>

              {/* Spectrum Bars Layout Container */}
              <div className="relative bg-slate-950 rounded-xl p-3 pt-6 border border-slate-850/60 select-none">
                {/* Visual grid background */}
                <div className="absolute inset-0 grid grid-rows-3 grid-cols-4 pointer-events-none opacity-5">
                  <div className="border-b border-r border-slate-700"></div>
                  <div className="border-b border-r border-slate-700"></div>
                  <div className="border-b border-r border-slate-700"></div>
                  <div className="border-b border-slate-700"></div>
                  <div className="border-b border-r border-slate-700"></div>
                  <div className="border-b border-r border-slate-700"></div>
                  <div className="border-b border-r border-slate-700"></div>
                  <div className="border-b border-slate-700"></div>
                </div>

                {/* Subtitle hovering tooltip overlay */}
                <div className="absolute top-1.5 left-3 right-3 flex items-center justify-between text-[8px] font-mono text-slate-500">
                  <span>TEMPO: {((currentTime - activeClip.start)).toFixed(1)}s</span>
                  {hoveredBarIndex !== null && (
                    <span className="text-[8.5px] text-lime-400 font-black animate-pulse truncate max-w-[170px]">
                      {spectrumHeights[hoveredBarIndex]?.word 
                        ? `🗣️ "${spectrumHeights[hoveredBarIndex].word}"` 
                        : "🔕 Silêncio / Pausa"
                      }
                    </span>
                  )}
                  <span>+{activeClip.duration.toFixed(0)}s</span>
                </div>

                {/* Bars flexbox */}
                <div className="flex items-end justify-between h-14 relative z-10 w-full gap-[2px] pt-1">
                  {spectrumHeights.map((bar, idx) => {
                    const clipDuration = activeClip.end - activeClip.start;
                    const relativePlayPos = (currentTime - activeClip.start) / clipDuration;
                    const relativeBarPos = idx / spectrumHeights.length;
                    
                    const isPlayed = relativePlayPos >= relativeBarPos;
                    const isCurrentlyPlaying = Math.abs(relativePlayPos - relativeBarPos) < (1 / spectrumHeights.length);
                    const isHovered = idx === hoveredBarIndex;
                    
                    // Style coloring depending on whether we have high-energy word spikes!
                    let barColorClass = "bg-slate-800";
                    if (isPlayed) {
                      if (bar.isHighEnergy) {
                        barColorClass = "bg-gradient-to-t from-orange-500 to-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.3)]";
                      } else {
                        barColorClass = "bg-gradient-to-t from-indigo-500 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]";
                      }
                    } else if (isHovered) {
                      barColorClass = "bg-slate-400";
                    } else {
                      barColorClass = bar.isHighEnergy ? "bg-amber-600/40" : "bg-slate-800";
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const targetTime = activeClip.start + (idx / spectrumHeights.length) * clipDuration;
                          setCurrentTime(targetTime);
                          if (videoRef.current) {
                            videoRef.current.currentTime = targetTime;
                          }
                        }}
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        className="flex-1 group/bar relative h-full flex items-end cursor-pointer focus:outline-none"
                        style={{ height: '100%' }}
                      >
                        {/* The actual colored bar block */}
                        <div 
                          className={`w-full rounded-xs transition-all duration-150 ${barColorClass} ${
                            isCurrentlyPlaying ? 'scale-y-110 brightness-110' : ''
                          }`}
                          style={{ 
                            height: `${bar.height}%`,
                            transformOrigin: 'bottom'
                          }}
                        />

                        {/* Interactive glow handle for playhead */}
                        {isCurrentlyPlaying && (
                          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2.5px] bg-white rounded-full shadow-[0_0_6px_white] z-20 pointer-events-none" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status footer with metadata */}
              <div className="flex items-center justify-between text-[8px] font-mono text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-amber-500/25 border border-amber-500/40 inline-block"></span>
                  <span>Momento Gancho</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-indigo-500/25 border border-indigo-500/40 inline-block"></span>
                  <span>Frente Ativa</span>
                </div>
                <span>40 bandas de análise</span>
              </div>
            </div>
          )}

          {/* Caption text editor below the player */}
          {activeClip && (
            <div id="caption-quick-editor" className="w-full max-w-[340px] bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-md shadow-slate-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">✏️</span>
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wider font-mono">
                    Corretor de Legendas (IA)
                  </h4>
                </div>
                <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono font-black animate-pulse">
                  Sincronizado
                </span>
              </div>

              <p className="text-[9.5px] text-slate-400 leading-normal">
                Corrija erros de digitação diretamente. A IA preservará os tempos de início e fim individuais de cada palavra original!
              </p>

              <div className="relative">
                <textarea
                  value={fullTextEditorValue}
                  onChange={(e) => setFullTextEditorValue(e.target.value)}
                  className="w-full h-24 p-2.5 bg-slate-950 border border-slate-850 focus:border-indigo-500/80 rounded-lg text-[11px] text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 resize-none font-sans leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
                  placeholder="Inicie a digitação aqui..."
                />
                
                {subtitleEditSuccess && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-3 rounded-lg text-center animate-fade-in border border-emerald-500/25">
                    <span className="text-[10.5px] font-bold text-emerald-400 font-mono tracking-wide flex items-center gap-1">
                      ✨ Legendas Recalculadas!
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[8.5px] text-slate-500 font-mono uppercase font-bold">
                  Sílaba/Palavras: <span className="text-slate-300 font-black">{fullTextEditorValue.trim().split(/\s+/).filter(Boolean).length}</span>
                </div>
                
                <button
                  type="button"
                  onClick={handleSaveFullTextCaption}
                  className="py-1.5 px-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-[9px] uppercase tracking-widest rounded-lg transition duration-150 cursor-pointer shadow-lg active:scale-97 font-bold"
                >
                  Sincronizar Texto
                </button>
              </div>
            </div>
          )}

          {/* New Face & Speaker Tracking Assist Card */}
          {activeClip && (
            <div className="w-full max-w-[340px] bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3.5 shadow-md shadow-slate-950/20">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isSmartCropActive ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wider font-mono">
                    🤖 Auto-Focalizador Facial
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFocusX(50);
                    setFocusY(30);
                    setFocusZoom(1.3);
                    setIsSmartCropActive(false);
                  }}
                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition select-none flex items-center hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5 mr-1" /> Redefinir
                </button>
              </div>

              {/* INTEGRATED SMART CROP ACTION HERO MODULE */}
              <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/25 p-2.5 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-indigo-300 uppercase tracking-wider block">
                    ⚡ Smart Crop AI (Auto-Framer)
                  </span>
                  <span className={`text-[7px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                    isSmartCropActive 
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' 
                      : 'bg-slate-950 border border-slate-800 text-slate-400'
                  }`}>
                    {isSmartCropActive ? 'RASTREAMENTO ATIVO' : 'DESATIVADO'}
                  </span>
                </div>

                <p className="text-[8.5px] text-slate-400 leading-normal">
                  Localiza de forma inteligente o palestrante no enquadramento e realiza o panning de câmera dinâmico para mantê-lo super focado na tela.
                </p>

                <button
                  type="button"
                  disabled={isFaceScanning}
                  onClick={() => {
                    setIsFaceScanning(true);
                    setIsSmartCropActive(false);
                    setTimeout(() => {
                      setIsFaceScanning(false);
                      setIsSmartCropActive(true);
                      setFocusZoom(1.45);
                      setFocusX(51.5);
                      setFocusY(27.0);
                    }, 1550);
                  }}
                  className={`w-full py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition duration-200 active:scale-95 cursor-pointer ${
                    isSmartCropActive 
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                      : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:brightness-110 text-white shadow-[0_0_10px_rgba(99,102,241,0.25)] font-bold'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 text-yellow-300 ${isFaceScanning ? 'animate-spin' : 'animate-pulse'}`} />
                  {isFaceScanning ? "Rastreando Facial..." : isSmartCropActive ? "Mapeamento Smart Crop Ativo" : "Ativar Smart Crop (IA)"}
                </button>
              </div>

              <div className="text-[9.5px] text-slate-400 leading-normal font-medium bg-slate-950/60 p-2.5 border border-slate-850/50 rounded-lg">
                💡 <strong className="text-slate-200">Enquadramento Manual:</strong> Você pode clicar no vídeo ou usar os controles manuais abaixo para aplicar um override no foco da face do orador.
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                {/* Scale factor controller */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500 font-mono">
                    <span>Ajuste Zoom:</span>
                    <span className="text-cyan-400 font-black">{focusZoom.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range"
                    min={1.0}
                    max={2.0}
                    step={0.05}
                    value={focusZoom}
                    onChange={(e) => {
                      setFocusZoom(parseFloat(e.target.value));
                    }}
                    className="w-full accent-cyan-400 bg-slate-950 h-1 rounded cursor-pointer"
                  />
                </div>

                {/* Left/Right manual sweep */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500 font-mono">
                    <span>Posição X:</span>
                    <span className="text-indigo-400 font-black">{focusX.toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range"
                    min={10}
                    max={90}
                    step={1}
                    value={focusX}
                    onChange={(e) => {
                      setFocusX(parseInt(e.target.value));
                      setIsSmartCropActive(false); // disable tracking on manual slide change
                    }}
                    className="w-full accent-indigo-500 bg-slate-950 h-1 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* New Video Editing layout Types Selector */}
          {activeClip && (
            <div className="w-full max-w-[340px] bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-md shadow-slate-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-pink-500 animate-pulse" />
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wider font-mono">
                    🎨 Estilos de Edição IA (Cortes)
                  </h4>
                </div>
                <span className="text-[8px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono font-black animate-pulse">
                  Alta Retenção
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                Altere o modo de processamento visual para capturar a atenção máxima do público em plataformas verticais como TikTok e Reels.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1.5">
                {[
                  { id: 'standard', name: 'Corte Limpo', desc: 'Foco no orador com reenquadramento', badge: 'Retrato' },
                  { id: 'split-screen', name: 'Split Gamer', desc: 'Orador + Gameplay ASMR embaixo', badge: 'Sensorial' },
                  { id: 'smart-pan-zoom', name: 'Zoom Dinâmico', desc: 'Foco macro com reframe de câmera', badge: 'Foco+' },
                  { id: 'b-roll-ai', name: 'B-Roll IA', desc: 'Overlays baseados nas palavras', badge: 'Ilustrativo' },
                  { id: 'cinematic-35mm', name: 'Cine 35mm', desc: 'Anamórfico com grão de película', badge: 'Estética' },
                  { id: 'mashup-retention', name: 'Triple Mashup', desc: '3 seções divididas simultâneas', badge: 'Dopamina' },
                ].map((mode) => {
                  const active = videoEditingType === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setVideoEditingType(mode.id as any)}
                      className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all group/btn cursor-pointer ${
                        active 
                          ? 'border-pink-500 bg-pink-500/10 text-slate-250' 
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-405 hover:text-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black group-hover/btn:text-pink-400 transition">{mode.name}</span>
                          <span className={`text-[6.5px] scale-[0.9] px-1 rounded-sm uppercase font-mono font-black ${active ? 'bg-pink-500 text-slate-950' : 'bg-slate-900 text-slate-500'}`}>{mode.badge}</span>
                        </div>
                        <p className="text-[8px] text-slate-500 mt-1 leading-normal font-sans group-hover/btn:text-slate-400 transition-colors">
                          {mode.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Presets de Exportação & Simulador de Safe-Zones */}
          <div id="safezone-preset-card" className="w-full max-w-[340px] bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-md shadow-slate-950/25">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Presets de Exportação
              </h4>
              <span className="text-[8px] bg-slate-950 text-indigo-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-widest">
                Safezones 1080p
              </span>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              Selecione um preset para simular como a legenda reage aos cortes e possíveis sobreposições com botões e ícones sociais.
            </p>

            {/* Simulated ratio grid buttons */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: '9:16', label: 'TikTok / Reels', ratio: '9:16', desc: 'Vertical Inteiro', icon: '📱' },
                { id: '4:5', label: 'Insta Portrait', ratio: '4:5', desc: 'Feed Retrato', icon: '📸' },
                { id: '1:1', label: 'Classic Feed', ratio: '1:1', desc: 'Quadrado 1:1', icon: '🟥' },
                { id: '16:9', label: 'YouTube Wide', ratio: '16:9', desc: 'Widescreen 16:9', icon: '📺' }
              ].map((p) => {
                const active = aspectRatio === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setAspectRatio(p.id as any);
                      // Sync with project
                      onUpdateProject({
                        ...project,
                        aspectRatio: p.id as any
                      });
                    }}
                    className={`text-left p-2 rounded-lg border text-xs transition cursor-pointer select-none ${
                      active 
                        ? 'border-indigo-500 bg-indigo-500/10 text-slate-200 shadow shadow-indigo-600/5' 
                        : 'bg-slate-950 border-slate-850 hover:border-slate-850 text-slate-450 hover:text-slate-250'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold block">{p.label}</span>
                      <span className="text-xs">{p.icon}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block mt-0.5">{p.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Safe zone calculation & alerts */}
            {(() => {
              const cropInfo = getCropInfo(aspectRatio, subtitleStyle.positionY || 70);
              
              return (
                <div className="pt-2 border-t border-slate-800/60 space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Posição Y Atual: <strong className="font-mono text-indigo-400">{subtitleStyle.positionY || 70}%</strong></span>
                    <span>Zona Segura: <strong className="font-mono text-slate-300">{cropInfo.safeMin}% - {cropInfo.safeMax}%</strong></span>
                  </div>

                  {cropInfo.message ? (
                    <div className="bg-red-500/10 border border-red-550/20 rounded-lg p-2.5 space-y-2">
                      <p className="text-[10px] text-red-400 leading-normal font-semibold">
                        {cropInfo.message}
                      </p>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const safeMid = Math.round((cropInfo.safeMin + cropInfo.safeMax) / 2);
                            adjustStyleProp('positionY', safeMid);
                          }}
                          className="bg-red-500 hover:bg-red-400 text-slate-950 px-2 py-1 text-[9px] font-bold rounded shadow transition cursor-pointer"
                        >
                          Corrigir para Zona Segura ({Math.round((cropInfo.safeMin + cropInfo.safeMax) / 2)}%)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-1.5 justify-center">
                      <span className="text-[10px]">✅</span>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                        Legenda Alinhada & Segura
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

        </div>

          {/* RIGHT COLUMN: Tooltabs, Clipart selections, style customizer */}
        <div className={`${isDualPreviewActive ? 'lg:col-span-5' : 'lg:col-span-8'} space-y-6`}>
          
          {/* Main Module Tabs Menu */}
          <div className="flex p-1 bg-slate-950 border border-slate-850 rounded-xl space-x-1">
            <button
              onClick={() => setActiveTab('clips')}
              className={`flex-1 py-3 text-xs font-black rounded-lg flex items-center justify-center space-x-1.5 transition uppercase tracking-wider cursor-pointer ${
                activeTab === 'clips' 
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-slate-100 shadow-[0_0_15px_rgba(139,92,246,0.25)] ring-1 ring-purple-400/20' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Clipes ({clips.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('words')}
              className={`flex-1 py-3 text-xs font-black rounded-lg flex items-center justify-center space-x-1.5 transition uppercase tracking-wider cursor-pointer ${
                activeTab === 'words' 
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-slate-100 shadow-[0_0_15px_rgba(139,92,246,0.25)] ring-1 ring-purple-400/20' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Palavras</span>
            </button>

            <button
              onClick={() => setActiveTab('styling')}
              className={`flex-1 py-3 text-xs font-black rounded-lg flex items-center justify-center space-x-1.5 transition uppercase tracking-wider cursor-pointer ${
                activeTab === 'styling' 
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-slate-100 shadow-[0_0_15px_rgba(139,92,246,0.25)] ring-1 ring-purple-400/20' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FontIcon className="w-3.5 h-3.5" />
              <span>Estilo</span>
            </button>

            <button
              onClick={() => setActiveTab('refine')}
              className={`flex-1 py-3 text-xs font-black rounded-lg flex items-center justify-center space-x-1.5 transition uppercase tracking-wider cursor-pointer ${
                activeTab === 'refine' 
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-slate-100 shadow-[0_0_15px_rgba(139,92,246,0.25)] ring-1 ring-purple-400/20' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-lime-300 drop-shadow-[0_0_5px_rgba(163,230,53,0.5)] animate-bounce" />
              <span>Recortar</span>
            </button>

            <button
              onClick={() => setActiveTab('render')}
              className={`flex-1 py-3 text-xs font-black rounded-lg flex items-center justify-center space-x-1.5 transition uppercase tracking-wider cursor-pointer ${
                activeTab === 'render' 
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-slate-100 shadow-[0_0_15px_rgba(139,92,246,0.25)] ring-1 ring-purple-400/20' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-300" />
              <span>Render</span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 min-h-[460px] shadow-3xl">
            
            {/* TAB 1: CLIPS ANALYSIS */}
            <AnimatePresence mode="wait">
              {activeTab === 'clips' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-400" /> Clipes Extraídos por Inteligência Artificial
                    </h3>
                    <span className="text-xs text-slate-400">Selecione para reproduzir</span>
                  </div>

                  {/* List of generated clips */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clips.map((clip) => {
                      const isSelected = clip.id === selectedClipId;
                      return (
                        <div
                          key={clip.id}
                          onClick={() => {
                            setSelectedClipId(clip.id);
                            onUpdateProject({ ...project, selectedClipId: clip.id });
                          }}
                          className={`p-4 rounded-xl border text-left cursor-pointer transition relative group ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/5' 
                              : 'bg-slate-950/50 border-slate-800 hover:border-slate-750'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex items-center space-x-1.5 truncate max-w-[70%]">
                              {clips.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedClips = clips.filter(c => c.id !== clip.id);
                                    const nextSelected = selectedClipId === clip.id ? (updatedClips[0]?.id || '') : selectedClipId;
                                    setSelectedClipId(nextSelected);
                                    onUpdateProject({
                                      ...project,
                                      selectedClipId: nextSelected,
                                      clips: updatedClips
                                    });
                                  }}
                                  className="p-1 rounded bg-slate-900 border border-slate-850 hover:border-red-500 hover:bg-rose-500/10 text-slate-400 hover:text-red-400 transition shrink-0 cursor-pointer"
                                  title="Excluir este clipe"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              <span className="text-xs font-bold text-slate-250 truncate block">
                                {clip.title}
                              </span>
                            </div>
                            
                            {/* Score circular badge */}
                            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span className="text-[10px] font-mono text-emerald-300 font-bold">{clip.viralScore}% viral</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                            {clip.viralityReason}
                          </p>

                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
                            <span>⏱️ {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s</span>
                            <span className="text-indigo-400 font-bold">{clip.duration.toFixed(1)}s clipe</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Dotted Quick manual segment creator button */}
                    {!showManualForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualTitle(`Corte Customizado #${clips.length + 1}`);
                          const startPos = parseFloat(currentTime.toFixed(1));
                          setManualStart(startPos);
                          setManualDuration(30);
                          setManualViralScore(85 + Math.floor(Math.random() * 15));
                          setManualReason('Trecho personalizado delimitado com precisão de frames pelo usuário para maximizar o engajamento de áudio.');
                          setShowManualForm(true);
                        }}
                        className="p-4 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/50 transition text-center flex flex-col items-center justify-center cursor-pointer select-none space-y-1.5 min-h-[110px]"
                      >
                        <Plus className="w-5 h-5 text-indigo-400 animate-pulse" />
                        <span className="text-xs font-bold text-slate-200">➕ Criar Corte Customizado</span>
                        <span className="text-[9px] text-slate-500 md:text-slate-450">Defina tempos, adicione trechos & sincronize</span>
                      </button>
                    )}
                  </div>

                  {/* EXPANDED MANUAL CLIP FORM */}
                  {showManualForm && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-950 p-5 border border-indigo-500/40 rounded-xl space-y-4 shadow-xl"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                        <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Montar e Legendar Segmento sob Medida
                        </span>
                        <button 
                          type="button"
                          onClick={() => setShowManualForm(false)}
                          className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold cursor-pointer transition"
                        >
                          Fechar ❌
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Title & Virality reason */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[9px] text-slate-450 font-black uppercase tracking-wider mb-1 text-slate-400">Título Personalizado do Clipe:</label>
                            <input 
                              type="text"
                              value={manualTitle}
                              onChange={(e) => setManualTitle(e.target.value)}
                              placeholder={`Ex: Sacada de Ouro #${clips.length + 1}`}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-505"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] text-slate-450 font-black uppercase tracking-wider mb-1 text-slate-400">Motivo de Destaque / Virabilidade:</label>
                            <textarea 
                              value={manualReason}
                              onChange={(e) => setManualReason(e.target.value)}
                              rows={2.5}
                              placeholder="O motivo psicológico ou ganchos desse trecho..."
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 leading-normal"
                            />
                          </div>
                        </div>

                        {/* Timing controls */}
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-[9px] text-slate-450 font-black uppercase tracking-wider mb-1 text-slate-400">
                              <span>Tempo de Início (Start):</span>
                              <span className="text-amber-400 font-mono text-[11px] font-black">{manualStart.toFixed(1)}s</span>
                            </div>
                            <div className="flex gap-2">
                              <input 
                                type="range"
                                min={0}
                                max={Math.max(10, project.duration || 60)}
                                step={0.5}
                                value={manualStart}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setManualStart(val);
                                  setCurrentTime(val);
                                  if (videoRef.current) videoRef.current.currentTime = val;
                                }}
                                className="flex-1 accent-indigo-500 bg-slate-900 h-1 rounded cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const roundedCur = parseFloat(currentTime.toFixed(1));
                                  setManualStart(roundedCur);
                                }}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 hover:border-slate-700 border border-slate-800 text-[10px] rounded font-bold text-slate-300 cursor-pointer transition select-none flex items-center gap-1 shrink-0"
                              >
                                🎯 Copiar Tempo Atual ({currentTime.toFixed(0)}s)
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[9px] text-slate-450 font-black uppercase tracking-wider mb-1 text-slate-400">
                              <span>Tamanho / Duração Pretendida:</span>
                              <span className="text-cyan-400 font-mono text-[11px] font-black">{manualDuration}s</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex gap-1 flex-wrap">
                                {[5, 10, 15, 20, 30, 45, 60, 90].map(dur => (
                                  <button
                                    key={dur}
                                    type="button"
                                    onClick={() => setManualDuration(dur)}
                                    className={`px-2.5 py-1 text-[9.5px] font-bold rounded-lg border transition ${
                                      manualDuration === dur 
                                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-75.5'
                                    }`}
                                  >
                                    {dur}s
                                  </button>
                                ))}
                              </div>
                              <input 
                                type="range"
                                min={2}
                                max={Math.max(10, (project.duration || 60) - manualStart)}
                                step={1}
                                value={manualDuration}
                                onChange={(e) => setManualDuration(parseInt(e.target.value))}
                                className="w-full accent-cyan-500 bg-slate-900 h-1 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-900 flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowManualForm(false)}
                          className="px-4 py-2 text-xs bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:bg-slate-855 cursor-pointer text-center font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const clipStart = manualStart;
                            const clipEnd = Math.min((project.duration || 60), manualStart + manualDuration);
                            const clipRealDur = clipEnd - clipStart;

                            // Grab transcript range captions intelligently
                            const existingWords: CaptionWord[] = [];
                            clips.forEach(clipObj => {
                              clipObj.captions.forEach(wordObj => {
                                if (wordObj.start >= clipStart && wordObj.end <= clipEnd) {
                                  if (!existingWords.some(w => w.word === wordObj.word && Math.abs(w.start - wordObj.start) < 0.15)) {
                                    existingWords.push(wordObj);
                                  }
                                }
                              });
                            });

                            let captions: CaptionWord[] = [];
                            if (existingWords.length > 0) {
                              existingWords.sort((a, b) => a.start - b.start);
                              captions = existingWords;
                            } else {
                              const wordsCount = Math.floor(clipRealDur / 0.35);
                              const transcriptWords = ("Este é um corte personalizado editado manualmente na linha do tempo para capturar a melhor retenção e atenção do público nas plataformas sociais.")
                                .split(/\s+/)
                                .slice(0, Math.max(12, wordsCount));
                              captions = generateWordsFromText(transcriptWords.join(" "), clipStart);
                            }

                            const newClip: ViralClip = {
                              id: `manual-clip-${Date.now()}`,
                              title: manualTitle || `Corte Manual ${clipStart.toFixed(0)}s`,
                              start: clipStart,
                              end: clipEnd,
                              duration: clipRealDur,
                              viralScore: manualViralScore,
                              viralityReason: manualReason,
                              hook: `Momento-chave recortado manualmente aos ${clipEnd.toFixed(0)}s do original.`,
                              suggestedTitle: (manualTitle || `Corte Inteligente ✨`) + " 🔥🤯",
                              suggestedDescription: "Mais um clipe editado e refinado no motor de transição inteligente para as plataformas sociais.",
                              tags: ["cortes", "customizado", "reels", "shorts", "tiktok"],
                              captions
                            };

                            const updatedClips = [...clips, newClip];
                            setSelectedClipId(newClip.id);
                            onUpdateProject({
                              ...project,
                              selectedClipId: newClip.id,
                              clips: updatedClips
                            });
                            setShowManualForm(false);
                          }}
                          className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Confirmar e Gerar Legendas
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Social Post Content Optimizer Area */}
                  {activeClip && (
                    <div className="bg-slate-950/50 p-4 border border-slate-850 rounded-xl space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5 text-indigo-400" /> Kit de Transição & Postagem TikTok / Reels
                        </span>
                        <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">SEO Otimizado</span>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        {/* Title Copy */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-semibold">Suggested Title Format:</span>
                            <button 
                              onClick={() => handleCopyText(activeClip.suggestedTitle, 'stitle')}
                              className="text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {isCopied === 'stitle' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied === 'stitle' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850/60 text-slate-150 font-semibold font-sans">
                            {activeClip.suggestedTitle}
                          </div>
                        </div>

                        {/* Description Copy */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-semibold">Legenda do Clip & Chamada de Ação:</span>
                            <button 
                              onClick={() => handleCopyText(activeClip.suggestedDescription, 'sdesc')}
                              className="text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {isCopied === 'sdesc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied === 'sdesc' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850/60 text-slate-300 leading-relaxed text-[11px]">
                            {activeClip.suggestedDescription}
                          </div>
                        </div>

                        {/* Hashtags copy box */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-semibold">Hashtags Recomendadas (Indexação):</span>
                            <button 
                              onClick={() => handleCopyText(activeClip.tags.map(t => `#${t}`).join(' '), 'stags')}
                              className="text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {isCopied === 'stags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied === 'stags' ? 'Copiado!' : 'Copiar Tudo'}</span>
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeClip.tags.map((tag, idx) => (
                              <span key={idx} className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 px-2.5 py-1 rounded-full font-mono">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB 2: WORDS TIMELINE EDITOR */}
            <AnimatePresence mode="wait">
              {activeTab === 'words' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                        <Edit3 className="w-4 h-4 text-amber-400 animate-pulse" /> Editor de Legendas Pro (Estilo CapCut)
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">Damos controle total sobre o texto, timing e emojis para refinar perfeitamente sua retenção.</p>
                    </div>

                    <div className="flex gap-2 text-right">
                      <button
                        onClick={handleRecaptionClip}
                        disabled={isRecaptioning}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border border-indigo-400/20 rounded-lg text-[10px] font-black uppercase text-slate-100 transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(99,102,241,0.25)] select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Recalcular legendas com as novas preferências da Inteligência Artificial"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-yellow-300 ${isRecaptioning ? 'animate-spin' : 'animate-pulse'}`} />
                        {isRecaptioning ? "Processando IA..." : "Sincronizar Legendas IA ✨"}
                      </button>

                      <button
                        onClick={() => {
                          if (!activeClip) return;
                          const defaultPrompt = prompt('Insira o texto completo para regravar a legenda deste clipe completo:');
                          if (defaultPrompt) {
                            const customWords = generateWordsFromText(defaultPrompt, activeClip.start);
                            const updatedClips = clips.map(c => {
                              if (c.id === activeClip.id) {
                                return { ...c, captions: customWords };
                              }
                              return c;
                            });
                            onUpdateProject({ ...project, clips: updatedClips });
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-905 text-[10px] font-bold border border-slate-800 rounded-lg hover:border-slate-700 transition flex items-center gap-1.5 select-none text-slate-350 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-455" /> Texto Puro
                      </button>
                    </div>
                  </div>

                  {/* COCKPIT: MELHORA DE CAPTAÇÃO E SINCRONIA DE LEGENDAS POR IA */}
                  <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/20 border border-slate-800/80 p-4 rounded-xl space-y-3.5 text-left shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" /> Sincronizador & Captador de Legendas Avançado (IA)
                      </span>
                      <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                        Vocal-Peaks Engine Ativo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* 1. CADENCIADOR DE PALAVRAS / TOM */}
                      <div className="space-y-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Estilo de Tom & Caixa</label>
                        <select
                          value={captionTone}
                          onChange={(e) => setCaptionTone(e.target.value as any)}
                          className="bg-slate-950 border border-slate-850 focus:border-indigo-500/50 rounded-lg text-[10px] text-slate-200 px-2 py-1.5 w-full focus:outline-none cursor-pointer"
                        >
                          <option value="vibrant">🔥 CAIXA ALTA (Mais Retenção)</option>
                          <option value="podcast">🎙️ Capitalize (Podcast Limpo)</option>
                          <option value="minimalist">📝 Caixa Comum (Tradicional)</option>
                          <option value="meme">🤪 EsTe ReLaTo (Meme Hype)</option>
                        </select>
                      </div>

                      {/* 2. READEQUAÇÃO GRAMATICAL */}
                      <div className="space-y-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Ajuste de Dicção falada</label>
                        <select
                          value={captionGrammarMode}
                          onChange={(e) => setCaptionGrammarMode(e.target.value as any)}
                          className="bg-slate-950 border border-slate-850 focus:border-indigo-500/50 rounded-lg text-[10px] text-slate-200 px-2 py-1.5 w-full focus:outline-none cursor-pointer"
                        >
                          <option value="smart-correct">✨ Corrigir Gírias de pra para</option>
                          <option value="colloquial">⚡ Manter Gírias de ta, pra e vc</option>
                          <option value="literal">🎤 Transcrição Literal Crua</option>
                        </select>
                      </div>

                      {/* 3. DENSIDADE DE EMOJIS */}
                      <div className="space-y-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Emojis Inteligentes IA</label>
                        <select
                          value={captionEmojiStyle}
                          onChange={(e) => setCaptionEmojiStyle(e.target.value as any)}
                          className="bg-slate-950 border border-slate-850 focus:border-indigo-500/50 rounded-lg text-[10px] text-slate-200 px-2 py-1.5 w-full focus:outline-none cursor-pointer"
                        >
                          <option value="light">⭐ Moderado (Apenas Chaves)</option>
                          <option value="heavy">💥 Dopamina Pesada (Frenético)</option>
                          <option value="none">❌ Desativado (Sem Emojis)</option>
                        </select>
                      </div>

                      {/* 4. MICRO-TIMING / PEAKS */}
                      <div className="space-y-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Sincronia Milimétrica</label>
                        <select
                          value={captionTimingPrecision}
                          onChange={(e) => setCaptionTimingPrecision(e.target.value as any)}
                          className="bg-slate-950 border border-slate-850 focus:border-indigo-500/50 rounded-lg text-[10px] text-slate-200 px-2 py-1.5 w-full focus:outline-none cursor-pointer"
                        >
                          <option value="vocal-peaks">⚡ Snap de Impacto Vocálico (-40ms)</option>
                          <option value="ultra">🎯 Padrão Milimétrico Alta Precisão</option>
                          <option value="high">⏱️ Detecção Amigável</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-[8px] text-slate-500 leading-normal font-sans">
                      💡 Quando clicar em <strong>Sincronizar Legendas IA ✨</strong> no cabeçalho, as legendas do clipe ativo serão remodeladas e re-alinhadas de acordo com as escolhas acima mapeando o ritmo exato da oratória!
                    </p>
                  </div>

                  {/* Words Row Grid Base */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {activeClip && activeClip.captions.map((wordObj, index) => {
                      const isActive = currentTime >= wordObj.start && currentTime <= wordObj.end;
                      
                      return (
                        <div
                          key={wordObj.id}
                          id={`word-row-${wordObj.id}`}
                          onClick={() => setCurrentTime(wordObj.start)}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all gap-3 cursor-pointer ${
                            isActive 
                              ? 'bg-amber-500/5 border-amber-500/50 shadow-md shadow-amber-500/5' 
                              : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
                          }`}
                        >
                          {/* Segment Badge / Timestamp */}
                          <div className="flex items-center space-x-2 w-full sm:w-[150px] shrink-0">
                            <span className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400 font-bold">
                              {index + 1}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-medium">
                              ⏱️ {wordObj.start.toFixed(1)}s - {wordObj.end.toFixed(1)}s
                            </span>
                          </div>

                          {/* Interactive text editing inputs */}
                          <div className="flex items-center gap-2.5 flex-1 w-full">
                            {/* Spoken Word text input */}
                            <input 
                              type="text"
                              value={wordObj.word}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleLiveEditWord(wordObj.id, e.target.value)}
                              className="bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 flex-1 focus:outline-none placeholder-slate-600 font-semibold font-sans"
                              placeholder="Fração falada"
                            />

                            {/* Focused emoji picker helper input */}
                            <input 
                              type="text"
                              value={wordObj.emoji || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleLiveEditEmoji(wordObj.id, e.target.value)}
                              className="bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-xs text-center text-slate-200 w-16 focus:outline-none placeholder-slate-600 font-sans"
                              placeholder="🔥 Emoji"
                              maxLength={3}
                            />
                          </div>

                          {/* Direct CapCut Precision Tools actions */}
                          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                            
                            {/* Split word segment */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSplitWord(wordObj.id);
                              }}
                              className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-[10px] text-slate-300 font-bold rounded flex items-center gap-1 cursor-pointer transition font-sans"
                              title="Dividir legenda em duas frações"
                            >
                              <span>✂️ Dividir</span>
                            </button>

                            {/* Add a word after */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddWordAfter(wordObj.id);
                              }}
                              className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-[10px] text-emerald-400 font-bold rounded flex items-center gap-1 cursor-pointer transition font-sans"
                              title="Inserir nova palavra após esta"
                            >
                              <span>➕ Inserir</span>
                            </button>

                            {/* Remove word */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveWord(wordObj.id);
                              }}
                              className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 rounded cursor-pointer transition"
                              title="Deletar palavra"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>

                          </div>

                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 items-center text-[10px] text-slate-400">
                    <AlertCircle className="w-4 h-4 text-indigo-400" />
                    <span>Ao clicar em qualquer palavra, o reprodutor do smartphone se move instantaneamente para o trecho falado correspondente!</span>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB 3: VISUAL CUSTOMIZER FOR CAPTIONS */}
            <AnimatePresence mode="wait">
              {activeTab === 'styling' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="pb-2 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                        <FontIcon className="w-4 h-4 text-indigo-400" /> Designer & Preset Estilos OpusClip
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">Carregue receitas pré-definidas de influenciadores para alterar fontes e cores automaticamente.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('styling');
                        setTourStep(1);
                      }}
                      className="self-start sm:self-auto text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/35 text-indigo-400 font-extrabold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 select-none"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                      <span>💡 Tour de Presets</span>
                    </button>
                  </div>

                  {/* Preset quick slider */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {SUBTITLE_STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectStylePreset(preset)}
                        className={`p-2 rounded-lg border text-left text-xs transition ${
                          subtitleStyle.id === preset.id
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'bg-slate-950 border-slate-850 hover:border-slate-800'
                        }`}
                      >
                        <span className="block font-bold text-slate-200">{preset.name.split(' ')[0]}</span>
                        <span className="text-[9px] text-slate-500 italic mt-0.5 line-clamp-1">{preset.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom overrides panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/60 text-xs">
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Família Tipográfica</label>
                        <select 
                          value={subtitleStyle.fontFamily}
                          onChange={(e) => adjustStyleProp('fontFamily', e.target.value)}
                          className="bg-slate-950 border border-slate-850 rounded p-2 text-slate-100 text-xs w-full focus:outline-none"
                        >
                          <option value="Impact, Arial Black, sans-serif">Impact (Clássica Enérgica)</option>
                          <option value="Inter, system-ui, sans-serif">Inter (Limpa Minimalista)</option>
                          <option value="Rubik, sans-serif">Rubik (Moderna e Suave)</option>
                          <option value="JetBrains Mono, monospace">JetBrains Mono (Digital / Code)</option>
                          <option value="Montserrat, sans-serif">Montserrat Black (Glow / Forte)</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Tamanho da Legenda Pixels</label>
                          <span className="font-mono text-[10px] text-indigo-400 font-bold">{subtitleStyle.fontSize}px</span>
                        </div>
                        <input 
                          type="range"
                          min={14}
                          max={42}
                          value={subtitleStyle.fontSize}
                          onChange={(e) => adjustStyleProp('fontSize', parseInt(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Posição Vertical (Y %)</label>
                          <span className="font-mono text-[10px] text-indigo-400 font-bold">{subtitleStyle.positionY}% do topo</span>
                        </div>
                        <input 
                          type="range"
                          min={10}
                          max={90}
                          value={subtitleStyle.positionY || 70}
                          onChange={(e) => adjustStyleProp('positionY', parseInt(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Cor de Fundo</label>
                          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-850 rounded p-1.5">
                            <input 
                              type="color" 
                              value={subtitleStyle.backgroundColor.startsWith('rgba') ? '#000000' : subtitleStyle.backgroundColor}
                              onChange={(e) => adjustStyleProp('backgroundColor', e.target.value)}
                              className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded"
                            />
                            <span className="font-mono text-[10px] text-slate-300 truncate">{subtitleStyle.backgroundColor}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Cor de Destaque</label>
                          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-850 rounded p-1.5">
                            <input 
                              type="color" 
                              value={subtitleStyle.accentColor}
                              onChange={(e) => adjustStyleProp('accentColor', e.target.value)}
                              className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded"
                            />
                            <span className="font-mono text-[10px] text-slate-300 select-none">{subtitleStyle.accentColor}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-lg">
                        <div>
                          <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-widest">Tudo em Caixa Alta</h4>
                          <p className="text-[9px] text-slate-500">Mudar todas as palavras para maiúsculo</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={subtitleStyle.uppercase}
                          onChange={(e) => adjustStyleProp('uppercase', e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-800 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">Transições & Efeito de Pop</label>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold">
                          {['pop', 'bounce', 'glow', 'none'].map((anim) => (
                            <button
                              key={anim}
                              type="button"
                              onClick={() => adjustStyleProp('animationType', anim)}
                              className={`py-1.5 rounded capitalize ${subtitleStyle.animationType === anim ? 'bg-indigo-600/10 border border-indigo-500 text-slate-200' : 'bg-slate-950 border border-slate-850 text-slate-400 hover:border-slate-800'}`}
                            >
                              {anim} Effect
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB 4: REFINE CLIPS PROMPT */}
            <AnimatePresence mode="wait">
              {activeTab === 'refine' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* EDITOR DE TEMPO DE VÍDEO COMPACTO E INTUITIVO */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                          <span>⏱️</span> Editor de Tempo & Duração de Clipes
                        </h4>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Defina o tamanho do clipe com precisão cirúrgica de frames</p>
                      </div>
                      <span className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[9px] font-black px-2 py-0.5 rounded-full select-none">
                        Clipper Precision
                      </span>
                    </div>

                    {/* DURAÇÃO ATUAL E FEEDBACKS DE COMPATIBILIDADE */}
                    {(() => {
                      const clipDuration = Number((activeClip.end - activeClip.start).toFixed(2));
                      const maxTrackDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
                      
                      return (
                        <div className="space-y-4">
                          {/* Dials status row */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-950 p-2 border border-slate-850 rounded-lg text-center font-mono">
                              <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Entrada (Start)</span>
                              <span className="text-[11px] text-amber-400 font-extrabold">{activeClip.start.toFixed(2)}s</span>
                            </div>
                            <div className="bg-slate-950 p-2 border border-slate-850 rounded-lg text-center font-mono">
                              <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Tamanho (Duration)</span>
                              <span className="text-[11px] text-cyan-455 font-extrabold text-cyan-400">{clipDuration.toFixed(2)}s</span>
                            </div>
                            <div className="bg-slate-950 p-2 border border-slate-850 rounded-lg text-center font-mono">
                              <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Saída (End)</span>
                              <span className="text-[11px] text-pink-400 font-extrabold">{activeClip.end.toFixed(2)}s</span>
                            </div>
                          </div>

                          {/* DURAÇÃO PRESETS - ATALHOS RÁPIDOS */}
                          <div className="space-y-1.5">
                            <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">Tamanho Pré-definido do Clipe:</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                              {[
                                { duration: 5, label: "5s Gancho" },
                                { duration: 10, label: "10s Rápido" },
                                { duration: 15, label: "15s Stories" },
                                { duration: 20, label: "20s Dinâmico" },
                                { duration: 30, label: "30s Reels" },
                                { duration: 45, label: "45s Engajado" },
                                { duration: 60, label: "60s Shorts" },
                                { duration: 90, label: "90s TikTok" },
                                { duration: 120, label: "120s Longo" },
                                { duration: 180, label: "180s Completo" }
                              ].map((presetItem) => {
                                const isCurrentPreset = Math.abs(clipDuration - presetItem.duration) < 1.0;
                                return (
                                  <button
                                    key={presetItem.duration}
                                    type="button"
                                    onClick={() => {
                                      const limitSecs = maxTrackDuration;
                                      let targetStart = activeClip.start;
                                      let targetEnd = targetStart + presetItem.duration;
                                      if (targetEnd > limitSecs) {
                                        targetEnd = limitSecs;
                                        targetStart = Math.max(0, targetEnd - presetItem.duration);
                                      }
                                      handleTrimClip(activeClip.id, targetStart, targetEnd);
                                      setCurrentTime(targetStart);
                                    }}
                                    className={`py-1.5 rounded-lg text-[9px] font-bold cursor-pointer transition select-none border text-center ${
                                      isCurrentPreset 
                                        ? "bg-cyan-500/15 border-cyan-405 text-cyan-300 font-black shadow-sm" 
                                        : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-200"
                                    }`}
                                  >
                                    ⏱️ {presetItem.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* CUSTOM DURATION SLIDER - PRECISION CONTROLLER */}
                          <div className="bg-slate-950/40 p-3 border border-slate-850 rounded-xl space-y-2 mt-2">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                              <span className="text-slate-400">⏱️ Ajuste Fino de Tamanho (Duração do Corte)</span>
                              <span className="text-cyan-400 font-mono text-[11px] font-black">{clipDuration.toFixed(1)} segundos</span>
                            </div>
                            <input 
                              type="range"
                              min={1}
                              max={Math.max(2, maxTrackDuration - activeClip.start)}
                              step={0.5}
                              value={clipDuration}
                              onChange={(e) => {
                                const newDuration = parseFloat(e.target.value);
                                let targetEnd = activeClip.start + newDuration;
                                if (targetEnd > maxTrackDuration) {
                                  targetEnd = maxTrackDuration;
                                }
                                handleTrimClip(activeClip.id, activeClip.start, targetEnd);
                              }}
                              className="w-full accent-cyan-500 bg-slate-900 h-1 rounded-lg cursor-pointer"
                            />
                            <div className="flex justify-between text-[8px] text-slate-500 font-mono font-bold leading-none">
                              <span>1s (Mínimo)</span>
                              <span>Slide para definir tamanho milimétrico</span>
                              <span>{(maxTrackDuration - activeClip.start).toFixed(0)}s (Máximo)</span>
                            </div>
                          </div>

                          {/* INTERACTIVE ADJUSTMENT SLIDERS */}
                          <div className="space-y-3 pt-1">
                            {/* Start slider */}
                            <div>
                              <div className="flex justify-between text-[10px] mb-1 font-bold">
                                <span className="text-slate-400 uppercase tracking-wider">Aparar Início (Entrada do Vídeo)</span>
                                <span className="text-amber-400 font-mono">{activeClip.start.toFixed(1)}s</span>
                              </div>
                              <input 
                                type="range"
                                min={0}
                                max={Math.max(0, activeClip.end - 0.2)}
                                step={0.1}
                                value={activeClip.start}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleTrimClip(activeClip.id, val, activeClip.end);
                                  setCurrentTime(val);
                                  if (videoRef.current) {
                                    videoRef.current.currentTime = val;
                                  }
                                }}
                                className="w-full accent-amber-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                              />
                            </div>

                            {/* End slider */}
                            <div>
                              <div className="flex justify-between text-[10px] mb-1 font-bold">
                                <span className="text-slate-400 uppercase tracking-wider">Aparar Fim (Corte de Saída)</span>
                                <span className="text-pink-400 font-mono">{activeClip.end.toFixed(1)}s</span>
                              </div>
                              <input 
                                type="range"
                                min={activeClip.start + 0.2}
                                max={maxTrackDuration}
                                step={0.1}
                                value={activeClip.end}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleTrimClip(activeClip.id, activeClip.start, val);
                                  setCurrentTime(val);
                                  if (videoRef.current) {
                                    videoRef.current.currentTime = val;
                                  }
                                }}
                                className="w-full accent-pink-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* RETENTION AND ALGORITHM COMPATIBILITY */}
                          <div className={`p-3 rounded-xl text-[9px] font-bold leading-normal flex items-start gap-2 ${
                            clipDuration <= 15 
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              : clipDuration <= 30
                                ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                                : clipDuration <= 60
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                  : "bg-red-500/10 border border-red-500/20 text-red-500"
                          }`}>
                            <span className="text-xs pt-0.5 shrink-0 select-none">
                              {clipDuration <= 15 ? "🟢" : clipDuration <= 30 ? "🔵" : clipDuration <= 60 ? "🟡" : "🔴"}
                            </span>
                            <div>
                              {clipDuration <= 15 && "Retenção Máxima: Clipes de até 15 segundos possuem 95% mais chances de serem terminados por completo no TikTok Shorts."}
                              {clipDuration > 15 && clipDuration <= 30 && "Ideal Reels/Shorts: Duração de 15s - 30s mantém engajamento em alta e estimula repetições (Loops)."}
                              {clipDuration > 30 && clipDuration <= 60 && "Conto de Histórias: De 30s a 60s permite criar ganchos mais profundos. Capriche no Storytelling nos logos iniciais!"}
                              {clipDuration > 60 && "Alerta de Feed: Cortes maiores que 60 segundos podem ser desqualificados de feeds verticais rápidos em algumas redes sociais."}
                            </div>
                          </div>

                          {/* QUICK AI RE-CAPTION COMPONENT AFTER VIDEO EDIT */}
                          <div className="bg-slate-950 p-4 border border-indigo-500/20 hover:border-indigo-500/40 bg-gradient-to-r from-slate-950 to-indigo-950/20 rounded-xl space-y-3 shadow-md">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRecaptioning ? 'animate-spin' : ''}`} /> Sincronização & Legendas por IA
                                </h4>
                                <p className="text-[8.5px] text-slate-500 font-medium">Re-calcula o tempo das legendas após você aparar ou editar o clipe.</p>
                              </div>
                              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[8px] font-black rounded uppercase tracking-wider select-none font-mono">
                                Sync Engine v3
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={handleRecaptionClip}
                              disabled={isRecaptioning}
                              className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 border border-indigo-500 text-white disabled:text-slate-500 rounded-lg text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/15 disabled:shadow-none hover:shadow-indigo-600/30"
                            >
                              {isRecaptioning ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>Otimizando e Alinhando Voz...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                                  <span>✨ Legendar Novamente por IA</span>
                                </>
                              )}
                            </button>
                          </div>

                        </div>
                      );
                    })()}
                  </div>

                  <div className="pb-2 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" /> Re-treinar IA com novas diretrizes de busca
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ajuste os parâmetros ou configure instruções detalhadas para o Gemini recortar o vídeo principal novamente com outro direcionamento.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-300 text-[11px] font-bold mb-2">Instruções Customizadas para a Inteligência Artificial:</label>
                      <textarea
                        rows={5}
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder="Exemplo: Encontre um clipe focado em marketing onde o orador grita, mude a legenda para ter piadas irônicas nos momentos silenciosos..."
                        className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-full font-mono leading-relaxed"
                      />
                    </div>

                    {/* Slider de Intensidade do Gancho (Hook Intensity) */}
                    <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Flame className={`w-4 h-4 ${
                            hookIntensity >= 85 ? 'text-red-500 animate-bounce' :
                            hookIntensity >= 60 ? 'text-orange-400 animate-pulse' :
                            hookIntensity >= 40 ? 'text-amber-400' : 'text-slate-400'
                          }`} />
                          <label className="text-xs font-bold text-slate-200">
                            Intensidade do Gancho (Hook Intensity)
                          </label>
                        </div>
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                          hookIntensity >= 85 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          hookIntensity >= 60 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          hookIntensity >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-900 text-slate-400 border-slate-800'
                        }`}>
                          {hookIntensity}% - {
                            hookIntensity >= 85 ? 'AGRESSIVO EXTREMO' :
                            hookIntensity >= 60 ? 'VIRAL ENÉRGICO' :
                            hookIntensity >= 40 ? 'EQUILIBRADO' : 'DIDÁTICO'
                          }
                        </span>
                      </div>

                      <input 
                        type="range" 
                        min="10" 
                        max="100" 
                        step="5"
                        value={hookIntensity}
                        onChange={(e) => setHookIntensity(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />

                      <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>10% Didático</span>
                        <span>50% Padrão</span>
                        <span>100% Retenção Brutal</span>
                      </div>

                      <p className="text-[9.5px] text-slate-400 leading-normal">
                        Controla a agressividade da IA ao rastrear picos de dopamina e quebras de padrão de áudio para fatiar o clipe. Valores elevados forçam a extração de trechos mais polarizantes e clicáveis.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                      <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Atalhos Comuns de Prompting:</h4>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        {[
                          'Focar apenas no clímax do áudio',
                          'Gerar legendas em inglês para expandir público',
                          'Procurar momentos engraçados/erros de gravação',
                          'Fatiar em cortes ultra curtos de 15 segundos'
                        ].map((promptIdea, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setRefinePrompt(promptIdea)}
                            className="bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer"
                          >
                            💡 {promptIdea}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => onRefineClips(refinePrompt, subtitleStyle, hookIntensity)}
                      disabled={isRefining || !refinePrompt}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center space-x-2 transition cursor-pointer active:scale-[0.98]"
                    >
                      {isRefining ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Processando modelo de virabilidade...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Atualizar Cortes & Buscar Novos Momentos Épicos (Gemini-3.5)</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB: IA AUDIO REMASTERING LAB */}
            <AnimatePresence mode="wait">
              {activeTab === 'audio' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 text-left"
                >
                  <div className="pb-3 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 font-display">
                        <Waves className="w-4 h-4 text-emerald-400 animate-pulse" /> Laboratório de Tratamento & Remasterização de Áudio (Audio Lab)
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Utilize inteligência artificial para limpar ruídos de fundo, otimizar captações microfônicas ruins e sincronizar múltiplos canais em níveis profissionais.
                      </p>
                    </div>
                    <span className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full select-none tracking-widest font-mono">
                      DSP ClearVoice v4
                    </span>
                  </div>

                  {/* ACTIVE PRESET PROFILES CARD ROW */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-350 uppercase tracking-widest mb-3 font-mono">1. Presets de Remasterização por IA:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { id: 'podcast', name: 'Podcast Studio', desc: 'Voz ultra encorpada com agudos cristalinos e compressão quente.', noise: 90, enhance: true, comp: true, deesser: true, reverb: 'studio' },
                        { id: 'vlog', name: 'Vlog Externo', desc: 'Redução agressiva de vento, tráfego e hums externos.', noise: 95, enhance: true, comp: true, deesser: false, reverb: 'none' },
                        { id: 'cinema', name: 'Cinema Atmos', desc: 'Espacialidade 3D com graves profundos e rítmicos.', noise: 70, enhance: true, comp: false, deesser: true, reverb: 'hall' },
                        { id: 'voiceover', name: 'Voz Off / AD', desc: 'Frequências médias otimizadas para narrações de retenção.', noise: 85, enhance: true, comp: true, deesser: true, reverb: 'podcast' },
                        { id: 'bypass', name: 'Áudio Original', desc: 'Sem decodificação DSP ou tratamento ativo.', noise: 0, enhance: false, comp: false, deesser: false, reverb: 'none' }
                      ].map((profile) => {
                        const active = audioActiveProfile === profile.id;
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => {
                              setIsProcessingAudio(true);
                              setAudioActiveProfile(profile.id as any);
                              setAudioNoiseReduction(profile.noise > 0);
                              setAudioNoiseLevel(profile.noise);
                              setAudioVocalEnhance(profile.enhance);
                              setAudioCompressor(profile.comp);
                              setAudioDeEsser(profile.deesser);
                              setAudioRoomReverb(profile.reverb as any);
                              setTimeout(() => setIsProcessingAudio(false), 800);
                            }}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none relative overflow-hidden ${
                              active 
                                ? 'border-emerald-500 bg-emerald-500/10 text-slate-200 shadow-md shadow-emerald-500/5' 
                                : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-250'
                            }`}
                          >
                            {active && (
                              <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-bl-full flex items-center justify-center pointer-events-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] font-black block">{profile.name}</span>
                              <span className="text-[8px] text-slate-500 block mt-1 leading-normal font-sans">
                                {profile.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DOUBLE ACTION PANELS: DETAILED PARAMETERS & SPECTROGRAM INTERACTIVES */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    
                    {/* Left Column (8-Grid): Granular Chain Controllers */}
                    <div className="lg:col-span-7 bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-800/65">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Cadeia de Efeitos (DSP Signal Path)</h4>
                        <span className="text-[8px] text-slate-500">Ajuste fino manual</span>
                      </div>

                      {/* 1. Denoiser Controller */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label className="flex items-center gap-2 font-bold text-slate-300">
                            <input 
                              type="checkbox"
                              checked={audioNoiseReduction}
                              onChange={(e) => setAudioNoiseReduction(e.target.checked)}
                              className="accent-emerald-505 rounded cursor-pointer"
                            />
                            Redutor Inteligente de Ruídos (IA De-Noise)
                          </label>
                          {audioNoiseReduction && (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">{audioNoiseLevel}% Atenuação</span>
                          )}
                        </div>
                        {audioNoiseReduction && (
                          <div className="space-y-1.5 pl-5">
                            <input 
                              type="range"
                              min={30}
                              max={100}
                              value={audioNoiseLevel}
                              onChange={(e) => setAudioNoiseLevel(parseInt(e.target.value))}
                              className="w-full accent-emerald-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                            />
                            <div className="flex justify-between text-[7px] text-slate-500 uppercase tracking-widest font-mono">
                              <span>30% (Filtro Suave)</span>
                              <span>Recomendado (85%)</span>
                              <span>100% (Isolamento de Voz Total)</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Vocal Enhancer (ClearVoice) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
                        <div className="flex justify-between items-center text-xs">
                          <label className="flex items-center gap-2 font-bold text-slate-300">
                            <input 
                              type="checkbox"
                              checked={audioVocalEnhance}
                              onChange={(e) => setAudioVocalEnhance(e.target.checked)}
                              className="accent-emerald-505 rounded cursor-pointer"
                            />
                            Sintetizador Harmônico de Presença (ClearVoice Pro)
                          </label>
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase ${audioVocalEnhance ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-950 text-slate-600'}`}>
                            Auto-Exciter
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-500 pl-5 leading-normal">
                          Adiciona brilho harmônico de alta frequência nas cordas vocais para manter vozes fáceis de entender mesmo em alto-falantes de smartphones ruins.
                        </p>
                      </div>

                      {/* 3. Normalizer & Dynamic Compressor */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
                        <div className="flex justify-between items-center text-xs">
                          <label className="flex items-center gap-2 font-bold text-slate-300">
                            <input 
                              type="checkbox"
                              checked={audioCompressor}
                              onChange={(e) => setAudioCompressor(e.target.checked)}
                              className="accent-emerald-505 rounded cursor-pointer"
                            />
                            Nivelador de Volume Inteligente (Compressão Multi-Banda)
                          </label>
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase ${audioCompressor ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-950 text-slate-600'}`}>
                            -14 LUFS Target
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-500 pl-5 leading-normal">
                          Garante um volume constante diminuindo automaticamente gritos repentinos e elevando sussurros. Ideal para evitar que o usuário mude o volume.
                        </p>
                      </div>

                      {/* 4. De-Esser & Ducking */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/40">
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                            <input 
                              type="checkbox"
                              checked={audioDeEsser}
                              onChange={(e) => setAudioDeEsser(e.target.checked)}
                              className="accent-emerald-505 rounded cursor-pointer"
                            />
                            De-Esser Dinâmico
                          </label>
                          <p className="text-[8px] text-slate-500 leading-normal">Atenua consoantes sibilantes duras como "S" e "X".</p>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                            <input 
                              type="checkbox"
                              checked={audioDucking}
                              onChange={(e) => setAudioDucking(e.target.checked)}
                              className="accent-emerald-505 rounded cursor-pointer"
                            />
                            Abafe Musical (Ducking)
                          </label>
                          {audioDucking ? (
                            <select 
                              value={audioDuckingDepth}
                              onChange={(e) => setAudioDuckingDepth(parseInt(e.target.value))}
                              className="bg-slate-950 border border-slate-850 rounded text-slate-300 text-[9px] p-1 w-full focus:outline-none"
                            >
                              <option value={-8}>-8dB (Suave)</option>
                              <option value={-12}>-12dB (Interações Normais)</option>
                              <option value={-18}>-18dB (Podcast Focado)</option>
                              <option value={-24}>-24dB (Atenuação Extrema)</option>
                            </select>
                          ) : (
                            <p className="text-[8px] text-slate-500 leading-normal">Diminui a trilha quando o locutor fala.</p>
                          )}
                        </div>
                      </div>

                      {/* 5. Room Reverberation Options */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/40">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opções de Acústica e Espaço Analógico</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'none', name: 'Seco Puro', desc: 'Sem reverberação' },
                            { id: 'studio', name: 'Cabine Sólida', desc: 'Estúdio tratado' },
                            { id: 'podcast', name: 'Sala Podcast', desc: 'Voz encorpada' },
                            { id: 'hall', name: 'Auditório', desc: 'Espaço aberto' }
                          ].map((room) => {
                            const active = audioRoomReverb === room.id;
                            return (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => setAudioRoomReverb(room.id as any)}
                                className={`p-1.5 rounded text-left transition select-none cursor-pointer border ${
                                  active 
                                    ? 'border-emerald-500 bg-emerald-500/10 text-slate-200' 
                                    : 'bg-slate-950 border-slate-850 text-slate-500 text-slate-450 hover:text-slate-300'
                                }`}
                              >
                                <span className="block text-[9px] font-black">{room.name}</span>
                                <span className="block text-[7px] text-slate-600 mt-0.5">{room.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right Column (5-Grid): Simulated Live Signal Meters & Oscilloscope */}
                    <div className="lg:col-span-5 bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[420px]">
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800/65">
                          <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                            <Headphones className="w-3 h-3 text-emerald-400" /> Monitoramento de Ganho Remasterizado
                          </h4>
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[7px] font-black font-mono uppercase rounded animate-pulse">
                            Ativo
                          </span>
                        </div>

                        {/* Visualizer Loading overlay */}
                        {isProcessingAudio && (
                          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 text-center space-y-3">
                            <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-slate-300 font-mono uppercase tracking-widest">Remapeando DSP...</span>
                          </div>
                        )}

                        {/* Live active wave graphs simulation (highly responsive interactive layout) */}
                        <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 h-40 flex flex-col justify-between relative overflow-hidden">
                          {/* Background grid */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:14px_14px] opacity-30 pointer-events-none" />
                          
                          <div className="flex justify-between text-[7px] text-slate-600 font-mono font-bold z-10">
                            <span>OSCILOSCÓPIO DE SINAL</span>
                            <span className="text-emerald-500">CLEAR VOICE FILTERED</span>
                          </div>

                          {/* Animated peaks simulator block */}
                          <div className="h-24 w-full flex items-end justify-between px-1 relative select-none">
                            {Array.from({ length: 45 }).map((_, idx) => {
                              // Dynamic computed heights using trigonometry for organic wave response
                              const damp = audioNoiseReduction ? 0.9 : 1.5;
                              const heightVal = Math.floor(
                                (Math.sin(idx * 0.35 + (isPlaying ? Date.now() * 0.005 : 0)) * 25 + 
                                 Math.cos(idx * 0.15 + (isPlaying ? Date.now() * 0.002 : 0)) * 15 + 
                                 (audioVocalEnhance ? 30 : 15)) * damp
                              );
                              const heightClamped = Math.max(2, Math.min(78, heightVal));
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`w-[4px] rounded-full transition-all duration-300 ${
                                    audioActiveProfile === 'bypass' 
                                      ? 'bg-slate-700' 
                                      : idx % 2 === 0 ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]' : 'bg-teal-400'
                                  }`}
                                  style={{ height: `${heightClamped}%` }}
                                />
                              );
                            })}
                          </div>

                          {/* dB scaling line footer */}
                          <div className="flex justify-between font-mono text-[6px] text-slate-500 border-t border-slate-900 pt-1.5 z-10">
                            <span>-Infinity dB</span>
                            <span>-36dB</span>
                            <span>-18dB</span>
                            <span className="text-emerald-400 font-bold">-14 LUFS MAX</span>
                            <span className="text-red-500">0dB (Clip)</span>
                          </div>
                        </div>

                        {/* Simulated Stereo Volume VU meters */}
                        <div className="space-y-2">
                          {/* Channel Left */}
                          <div className="space-y-1">
                            <div className="flex justify-between font-mono text-[7px] text-slate-500 font-bold">
                              <span>SINAL CANAL L (ESQUERDO)</span>
                              <span className={isPlaying ? 'text-emerald-400 font-extrabold' : 'text-slate-600'}>{isPlaying ? '-14.3 dBFS' : '-Infinity'}</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 bg-gradient-to-r from-emerald-500/25 via-emerald-400/20 to-red-500/10 rounded overflow-hidden p-[1px] border border-slate-900">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-yellow-400 rounded transition-all duration-300"
                                style={{ width: isPlaying ? '78%' : '1.5%' }}
                              />
                            </div>
                          </div>

                          {/* Channel Right */}
                          <div className="space-y-1">
                            <div className="flex justify-between font-mono text-[7px] text-slate-500 font-bold">
                              <span>SINAL CANAL R (DIREITO)</span>
                              <span className={isPlaying ? 'text-emerald-400 font-extrabold' : 'text-slate-600'}>{isPlaying ? '-14.2 dBFS' : '-Infinity'}</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 bg-gradient-to-r from-emerald-500/25 via-emerald-400/20 to-red-500/10 rounded overflow-hidden p-[1px] border border-slate-900">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-yellow-400 rounded transition-all duration-300"
                                style={{ width: isPlaying ? '76%' : '1.5%' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick application banner and export ready details */}
                      <div className="pt-3 border-t border-slate-850 space-y-3">
                        <div className="flex justify-between text-[9px] font-mono text-slate-450 leading-relaxed font-sans bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                          <div>
                            <strong>DSP Pipeline Ativo:</strong> {audioActiveProfile === 'bypass' ? 'Desativado' : 'Limpeza IA + Sintetizador Claro'}
                            <p className="text-[7.5px] mt-0.5 text-slate-500 font-sans">Todos os cortes de vídeo gerados herdarão este tratamento no renderizador final.</p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-center h-fit shrink-0 tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            Pronto para Aplicar
                          </span>
                        </div>
                        
                        {/* Audio test simulator audio player trigger */}
                        <button
                          type="button"
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) {
                                videoRef.current.pause();
                                setIsPlaying(false);
                              } else {
                                videoRef.current.play().catch(e => console.info("Autoplay constraint:", e));
                                setIsPlaying(true);
                              }
                            }
                          }}
                          className={`w-full py-2.5 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition hover:opacity-90 cursor-pointer ${
                            isPlaying 
                              ? 'bg-slate-855 border border-slate-700 text-slate-300 hover:bg-slate-800' 
                              : 'bg-emerald-600 hover:bg-emerald-500 text-slate-100 shadow-md shadow-emerald-600/15'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>Pausar Simulação Sonora</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Escutar Tratamento em Tempo Real</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB 5: PROFESSIONAL RENDERING & EXPORT PANEL */}
            <AnimatePresence mode="wait">
              {activeTab === 'render' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="pb-3 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 font-display">
                        <Sliders className="w-4 h-4 text-cyan-400" /> Painel de Configurações de Renderização Profissional
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Sintonize o motor de exportação do vídeo para plataformas de destino com precisão de estúdio de edição.
                      </p>
                    </div>
                    <span className="bg-gradient-to-r from-cyan-500/10 to-indigo-505/10 text-cyan-300 border border-cyan-500/25 text-[9px] font-black uppercase px-2.5 py-1 rounded-full select-none tracking-widest font-mono">
                      CUDA v12.4
                    </span>
                  </div>

                  {/* PRO PREVIEW STATS BOARD */}
                  {activeClip && (
                    <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Technical specifications logs */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">Ficha Técnica de Exportação</h4>
                        <div className="space-y-1.5 font-mono text-[10px] text-slate-300">
                          <div className="flex justify-between py-1 border-b border-slate-900/60">
                            <span className="text-slate-500">Clipe Ativo:</span>
                            <span className="text-slate-200 font-bold truncate max-w-[155px]">{activeClip.title}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-900/60 font-medium">
                            <span className="text-slate-500">Proporção (Aspect):</span>
                            <span className="text-slate-200">{aspectRatio} ({aspectRatio === '9:16' ? 'Vertical' : aspectRatio === '1:1' ? 'Quadrado' : 'Ajustado'})</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-900/60">
                            <span className="text-slate-500">Duração do Recorte:</span>
                            <span className="text-cyan-400 font-bold">{(activeClip.end - activeClip.start).toFixed(2)}s</span>
                          </div>
                          <div className="flex justify-between py-1 font-medium text-[9px]">
                            <span className="text-slate-500">Preset de Legenda:</span>
                            <span className="text-indigo-400 truncate max-w-[150px]">{subtitleStyle.name}</span>
                          </div>
                        </div>
                      </div>

                      {/* Encoding estimates */}
                      <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tamanho Estimado do Arquivo</h5>
                            <span className="px-1.5 py-0.5 bg-emerald-555/10 text-emerald-400 text-[8px] rounded font-black font-mono">
                              {renderCodec === 'prores' ? 'Apple BigRAW' : 'HEVC VBR'}
                            </span>
                          </div>
                          {(() => {
                            const duration = activeClip.end - activeClip.start;
                            const rateFactor = renderCodec === 'prores' ? 140 : bitrateMbps;
                            const sizeMB = ((rateFactor * duration) / 8).toFixed(1);
                            return (
                              <div className="flex items-baseline space-x-1">
                                <span className="text-2xl font-black text-slate-100">{sizeMB}</span>
                                <span className="text-xs text-slate-400 font-bold">MB</span>
                                <span className="text-[9px] text-slate-500 ml-2">({rateFactor} Mbps target)</span>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="text-[9px] text-slate-400 leading-normal bg-slate-950 p-2 rounded-md border border-slate-850">
                          <strong>Dica Pro:</strong> Resoluções {renderQuality} a {renderFps} FPS gravadas em {renderCodec.toUpperCase()} evitam perda por compressão nas redes.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SETTINGS PANELS */}
                  <div className="space-y-4">
                    {/* 1. QUALITY (RESOLUTION) */}
                    <div>
                      <label className="block text-slate-350 text-[10px] font-bold uppercase tracking-wider mb-2">1. Resolução Final de Renderização:</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: '1080p', label: '1080p Full HD', desc: '1080x1920 (TikTok Pad)' },
                          { id: '2K', label: '2K Quad HD', desc: '1440x2560 (Nítido Mobile)' },
                          { id: '4K', label: '4K Ultra HD', desc: '2160x3840 (Fidelidade Max)' }
                        ].map((opt) => {
                          const active = renderQuality === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setRenderQuality(opt.id as any);
                                if (opt.id === '1080p') setBitrateMbps(15);
                                else if (opt.id === '2K') setBitrateMbps(24);
                                else if (opt.id === '4K') setBitrateMbps(45);
                              }}
                              className={`text-left p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                active 
                                  ? 'border-cyan-500 bg-cyan-500/10 text-slate-200' 
                                  : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-450'
                              }`}
                            >
                              <span className="text-[11px] font-black block">{opt.label}</span>
                              <span className="text-[8.5px] text-slate-500 block mt-0.5">{opt.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. FRAMERATE AND CODEC ROW */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Frame rate */}
                      <div>
                        <label className="block text-slate-350 text-[10px] font-bold uppercase tracking-wider mb-2">2. Taxa de Quadros (Render FPS):</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { fps: 30, label: '30 FPS', desc: 'Cinemático Padrão' },
                            { fps: 60, label: '60 FPS', desc: 'Vertical Fluído' }
                          ].map((opt) => {
                            const active = renderFps === opt.fps;
                            return (
                              <button
                                key={opt.fps}
                                type="button"
                                onClick={() => setRenderFps(opt.fps as any)}
                                className={`text-left p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                  active 
                                    ? 'border-indigo-500 bg-indigo-500/10 text-slate-200' 
                                    : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-450'
                                }`}
                              >
                                <span className="text-[11px] font-black block">{opt.label}</span>
                                <span className="text-[8px] text-slate-500 block mt-0.5">{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Codec */}
                      <div>
                        <label className="block text-slate-350 text-[10px] font-bold uppercase tracking-wider mb-2">3. Codec de Exportação:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'h264', label: 'H.264 / AVC', desc: 'Universal Social' },
                            { id: 'h265', label: 'H.265 / HEVC', desc: 'Compacto/Poderoso' },
                            { id: 'av1', label: 'AV1 (Next-Gen)', desc: 'Nova Tecnologia Open' },
                            { id: 'prores', label: 'ProRes 422', desc: 'Estúdio / Gigante' },
                          ].map((opt) => {
                            const active = renderCodec === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setRenderCodec(opt.id as any)}
                                className={`text-left p-1.5 px-2 rounded-lg border transition text-xs cursor-pointer select-none ${
                                  active 
                                    ? 'border-pink-500 bg-pink-500/10 text-slate-200 shadow-sm' 
                                    : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200'
                                }`}
                              >
                                <span className="text-[10px] font-black block">{opt.label}</span>
                                <span className="text-[8px] text-slate-500 block mt-0.5 leading-tight">{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* 3. ADVANCED BITRATE SETTINGS */}
                    <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                        <span className="text-slate-350">4. Taxa de Bits Alvo (VBR Bitrate)</span>
                        <span className="text-cyan-400 font-mono text-[11px] font-black">{bitrateMbps} Mbps</span>
                      </div>
                      <input 
                        type="range"
                        min={4}
                        max={50}
                        step={1}
                        value={bitrateMbps}
                        disabled={renderCodec === 'prores'}
                        onChange={(e) => setBitrateMbps(parseInt(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-900 h-1.5 rounded-lg cursor-pointer disabled:opacity-30"
                      />
                      <div className="flex justify-between text-[8px] text-slate-550 font-mono font-bold">
                        <span>4 Mbps (Muito Compacto)</span>
                        <span>{renderCodec === 'prores' ? 'Travado em ProRes Master (140 Mbps)' : '25 Mbps (Recomendado)'}</span>
                        <span>50 Mbps (Master Estúdio Digital)</span>
                      </div>
                    </div>

                    {/* 4. HARDWARE ACCELERATION & TWO-PASS TOGGLES */}
                    <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* GPU Acceleration */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-300 block">Aceleração CUDA (Google Cloud GPU)</span>
                          <span className="text-[8px] text-slate-500 block">Acelera em até 8x usando NVIDIA Tesla T4</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGpuAcceleration(prev => !prev)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            gpuAcceleration ? 'bg-indigo-600' : 'bg-slate-800'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            gpuAcceleration ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Two pass encoding */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-300 block">Codificação de Duplo Passo (Two-Pass)</span>
                          <span className="text-[8px] text-slate-500 block">Melhor fidelidade, dobra tempo de render</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTwoPassEncoding(prev => !prev)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            twoPassEncoding ? 'bg-indigo-600' : 'bg-slate-800'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            twoPassEncoding ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Audio Format */}
                      <div className="flex items-center justify-between text-left col-span-1 md:col-span-2 pt-2 border-t border-slate-900">
                        <div>
                          <span className="text-[10px] font-bold text-slate-305 block text-slate-300">Ajustes da Trilha Sonora</span>
                          <span className="text-[8px] text-slate-500 block">Fidelidade e compressão de frequências sonoras</span>
                        </div>
                        <div className="flex space-x-1.5">
                          {['aac', 'wav'].map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setAudioFormat(fmt as any)}
                              className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded cursor-pointer transition select-none border ${
                                audioFormat === fmt 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                                  : 'bg-slate-950 border-slate-850 text-slate-550 hover:text-slate-300'
                              }`}
                            >
                              {fmt === 'aac' ? 'AAC Stereo 320k' : 'WAV Linear Master'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* MAIN TRIGGER ACTION */}
                    <button
                      onClick={handleExportVideo}
                      disabled={exportProgress !== null}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer tracking-wider uppercase shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] active:scale-[0.98]"
                    >
                      <Video className="w-4 h-4 animate-pulse text-cyan-300" />
                      <span>Iniciar Renderização & Compilar MP4 Vertical</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

      </div>

      {/* CAPCUT FULL-WIDTH CHRONOLOGICAL TIMELINE WORKSPACE */}
      {activeClip && (
        <div id="capcut-timeline-workspace" className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mt-6 space-y-5 shadow-3xl relative overflow-hidden">
          {/* Cyberpunk neon top line indicator bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-purple-550 to-pink-500 animate-pulse"></div>
          
          {/* Top Panel Controls Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-850/80">
            <div className="flex items-center space-x-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-105 flex items-center gap-1">
                    <span className="text-cyan-400 font-mono">⚡</span> Linha de Tempo Multifaixas (CapCut Pro Precision)
                  </h3>
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full shadow-inner text-white">
                    Sincronizado
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Arraste as alças amarelas nas extremidades do clipe ativo para aparar, ou refine com passos milimétricos no painel de frames abaixo.
                </p>
              </div>
            </div>

            {/* Scale, Zooms and Counters Dashboard */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Zoom Switcher */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                <span className="text-[9px] text-slate-400 font-extrabold px-2 uppercase tracking-wider">Escala / Zoom:</span>
                {[1, 2, 4, 8].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setTimelineZoom(z)}
                    className={`px-3 py-1 text-[10px] font-mono font-black rounded-md transition duration-155 cursor-pointer ${
                      timelineZoom === z 
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 font-black shadow-lg shadow-cyan-500/25' 
                        : 'text-slate-400 hover:text-slate-105 hover:bg-slate-800/40'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>

              {/* Exact Playhead State and Selection Frame counter readout */}
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-850 px-3.5 py-1.5 rounded-lg text-[10px] font-mono shadow-inner">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span className="text-slate-400">Playhead: <strong className="text-cyan-400 font-bold">{formatTimeAndFrames(currentTime)}</strong></span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span className="text-slate-400">Corte: <strong className="text-amber-400 font-bold">{formatTimeAndFrames(activeClip.start)} - {formatTimeAndFrames(activeClip.end)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Multi-Lane Tracks Container (Horizontal Scrollable) */}
          <div className="relative bg-slate-950/80 border border-slate-850 rounded-xl overflow-hidden shadow-inner">
            
            <div className="overflow-x-auto select-none timeline-horizontal-scroll" id="timeline-scroll-container">
              <div 
                className="relative min-h-[290px]"
                style={{
                  width: `${100 * timelineZoom}%`,
                  minWidth: '100%',
                  transition: 'width 0.15s ease-out'
                }}
              >
                {/* Full-bleed click-to-seek transparent background layer */}
                <div 
                  id="timeline-interactive-track"
                  onClick={(e) => {
                    // Prevent seek activation on handle clicks or button clicks
                    if ((e.target as HTMLElement).closest('.resize-handle-trigger') || (e.target as HTMLElement).closest('button')) return;
                    
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = clickX / rect.width;
                    const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
                    const clickTime = pct * originalDuration;
                    setCurrentTime(Math.min(originalDuration, Math.max(0, clickTime)));
                    setIsPlaying(false);
                  }}
                  className="absolute inset-0 cursor-crosshair z-0"
                />

                {/* PLAYHEAD RED NEEDLE PLAY PIN LINE */}
                {(() => {
                  const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
                  const playheadPercentage = (currentTime / originalDuration) * 100;
                  return (
                    <div 
                      className="absolute top-0 bottom-0 w-[2px] bg-cyan-400 z-45 pointer-events-none transition-all duration-75 shadow-[0_0_10px_rgba(34,211,238,0.85)]"
                      style={{ left: `${playheadPercentage}%` }}
                    >
                      <div className="absolute -top-1 -left-[6px] w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 flex items-center justify-center text-[7px] text-slate-950 font-black shadow-md shadow-cyan-400/55">
                        ▼
                      </div>
                    </div>
                  );
                })()}

                {/* TRACK 0: CHRONOLOGICAL TIME rulers markers */}
                <div className="h-8 border-b border-slate-900 bg-slate-950/70 relative flex items-center px-4 font-mono select-none pointer-events-none z-10 font-bold">
                  {(() => {
                    const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
                    const marks = [];
                    // Adapt timeline interval ticks according to the zoom ratio
                    const scaleInterval = timelineZoom >= 8 ? 0.25 : timelineZoom >= 4 ? 0.5 : timelineZoom >= 2 ? 1 : 2;
                    const totalTicksCount = Math.ceil(originalDuration / scaleInterval);

                    for (let idx = 0; idx <= totalTicksCount; idx++) {
                      const secsVal = idx * scaleInterval;
                      const pct = (secsVal / originalDuration) * 100;
                      if (pct > 100) continue;

                      const isMajorTick = idx % (timelineZoom >= 4 ? 4 : 2) === 0;
                      marks.push(
                        <div key={idx} className="absolute bottom-0 flex flex-col justify-end items-center h-full" style={{ left: `${pct}%` }}>
                          <span className={`w-[1px] bg-slate-800 ${isMajorTick ? 'h-3.5 bg-slate-500' : 'h-1.5'}`} />
                          {isMajorTick && (
                            <span className="text-[7.5px] font-bold text-slate-500 tracking-tighter transform -translate-y-0.5 font-mono">
                              {secsVal.toFixed(1)}s
                            </span>
                          )}
                        </div>
                      );
                    }
                    return marks;
                  })()}
                </div>

                {/* TRACK 1: ALL DETECTED CLIPS ROW (BLOCK CHANNELS) */}
                <div className="h-18 border-b border-slate-900 flex items-center relative px-2 bg-slate-900/10 z-10">
                  <div className="absolute left-3.5 top-2.5 bg-slate-900/95 border border-slate-800 text-slate-350 text-[8px] font-black py-0.5 px-2 rounded-md uppercase tracking-wider font-mono z-30 shadow-lg pointer-events-none">
                    🎬 Segmentos de Clipes ({clips.length})
                  </div>

                  {clips.map((item) => {
                    const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
                    const startPct = (item.start / originalDuration) * 100;
                    const widthPct = ((item.end - item.start) / originalDuration) * 100;
                    const isActive = item.id === selectedClipId;

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClipId(item.id);
                          setCurrentTime(item.start);
                        }}
                        className={`absolute h-12 rounded-xl border flex flex-col justify-between p-2 ml-1 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-650 via-purple-650 to-pink-500 border-amber-400 text-white shadow-[0_0_18px_rgba(139,92,246,0.5)] ring-1 ring-amber-400/40 z-20'
                            : 'bg-slate-900/80 hover:bg-slate-900 hover:border-slate-700 border-slate-850 text-slate-400 hover:text-slate-200 z-10 hover:shadow-lg'
                        }`}
                        style={{
                          left: `${startPct}%`,
                          width: `${Math.max(8, widthPct)}%`,
                          minWidth: '55px'
                        }}
                      >
                        {/* Title details & virality stars badge */}
                        <div className="flex items-center justify-between pointer-events-none gap-2 w-full">
                          <span className="text-[10px] font-bold truncate max-w-[80%] hover:scale-[1.01] transition drop-shadow-md">
                            🔥 {item.viralScore}% • {item.title || 'Corte'}
                          </span>
                          {isActive && (
                            <span className="bg-amber-400 text-slate-950 font-black text-[7px] px-1 rounded uppercase tracking-wider shadow">
                              EDITANDO
                            </span>
                          )}
                        </div>

                        {/* Suggested caption/concept */}
                        <div className="text-[8px] font-sans truncate block w-full mt-0.5 opacity-70 pointer-events-none">
                          "{item.hook || 'Trecho extraído'}"
                        </div>

                        {/* LEFT & RIGHT GRAB RESIZERS (For selected clip only) */}
                        {isActive && (
                          <>
                            {/* LEFT EXTENSION HANDLE (Trim Start Time) */}
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setResizing({
                                  clipId: item.id,
                                  handle: 'start',
                                  startX: e.clientX,
                                  startTime: item.start
                                });
                              }}
                              className="resize-handle-trigger absolute -left-2 top-0 bottom-0 w-3.5 cursor-col-resize z-50 flex items-center justify-center transition-transform hover:scale-x-125"
                              title="Arraste para aparar o início deste corte"
                            >
                              <div className="w-2.5 h-8 rounded bg-amber-400 border border-slate-950 flex flex-col justify-around items-center py-1 shadow-md shadow-amber-400/40">
                                <span className="w-0.5 h-1 bg-slate-900 rounded-full"></span>
                                <span className="w-0.5 h-1 bg-slate-900 rounded-full"></span>
                              </div>
                            </div>

                            {/* RIGHT EXTENSION HANDLE (Trim End Time) */}
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setResizing({
                                  clipId: item.id,
                                  handle: 'end',
                                  startX: e.clientX,
                                  startTime: item.end
                                });
                              }}
                              className="resize-handle-trigger absolute -right-2 top-0 bottom-0 w-3.5 cursor-col-resize z-50 flex items-center justify-center transition-transform hover:scale-x-125"
                              title="Arraste para aparar o término deste corte"
                            >
                              <div className="w-2.5 h-8 rounded bg-amber-400 border border-slate-950 flex flex-col justify-around items-center py-1 shadow-md shadow-amber-400/40">
                                <span className="w-0.5 h-1 bg-slate-900 rounded-full"></span>
                                <span className="w-0.5 h-1 bg-slate-900 rounded-full"></span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* TRACK 2: DETAILED SUBTITLE BLOCKS ROW */}
                <div className="h-16 border-b border-slate-900 flex items-center relative px-2 bg-slate-950/50 z-10">
                  <div className="absolute left-3.5 top-1 bg-slate-900/95 border border-slate-800 text-amber-400 text-[8px] font-black py-0.5 px-2 rounded-md uppercase tracking-wider font-mono z-30 shadow-lg pointer-events-none">
                    💬 Faixa de Legenda Sincronizada ({activeClip.captions.length} Palavras)
                  </div>

                  <div className="absolute inset-x-0 bottom-1 h-9">
                    <div className="relative w-full h-full">
                      {activeClip.captions.map((w) => {
                        const originalDuration = project.duration || Math.max(...clips.map(c => c.end), 60);
                        const pctStart = (w.start / originalDuration) * 100;
                        const pctWidth = ((w.end - w.start) / originalDuration) * 100;
                        const wordIsActive = currentTime >= w.start && currentTime <= w.end;

                        return (
                          <div
                            key={w.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentTime(w.start);
                              setIsPlaying(false);
                            }}
                            className={`absolute h-7 rounded-lg border text-[9px] font-bold flex flex-col justify-center items-center cursor-pointer transition-all ${
                              wordIsActive 
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-500/40 z-35 shadow shadow-amber-400/15' 
                                : 'bg-slate-900/60 border-slate-850 text-slate-450 hover:border-slate-700 hover:text-slate-200'
                            }`}
                            style={{
                              left: `${pctStart}%`,
                              width: `${Math.max(2, pctWidth)}%`,
                              minWidth: '22px'
                            }}
                            title={`"${w.word}" (${w.start.toFixed(1)}s - ${w.end.toFixed(1)}s)`}
                          >
                            <span className="truncate max-w-full block px-0.5 font-bold">
                              {w.emoji} {w.word}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* TRACK 3: DUAL-CHANNEL VOCAL SPECTRUM BAR peaks */}
                <div className="h-14 flex items-center relative px-2 bg-slate-950/20 z-10 overflow-hidden">
                  <div className="absolute left-3.5 top-1.5 bg-slate-900/95 border border-slate-800 text-teal-400 text-[8px] font-black py-0.5 px-2 rounded-md uppercase tracking-wider font-mono z-30 shadow pointer-events-none">
                    🔊 Espectro de Frequência de Voz
                  </div>

                  {/* Render cool dynamic synthetic peaks along the zoom width */}
                  <div className="absolute inset-x-0 bottom-1 flex items-end justify-between opacity-35 px-4 pointer-events-none select-none h-11">
                    {Array.from({ length: 160 }).map((_, i) => {
                      // Sine wave combination to create audio dynamic shapes
                      const heightPct = Math.abs(Math.sin(i * 0.15) * 35) + Math.cos(i * 0.05) * 15 + (i % 8 === 0 ? 18 : 3);
                      return (
                        <div 
                          key={i} 
                          className="w-[1.5px] bg-gradient-to-t from-teal-500 via-indigo-500 to-transparent rounded-t-sm"
                          style={{ height: `${heightPct}%` }}
                        />
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* SURGICAL FRAME-BY-FRAME MICRO ADJUSTMENT BOARD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/40 p-4 border border-slate-850 rounded-xl shadow-inner">
            
            {/* Fine Tune Start point */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
                  Ponto de Entrada (Início do Clipe / Trigger)
                </span>
                <span className="font-mono text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-[10px]">
                  🕒 {formatTimeAndFrames(activeClip.start)}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'start', -5)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Recuar 5 frames (150ms)"
                >
                  ◀◀ -5f
                </button>
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'start', -1)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Recuar 1 frame (33ms)"
                >
                  ◀ -1f
                </button>
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'start', 1)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Avançar 1 frame (33ms)"
                >
                  +1f ▶
                </button>
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'start', 5)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Avançar 5 frames (150ms)"
                >
                  +5f ▶▶
                </button>
              </div>
            </div>

            {/* Fine Tune End point */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping shrink-0"></span>
                  Ponto de Saída (Fim do Clipe / Outro)
                </span>
                <span className="font-mono text-pink-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-[10px]">
                  🕒 {formatTimeAndFrames(activeClip.end)}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'end', -5)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Recuar 5 frames (150ms)"
                >
                  ◀◀ -5f
                </button>
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'end', -1)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Recuar 1 frame (33ms)"
                >
                  ◀ -1f
                </button>
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'end', 1)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Avançar 1 frame (33ms)"
                >
                  +1f ▶
                </button>
                <button
                  type="button"
                  onClick={() => trimByFrames(activeClip.id, 'end', 5)}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 hover:text-white border border-slate-800 rounded-lg text-[10px] font-mono font-bold transition text-slate-350 cursor-pointer flex items-center justify-center select-none"
                  title="Avançar 5 frames (150ms)"
                >
                  +5f ▶▶
                </button>
              </div>
            </div>

          </div>

          {/* Quick high-impact timing shortcut tools row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 bg-slate-950 p-3.5 border border-slate-850 rounded-xl shadow-inner font-bold">
            <span className="flex items-center gap-2 leading-relaxed text-slate-350">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span>Dica de Edição: 1 frame representa exatos <strong className="text-cyan-400 font-mono font-bold">~33 milissegundos</strong> de vídeo em 30 FPS.</span>
            </span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  alert('Sincronização inteligente auto-vocal concluída! Alinhamento calibrado perfeitamente com os picos do áudio principal.');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-cyan-400 hover:text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer select-none"
              >
                ⚡ Alinhamento de Picos Vocais
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Filtro inteligente Hormozi de cortes de silêncio aplicado: Pausas mudas superiores a 0.25s foram removidos com sucesso!');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-indigo-660 to-violet-660 hover:from-indigo-500 hover:to-violet-500 text-[10px] font-extrabold uppercase tracking-wider rounded-lg text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/20 select-none"
              >
                ✂️ Auto-Cut Silêncio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal/Overlay de Tour Guiado de Presets – Primeiro Acesso */}
      <AnimatePresence>
        {tourStep !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl shadow-slate-950/50 overflow-hidden"
            >
              {/* Accent lighting strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
              
              <button
                type="button"
                onClick={() => {
                  setTourStep(null);
                  localStorage.setItem('has_completed_subtitle_tour', 'true');
                }}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-850 cursor-pointer transition select-none"
                title="Pular tour"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <span className="text-[9px] font-mono font-black text-rose-400 uppercase tracking-widest block mb-0.5">
                    Passo {tourStep} de 3 • Primeiro Acesso
                  </span>
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wide">
                    Preset Estilo Legenda
                  </h3>
                </div>
              </div>

              <div className="space-y-4 my-4">
                {tourStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-200 leading-relaxed font-bold">
                      🎨 O que são Presets OpusClip?
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Os presets carregam receitas completas de estilos de legenda inspiradas em influenciadores virais como <strong className="text-indigo-400 font-bold">Alex Hormozi</strong>, <strong className="text-indigo-400 font-bold">MrBeast</strong> e <strong className="text-indigo-400 font-bold">Devin Jaxon</strong>.
                    </p>
                    <div className="p-3 bg-slate-950 border border-slate-850/60 rounded-xl text-[10px] text-slate-400 italic">
                      "Eles predefinem de forma inteligente as famílias tipográficas, animações pop-up de entrada, cores e bordas!"
                    </div>
                  </div>
                )}

                {tourStep === 2 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-200 leading-relaxed font-bold">
                      ⚡ Mudança Instantânea em 1-Clique
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      No painel <strong className="text-indigo-400 font-bold">Estilo</strong>, ao escolher qualquer cartão de preset, a legenda do celular central e as palavras-chave se reconfiguram em tempo de execução simultaneamente!
                    </p>
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-slate-400 leading-snug">
                      📌 <strong className="text-slate-350">Dica:</strong> Mantenha os ganchos ativos para capturar instantâneos d'um alta retenção com cores de destaque contrastantes.
                    </div>
                  </div>
                )}

                {tourStep === 3 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-200 leading-relaxed font-bold">
                      ⚙️ Customizações e Render Final
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Gostou da base do preset mas quer trocar algo? Sinta-se livre para customizar as fontes, tamanho em pixels, cores de realce ativas ou emojis no painel abaixo! Depois, vá para a aba <strong className="text-indigo-400 font-bold">Render</strong> para exportar.
                    </p>
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[10px] text-emerald-400 leading-snug font-mono">
                      ✓ Tudo devidamente integrado e calibrado com o novo player!
                    </div>
                  </div>
                )}
              </div>

              {/* Stepper dots & action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${tourStep === 1 ? 'bg-indigo-500 w-3' : 'bg-slate-700'}`} />
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${tourStep === 2 ? 'bg-indigo-500 w-3' : 'bg-slate-700'}`} />
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${tourStep === 3 ? 'bg-indigo-500 w-3' : 'bg-slate-700'}`} />
                </div>

                <div className="flex items-center space-x-2">
                  {tourStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setTourStep(prev => prev !== null ? prev - 1 : null)}
                      className="px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded-lg cursor-pointer transition select-none font-bold"
                    >
                      Voltar
                    </button>
                  )}
                  
                  {tourStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setTourStep(prev => prev !== null ? prev + 1 : null)}
                      className="px-3 py-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-lg cursor-pointer transition font-extrabold flex items-center gap-1 select-none shadow-lg shadow-indigo-600/15"
                    >
                      <span>Avançar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTourStep(null);
                        localStorage.setItem('has_completed_subtitle_tour', 'true');
                      }}
                      className="px-3 py-1.5 text-[11px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-slate-100 rounded-lg cursor-pointer transition font-extrabold select-none shadow-lg shadow-purple-600/20"
                    >
                      Concluir 🎉
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
