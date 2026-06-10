import { VideoPreset, ViralClip, CaptionWord, SubtitleStylePreset } from '../types';

export const SUBTITLE_STYLE_PRESETS: SubtitleStylePreset[] = [
  {
    id: 'hormozi',
    name: 'Alex Hormozi (Bold)',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 28,
    primaryColor: '#FFFFFF',
    accentColor: '#FFDF00', // Yellow
    backgroundColor: '#000000',
    animationType: 'pop',
    uppercase: true,
    textShadow: '3px 3px 0px #000000',
    positionY: 70
  },
  {
    id: 'abdaal',
    name: 'Ali Abdaal (Classic)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 20,
    primaryColor: '#FDFDFD',
    accentColor: '#00FF99', // Lime green
    backgroundColor: 'rgba(15, 15, 15, 0.75)',
    animationType: 'bounce',
    uppercase: false,
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    positionY: 75
  },
  {
    id: 'beast',
    name: 'MrBeast Viral',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 26,
    primaryColor: '#FFFFFF',
    accentColor: '#00E5FF', // Cyan
    backgroundColor: '#050505',
    animationType: 'glow',
    uppercase: true,
    textShadow: '2px 2px 4px #000000',
    positionY: 65
  },
  {
    id: 'minimalist',
    name: 'Minimal Clean',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 18,
    primaryColor: '#E2E8F0',
    accentColor: '#F43F5E', // Rose red
    backgroundColor: 'rgba(0,0,0,0.5)',
    animationType: 'none',
    uppercase: false,
    textShadow: 'none',
    positionY: 80
  }
];

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'deep-work',
    title: 'O Segredo das Duas Primeiras Horas (PodCast)',
    speaker: 'Dr. Lucas Ribeiro (Neurocientista)',
    category: 'Produtividade & Foco',
    description: 'Uma explicação científica de como as notificações matam o seu faturamento e como proteger as duas primeiras horas do seu dia.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-explaining-something-with-hand-gestures-42289-large.mp4',
    duration: 80,
    transcript: 'O maior erro do jovem moderno ao acordar é olhar o telefone celular nos primeiros cinco minutos. Sabe por que? Quando você faz isso, seu cérebro que estava em ondas alfa, um estado de criatividade puro, recebe uma descarga instantânea de dopamina barata. Você é inundado de problemas de outras pessoas, e-mails de cobrança, notificações de redes sociais. Sua atenção fica fragmentada para o resto do dia inteiro. Se você quer de verdade faturar dez vezes mais e ter um foco implacável, faça o seguinte: proteja as duas primeiras horas do seu dia. Sem celular, sem reuniões, sem interrupções. Use esse tempo para o trabalho profundo, o deep work. É nesse bloco que o seu cérebro opera em alta performance cognitiva. O resto do dia? É só gerenciamento de danos!'
  },
  {
    id: 'success-cost',
    title: 'Empreendedorismo vs Amadorismo (Palestra)',
    speaker: 'Marcus Andrade',
    category: 'Negócios & Carreira',
    description: 'A diferença brutal entre quem trata negócios como hobby e os profissionais que aplicam a regra inegociável dos 90 dias.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-businessman-gesticulating-during-a-speech-41007-large.mp4',
    duration: 75,
    transcript: 'Sabe qual é a grande mentira do marketing digital? É que o sucesso acontece da noite para o dia. Mentira! As pessoas me veem hoje e acham que foi fácil. Mas deixa eu abrir o jogo aqui com vocês. Amadores tratam o seu negócio como um hobby. Se estão motivados, trabalham. Se está chovendo ou estão com preguiça, não fazem nada. O profissional opera por disciplina e padrão. Existe uma regra que eu chamo de Regra dos Noventa Dias. Tudo o que você planta hoje, você só vai colher daqui a três meses. Se você parar de criar conteúdo, de vender e de estudar esta semana, você não perde o resultado hoje de noite; você destrói o seu trimestre inteiro! Comece a gerenciar o seu effort como empresa, não como brincadeira de criança!'
  },
  {
    id: 'emoji-secret',
    title: 'A História Secreta que Ninguém te Conta (Storytelling)',
    speaker: 'Tiago Tech',
    category: 'Curiosidades & Tecnologia',
    description: 'Como uma piada no Japão forçou a Apple e o Google a adotarem emojis, mudando a comunicação humana para sempre.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-recording-a-video-with-his-phone-41005-large.mp4',
    duration: 65,
    transcript: 'Você sabia que o primeiro emoji do mundo foi criado por acidente em mil novecentos e noventa e nove por um designer japonês chamado Shigetaka Kurita? Na época, as operadoras de telefonia no Japão só davam duzentos e vinte e cinco caracteres por mensagem de texto convencional. O Shigetaka pensou: e se eu criar ícones simples de doze por doze pixels para economizar o espaço das palavras? Ele desenhou o coração, um rostinho sorrindo e um sol. A Apple percebeu o sucesso absurdo disso no mercado japonês e, quando lançaram o primeiro iPhone, esconderam o teclado de emojis no sistema operacional ocidental. Mas os usuários descobriram! Isso viralizou tanto que forçou a Apple e o Google a padronizarem os emojis no mundo inteiro. Hoje, nós enviamos mais de dez bilhões de emojis todos os dias!'
  }
];

