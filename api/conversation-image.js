const fs = require('fs').promises;
const path = require('path');
const { createCanvas } = require('canvas');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // メッセージを読み込む
    const botAPath = path.join(process.cwd(), 'bot_a_message.txt');
    const botBPath = path.join(process.cwd(), 'bot_b_message.txt');
    
    const [botAContent, botBContent] = await Promise.all([
      fs.readFile(botAPath, 'utf8'),
      fs.readFile(botBPath, 'utf8')
    ]);
    
    const botAMessages = botAContent.split('\n---\n').filter(msg => msg.trim());
    const botBMessages = botBContent.split('\n---\n').filter(msg => msg.trim());
    
    const latestA = botAMessages[botAMessages.length - 1] || 'No message yet';
    const latestB = botBMessages[botBMessages.length - 1] || 'No message yet';
    
    // Canvas設定
    const width = 800;
    const height = 400;
    const padding = 40;
    const lineHeight = 30;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // 背景を白で塗りつぶし（透過処理のため）
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    // フォント設定
    ctx.font = '20px Arial';
    ctx.fillStyle = 'black';
    
    // Bot Aのメッセージ
    ctx.fillText('Bot A:', padding, padding);
    wrapText(ctx, latestA, padding, padding + lineHeight, width - padding * 2, lineHeight);
    
    // Bot Bのメッセージ
    const botBStartY = height / 2;
    ctx.fillText('Bot B:', padding, botBStartY);
    wrapText(ctx, latestB, padding, botBStartY + lineHeight, width - padding * 2, lineHeight);
    
    // PNGバッファを生成
    const buffer = canvas.toBuffer('image/png');
    
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
};

// テキスト折り返し関数
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, currentY);
}
