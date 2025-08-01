const fs = require('fs').promises;
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function main() {
  try {
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
    
    console.log(`Bot ${nextSpeaker}: ${newMessage}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();