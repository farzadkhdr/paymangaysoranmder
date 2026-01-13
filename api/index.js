// api/index.js - بۆ سیستەمی پەیمانگا

export default async function handler(req, res) {
  // ڕێکخستنی CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // چارەسەری OPTIONS بۆ CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // کلیلەکەی API (ئەمە دەتوانیت لە ناوچەی ژینگەوە وەربگریت)
  const API_TOKEN = process.env.API_TOKEN || 'institute_api_token_2024_soran';
  
  // پشکنینی کلیلەکەی API
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'کلیلەکەی API پێویستە'
    });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== API_TOKEN) {
    return res.status(403).json({
      success: false,
      message: 'کلیلەکەی API نادروستە'
    });
  }
  
  // ئەندپۆینتی /status
  if (req.method === 'GET' && req.url === '/api/status') {
    return res.status(200).json({
      success: true,
      system: 'سیستەمی پەیمانگای سۆران',
      version: '1.0.0',
      status: 'چالاک',
      timestamp: new Date().toISOString()
    });
  }
  
  // ئەندپۆینتی /backup
  if (req.method === 'POST' && req.url === '/api/backup') {
    try {
      const backupData = req.body;
      
      // پشکنین بۆ دەستکاری
      if (!backupData) {
        return res.status(400).json({
          success: false,
          message: 'زانیاری باکەپ پێویستە'
        });
      }
      
      // لێرەدا دەتوانیت زانیاریەکان لە داتابەیس یان فایلەوە پاشەکەوت بکەیت
      // بۆ نمونە، تەنها راستگۆیینەک دەگەڕێنینەوە
      
      const responseData = {
        success: true,
        message: `باکەپ بە سەرکەوتوویی وەرگیرا!`,
        receivedData: {
          attendanceCount: backupData.attendance?.length || 0,
          studentsCount: backupData.students?.length || 0,
          syncType: backupData.syncType || 'نەناسراو',
          source: backupData.source || 'نەناسراو'
        },
        timestamp: new Date().toISOString()
      };
      
      // لێرەدا دەتوانیت پڕۆسێسی زانیاریەکان بکەیت و لە داتابەیس پاشەکەوت بکەیت
      console.log('باکەپی وەرگیراو:', {
        summary: `${backupData.attendance?.length || 0} غیاب، ${backupData.students?.length || 0} قوتابی`,
        syncType: backupData.syncType
      });
      
      return res.status(200).json(responseData);
      
    } catch (error) {
      console.error('هەڵە لە وەرگرتنی باکەپ:', error);
      return res.status(500).json({
        success: false,
        message: 'هەڵەی ناوەخۆیی سێرڤەر'
      });
    }
  }
  
  // ئەندپۆینتی نەناسراو
  return res.status(404).json({
    success: false,
    message: 'ئەندپۆینت نەدۆزرایەوە'
  });
}
