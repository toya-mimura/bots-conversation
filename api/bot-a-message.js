const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const filePath = path.join(process.cwd(), 'bot_a_message.txt');
    const content = await fs.readFile(filePath, 'utf8');
    const messages = content.split('\n---\n').filter(msg => msg.trim());
    const latestMessage = messages[messages.length - 1] || '';
    
    res.status(200).json({
      bot: 'A',
      latest_message: latestMessage,
      all_messages: messages,
      count: messages.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read messages' });
  }
};