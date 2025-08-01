const fs = require('fs').promises;
const OpenAI = require('openai');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 日本語フォントを登録する関数
async function setupJapaneseFont() {
  try {
    // システムに日本語フォントがある場合の候補
    const fontPaths = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
      '/usr/share/fonts/opentype/noto/NotoCJK-Regular.ttc',
      path.join(__dirname, '../fonts/NotoSansCJK-Regular.ttc')
    ];
    
    for (const fontPath of fontPaths) {
      try {
        await fs.access(fontPath);
        registerFont(fontPath, { family: 'Japanese' });
        console.log(`Font registered: ${fontPath}`);
        return 'Japanese';
      } catch (error) {
        continue;
      }
    }
    
    // フォントが見つからない場合はデフォルトを使用
    console.log('No Japanese font found, using default font');
    return 'Arial, sans-serif';
  } catch (error) {
    console.log('Font setup failed, using default font');
    return 'Arial, sans-serif';
  }
}

// ファイルを読み込む関数
async function readFile(filename) {
  try {
    return await fs.readFile(filename, 'utf8');
  } catch (error) {
    return '';
  }
}

// メッセージ履歴をパースする関数
function parseMessages(content) {
  if (!content) return [];
  return content.split('\n---\n').filter(msg => msg.trim());
}

// メッセージ履歴をフォーマットする関数
function formatMessages(messages) {
  return messages.slice(-5).join('\n---\n');
}

// 会話履歴を構築する関数
function buildConversationHistory(botAMessages, botBMessages, currentBot) {
  const messages = [];
  const totalMessages = Math.max(botAMessages.length, botBMessages.length);
  
  for (let i = 0; i < totalMessages; i++) {
    if (botAMessages[i]) {
      messages.push({ role: 'assistant', content: `Bot A: ${botAMessages[i]}` });
    }
    if (botBMessages[i]) {
      messages.push({ role: 'assistant', content: `Bot B: ${botBMessages[i]}` });
    }
  }
  
  return messages;
}

// 次の話者を決定する関数
function determineNextSpeaker(botAMessages, botBMessages) {
  const totalMessages = botAMessages.length + botBMessages.length;
  return totalMessages % 2 === 0 ? 'A' : 'B';
}

// テキスト折り返し関数（日本語対応改良版）
function wrapText(context, text, x, y, maxWidth, lineHeight, fontFamily) {
  // 日本語テキストの場合、文字単位で折り返しを行う
  const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  
  if (isJapanese) {
    let line = '';
    let currentY = y;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = line + char;
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && line.length > 0) {
        context.fillText(line, x, currentY);
        line = char;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      context.fillText(line, x, currentY);
    }
  } else {
    // 英語の場合は単語単位で折り返し
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && n > 0) {
        context.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
  }
}

async function main() {
  try {
    // 日本語フォントをセットアップ
    const fontFamily = await setupJapaneseFont();
    
    // ファイルを読み込む
    const [systemPromptA, systemPromptB, botAContent, botBContent] = await Promise.all([
      readFile('systemprompt_a.txt'),
      readFile('systemprompt_b.txt'),
      readFile('bot_a_message.txt'),
      readFile('bot_b_message.txt')
    ]);
    
    // メッセージをパース
    const botAMessages = parseMessages(botAContent);
    const botBMessages = parseMessages(botBContent);
    
    // 次の話者を決定
    const nextSpeaker = determineNextSpeaker(botAMessages, botBMessages);
    
    // システムプロンプトと会話履歴を構築
    const systemPrompt = nextSpeaker === 'A' ? systemPromptA : systemPromptB;
    const conversationHistory = buildConversationHistory(botAMessages, botBMessages, nextSpeaker);
    
    // OpenAI APIを呼び出す
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: `あなたはBot ${nextSpeaker}です。Bot ${nextSpeaker === 'A' ? 'B' : 'A'}との会話を続けてください。` }
      ],
      temperature: 0.8,
      max_tokens: 150
    });
    
    const newMessage = completion.choices[0].message.content;
    
    // メッセージを更新
    if (nextSpeaker === 'A') {
      botAMessages.push(newMessage);
      await fs.writeFile('bot_a_message.txt', formatMessages(botAMessages));
    } else {
      botBMessages.push(newMessage);
      await fs.writeFile('bot_b_message.txt', formatMessages(botBMessages));
    }
    
    // 画像生成
    const width = 800;
    const height = 600;
    const padding = 40;
    
    // Bot A画像
    const canvasA = createCanvas(width, height);
    const ctxA = canvasA.getContext('2d');
    
    // 背景は透過のまま（何も描かない）
    
    // テキストの設定
    ctxA.fillStyle = 'black';
    ctxA.font = `24px ${fontFamily}`;
    ctxA.fillText('Bot A (Cy) says:', padding, 50);
    ctxA.font = `20px ${fontFamily}`;
    
    if (nextSpeaker === 'A') {
      wrapText(ctxA, newMessage, padding, 90, width - padding * 2, 30, fontFamily);
    } else if (botAMessages.length > 0) {
      wrapText(ctxA, botAMessages[botAMessages.length - 1], padding, 90, width - padding * 2, 30, fontFamily);
    }
    
    const bufferA = canvasA.toBuffer('image/png');
    await fs.writeFile('bot_a_latestmessage.png', bufferA);
    
    // Bot B画像
    const canvasB = createCanvas(width, height);
    const ctxB = canvasB.getContext('2d');
    
    // 背景は透過のまま（何も描かない）
    
    ctxB.fillStyle = 'black';
    ctxB.font = `24px ${fontFamily}`;
    ctxB.fillText('Bot B (Ver) says:', padding, 50);
    ctxB.font = `20px ${fontFamily}`;
    
    if (nextSpeaker === 'B') {
      wrapText(ctxB, newMessage, padding, 90, width - padding * 2, 30, fontFamily);
    } else if (botBMessages.length > 0) {
      wrapText(ctxB, botBMessages[botBMessages.length - 1], padding, 90, width - padding * 2, 30, fontFamily);
    }
    
    const bufferB = canvasB.toBuffer('image/png');
    await fs.writeFile('bot_b_latestmessage.png', bufferB);
    
    console.log(`Bot ${nextSpeaker}: ${newMessage}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