// Helper to generate mock timestamped words for custom clips or loaded files
export function generateWordsFromText(text: string, startTime: number = 0): CaptionWord[] {
  const words = text.split(/\s+/);
  const wordsCount = words.length;
  const durationPerWord = 0.35; // average seconds per word spoken

  const emojiList = ['🔥', '💡', '🚀', '🎯', '⚡', '🧠', '🤯', '💎', '📈', '👊', '⏳', '📣'];

  return words.map((w, index) => {
    const rawWord = w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const start = startTime + (index * durationPerWord);
    const end = start + durationPerWord - 0.05;
    
    // Add emojis to prominent words
    let emoji: string | undefined;
    if (
      rawWord.toLowerCase() === 'celular' || 
      rawWord.toLowerCase() === 'telefone'
    ) emoji = '📱';
    else if (rawWord.toLowerCase() === 'erro' || rawWord.toLowerCase() === 'mentira') emoji = '❌';
    else if (rawWord.toLowerCase() === 'cérebro' || rawWord.toLowerCase() === 'criatividade') emoji = '🧠';
    else if (rawWord.toLowerCase() === 'sucesso' || rawWord.toLowerCase() === 'faturar') emoji = '💰';
    else if (rawWord.toLowerCase() === 'dopamina' || rawWord.toLowerCase() === 'foco') emoji = '⚡';
    else if (rawWord.toLowerCase() === 'tempo' || rawWord.toLowerCase() === 'trimestre') emoji = '⏳';
    else if (rawWord.toLowerCase() === 'primeiro' || rawWord.toLowerCase() === 'criado') emoji = '🥇';
    else if (rawWord.toLowerCase() === 'coração') emoji = '❤️';
    else if (
      (index % 12 === 0 || rawWord.length > 8) && 
      Math.random() > 0.6
    ) {
      emoji = emojiList[index % emojiList.length];
    }

    return {
      id: `w-${startTime}-${index}-${rawWord}`,
      word: w,
      start,
      end,
      emoji
    };
  });
}

