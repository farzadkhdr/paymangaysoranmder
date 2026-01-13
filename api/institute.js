// فایل: /api/institute.js
// ئەم APIە لەسەر Vercel دەئیشێ

export default async function handler(req, res) {
  // ڕێگەگرتنەکانی API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // بۆ ڕێگەگرتنی OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // تۆکینی API
  const API_TOKEN = "institute_api_token_2024_soran";
  
  // پشکنینی تۆکین
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== API_TOKEN) {
    return res.status(401).json({ 
      error: 'دەستپێگەیشتنی قەدەغەکراو',
      message: 'تۆکینی API نادروستە یان بوونی نییە'
    });
  }
  
  // وەرگرتنی زانیاری لە سیستەمی مامۆستا (POST /backup)
  if (req.method === 'POST' && req.url.includes('/backup')) {
    try {
      const data = req.body;
      
      // پشکنینی زانیاریەکان
      if (!data || !data.attendance) {
        return res.status(400).json({ 
          error: 'داواکاری نادروست',
          message: 'زانیاری غیابەکان بوونی نییە'
        });
      }
      
      console.log('وەرگرتنی زانیاری لە سیستەمی مامۆستا:', {
        source: data.source,
        syncType: data.syncType,
        attendanceCount: data.attendance?.length || 0,
        studentsCount: data.students?.length || 0,
        date: new Date().toISOString()
      });
      
      // لێرە دەتوانیت زانیاریەکان لە داتابەیسێک یان فایلێکدا پاشەکەوت بکەیت
      // بۆ نمونەی ئێستا، تەنها پاشەکەوت دەکەین لە memory
      
      return res.status(200).json({
        success: true,
        message: 'زانیاریەکان بە سەرکەوتوویی وەرگیرا',
        received: {
          attendance: data.attendance?.length || 0,
          students: data.students?.length || 0,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('هەڵە لە وەرگرتنی زانیاری:', error);
      return res.status(500).json({ 
        error: 'هەڵەی ناوەخۆیی',
        message: error.message 
      });
    }
  }
  
  // پشکنینی بارەکەی API (GET /status)
  if (req.method === 'GET' && req.url.includes('/status')) {
    return res.status(200).json({
      system: 'سیستەمی پەیمانگای سۆران',
      version: '1.0.0',
      status: 'چالاک',
      timestamp: new Date().toISOString(),
      endpoints: [
        'POST /api/backup - وەرگرتنی زانیاری لە سیستەمی مامۆستا',
        'GET /api/status - پشکنینی بارەکەی API'
      ]
    });
  }
  
  // ڕێگەچوونی نەناسراو
  return res.status(404).json({ 
    error: 'ڕێگەچوون نەدۆزرایەوە',
    message: 'ئەم ڕێگەچوونە بوونی نییە'
  });
}
