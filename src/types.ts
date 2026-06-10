export interface CaptionWord {
  id: string;
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
  emoji?: string; // e.g. "🔥" or "💡"
}

export interface ViralClip {
  id: string;
  title: string;
  start: number; // seconds
  end: number;   // seconds
  duration: number; // seconds
  viralScore: number; // 0-100 rating
  viralityReason: string; // Explaining why it's viral
  hook: string; // Engaging hook sentence
  suggestedTitle: string; // e.g. for TikTok/Shorts
  suggestedDescription: string;
  tags: string[];
  captions: CaptionWord[];
}

export interface SubtitleStylePreset {
  id: string;
  name: string;
  fontFamily: string; // 'Inter', 'Space Grotesk', 'JetBrains Mono', 'Impact', 'Rubik'
  fontSize: number; // size relative multiplier/unit
  primaryColor: string; // text body color (hex, e.g. "#FFFFFF")
  accentColor: string; // active highlighted word color (hex, e.g. "#00FF66" / "#FFFF00")
  backgroundColor: string; // container base bg color format (hex or rgba)
  animationType: 'bounce' | 'pop' | 'glow' | 'none';
  uppercase: boolean;
  textShadow: string; // e.g. '2px 2px 0px #000'
  positionY: number; // 0 to 100 percentage from top of 9:16 frame (default is 75)
}

export interface VideoPreset {
  id: string;
  title: string;
  speaker: string;
  category: string;
  description: string;
  videoUrl?: string; // optional simulated placeholder fallback URL
  duration: number; // seconds
  transcript: string;
}

export interface Project {
  id: string;
  title: string;
  originalVideoName: string;
  videoUrl: string;
  duration: number;
  status: 'draft' | 'uploading' | 'analyzing' | 'completed' | 'error';
  selectedClipId?: string;
  clips?: ViralClip[];
  subtitleStyle: SubtitleStylePreset;
  aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
  createdAt: string;
}