// Pre-defined clips for our 3 onboarding presets to offer instantaneous results
export const PRESET_CLIPS: Record<string, ViralClip[]> = {
  'deep-work': [
    {
      id: 'dw-clip-1',
      title: 'O Erro Fatal ao Acordar',
      start: 0,
      end: 25,
      duration: 25,
      viralScore: 97,
      viralityReason: 'Gancho extremamente forte apelando para um hábito diário negativo comum (olhar o celular nos primeiros 5 minutos) que imediatamente chama a atenção do espectador.',
      hook: 'O maior erro do jovem moderno ao acordar é olhar o telefone celular nos primeiros cinco minutos.',
      suggestedTitle: 'Não faça isso nos primeiros 5 minutos do seu dia! 🚫📱',
      suggestedDescription: 'Você olha o celular logo que acorda? Dr. Lucas Ribeiro explica como isso sabota sua capacidade de foco e faturamento diário.',
      tags: ['cortes', 'foco', 'produtividade', 'neurociencia', 'celular', 'habitos'],
      captions: generateWordsFromText(
        'O maior erro do jovem moderno ao acordar é olhar o telefone celular nos primeiros cinco minutos. Sabe por que? Quando você faz isso, seu cérebro que estava em ondas alfa, um estado de criatividade puro, recebe uma descarga instantânea de dopamina barata.',
        0
      )
    },
    {
      id: 'dw-clip-2',
      title: 'A Regra de Ouro das Duas Primeiras Horas',
      start: 25,
      end: 55,
      duration: 30,
      viralScore: 94,
      viralityReason: 'Entrega uma solução prática concreta e um insight de produtividade ("proteja as duas primeiras horas do seu dia") que ativa a dopamina do espectador.',
      hook: 'Se você quer de verdade faturar dez vezes mais e ter um foco implacável, faça o seguinte...',
      suggestedTitle: 'Aumente o seu foco em 10X com esta regra simples! 🧠📈',
      suggestedDescription: 'Proteja o ativo mais valioso que você possui: a energia cognitiva das duas primeiras horas do dia.',
      tags: ['sucesso', 'fazerfoco', 'dinheiro', 'disciplina', 'produtividade', 'mindset'],
      captions: generateWordsFromText(
        'Você é inundado de problemas de outras pessoas, e-mails de cobrança, notificações de redes sociais. Sua atenção fica fragmentada para o resto do dia inteiro. Se você quer de verdade faturar dez vezes mais e ter um foco implacável, faça o seguinte: proteja as duas primeiras horas do seu dia.',
        25
      )
    },
    {
      id: 'dw-clip-3',
      title: 'Trabalho Profundo vs Gerenciamento de Danos',
      start: 55,
      end: 80,
      duration: 25,
      viralScore: 89,
      viralityReason: 'Termina com um soco verbal provocativo ("O resto do dia é só gerenciamento de danos!") ideal para compartilhar e debater nos comentários.',
      hook: 'Sem celular, sem reuniões, sem interrupções. Use esse tempo para o trabalho profundo...',
      suggestedTitle: 'Trabalho Profundo vs Gerenciamento de Danos! ⚡👊',
      suggestedDescription: 'O segredo da alta performance contada cientificamente. Como executar suas tarefas chaves blindando seu tempo de interrupções superficiais.',
      tags: ['mindset', 'negocios', 'desenvolvimentopessoal', 'altaperformance'],
      captions: generateWordsFromText(
        'Sem celular, sem reuniões, sem interrupções. Use esse tempo para o trabalho profundo, o deep work. É nesse bloco que o seu cérebro opera em alta performance cognitiva. O resto do dia? É só gerenciamento de danos!',
        55
      )
    }
  ],
  'success-cost': [
    {
      id: 'sc-clip-1',
      title: 'A Grande Mentira do Sucesso Rápido',
      start: 0,
      end: 24,
      duration: 24,
      viralScore: 96,
      viralityReason: 'Começa desmistificando uma mentira popular do marketing digital, posicionando o orador como uma figura honesta e autêntica.',
      hook: 'Sabe qual é a grande mentira do marketing digital? É que o sucesso acontece da noite para o dia.',
      suggestedTitle: 'A mentira que te contaram sobre marketing digital ❌🧠',
      suggestedDescription: 'Marcus Andrade desabafa sobre a cultura do imediatismo e a realidade por trás de negócios bem-sucedidos.',
      tags: ['marketingdigital', 'sucesso', 'marketing', 'mentira', 'realidade', 'investimentos'],
      captions: generateWordsFromText(
        'Sabe qual é a grande mentira do marketing digital? É que o sucesso acontece da noite para o dia. Mentira! As pessoas me veem hoje e acham que foi fácil. Mas deixa eu abrir o jogo aqui com vocês.',
        0
      )
    },
    {
      id: 'sc-clip-2',
      title: 'Profissional vs Amador',
      start: 24,
      end: 45,
      duration: 21,
      viralScore: 93,
      viralityReason: 'Definição polarizante de Amador vs Profissional que fomenta engajamento e compartilhamento nas redes sociais.',
      hook: 'Amadores tratam o seu negócio como um hobby. O profissional opera por disciplina...',
      suggestedTitle: 'Hobby ou Profissão? Pare de brincar! 👊🔥',
      suggestedDescription: 'Se você trabalha apenas quando está com vontade, você tem um passatempo caro, não uma empresa.',
      tags: ['disciplina', 'profissionalismo', 'foco', 'vendas', 'empreender', 'mindset'],
      captions: generateWordsFromText(
        'Amadores tratam o seu negócio como um hobby. Se estão motivados, trabalham. Se está chovendo ou estão com preguiça, não fazem nada. O profissional opera por disciplina e padrão.',
        24
      )
    },
    {
      id: 'sc-clip-3',
      title: 'A Regra dos 90 Dias',
      start: 45,
      end: 75,
      duration: 30,
      viralScore: 95,
      viralityReason: 'Conceito excelente de causa e efeito temporizados ("A Regra dos 90 Dias") que cria valor duradouro e forte apelo de salvamento de vídeos.',
      hook: 'Existe uma regra que eu chamo de Regra dos Noventa Dias. Tudo o que você planta hoje...',
      suggestedTitle: 'A Regra dos 90 Dias de Negócios! 🚜🍇',
      suggestedDescription: 'Se as suas vendas ou publicações caíram, a culpa não é desta semana. É do que você deixou de plantar 3 meses atrás.',
      tags: ['regra90dias', 'resiliencia', 'empreendedorismo', 'carreira', 'esforço', 'dicas'],
      captions: generateWordsFromText(
        'Existe uma regra que eu chamo de Regra dos Noventa Dias. Tudo o que você planta hoje, você só vai colher daqui a três meses. Se você parar de criar conteúdo, de vender e de estudar esta semana, você não perde o resultado hoje de noite; você destrói o seu trimestre inteiro!',
        45
      )
    }
  ],
  'emoji-secret': [
    {
      id: 'es-clip-1',
      title: 'A Origem Acidental do Emoji',
      start: 0,
      end: 25,
      duration: 25,
      viralScore: 91,
      viralityReason: 'Uma curiosidade bizarra de abertura que prende imediatamente a atenção porque todo mundo usa emojis dezenas de vezes diariamente.',
      hook: 'Você sabia que o primeiro emoji do mundo foi criado por acidente em mil novecentos e noventa e nove?',
      suggestedTitle: 'Você sabia que os emojis foram criados por acidente? 🧠🇯🇵',
      suggestedDescription: 'Conheça a fascinante história de Shigetaka Kurita e como nasceram os emoticons modernos para economizar caracteres em celulares antigos.',
      tags: ['curiosidades', 'historia', 'emojis', 'tecnologia', 'japao', 'design'],
      captions: generateWordsFromText(
        'Você sabia que o primeiro emoji do mundo foi criado por acidente em mil novecentos e noventa e nove por um designer japonês chamado Shigetaka Kurita? Na época, as operadoras de telefonia no Japão só davam duzentos e cento e cinquenta caracteres.',
        0
      )
    },
    {
      id: 'es-clip-2',
      title: 'Como a Apple Tentou Esconder os Emojis',
      start: 25,
      end: 65,
      duration: 40,
      viralScore: 95,
      viralityReason: 'Conspiração leve envolvendo grandes marcas corporativas (Apple/Google). O público adora ouvir que marcas gigantes foram forçadas a mudar pelos usuários.',
      hook: 'A Apple percebeu o sucesso absurdo disso no mercado japonês e esconderam o teclado...',
      suggestedTitle: 'A Apple tentou esconder os emojis de você! 🤫📱',
      suggestedDescription: 'Descubra a história secreta de como os usuários do iPhone forçaram a Apple a liberar o teclado de emojis no mundo inteiro.',
      tags: ['apple', 'iphone', 'google', 'segredos', 'tecnologia', 'curioso'],
      captions: generateWordsFromText(
        'A Apple percebeu o sucesso absurdo disso no mercado japonês e, quando lançaram o primeiro iPhone, esconderam o teclado de emojis no sistema operacional ocidental. Mas os usuários descobriram! Isso viralizou tanto que forçou a Apple e o Google a padronizarem os emojis no mundo inteiro. Hoje, nós enviamos mais de dez bilhões de emojis todos os dias!',
        25
      )
    }
  ]
};
