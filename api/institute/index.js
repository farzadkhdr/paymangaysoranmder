const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();

// ڕێکخستنەکان
const PORT = process.env.PORT || 5000;
const API_SECRET = process.env.API_SECRET || 'soran_institute_secret_2024';
const API_TOKEN = process.env.API_TOKEN || 'institute_api_token_2024_soran';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// پاشەکەوتکردنی زانیاریەکان لە فایل
const DATA_DIR = path.join(__dirname, 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const GRADES_FILE = path.join(DATA_DIR, 'grades.json');
const SYNC_HISTORY_FILE = path.join(DATA_DIR, 'sync_history.json');

// دڵنیابوون لە بوونی فۆلدەری داتا
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// فەنکشنی خوێندنەوەی زانیاریەکان
function readData(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`هەڵە لە خوێندنەوەی ${filePath}:`, error);
  }
  return defaultValue;
}

// فەنکشنی پاشەکەوتکردنی زانیاریەکان
function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`هەڵە لە نوسینی ${filePath}:`, error);
    return false;
  }
}

// Middleware بۆ پشکنینی API Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'تۆکینی API پێویستە'
    });
  }

  if (token !== API_TOKEN) {
    return res.status(403).json({
      success: false,
      message: 'تۆکینی API نادروستە'
    });
  }

  next();
};

// API Routes

// 1. پشکنینی API
app.get('/api/status', authenticateToken, (req, res) => {
  const students = readData(STUDENTS_FILE);
  const attendance = readData(ATTENDANCE_FILE);
  const grades = readData(GRADES_FILE);
  const syncHistory = readData(SYNC_HISTORY_FILE);

  res.json({
    success: true,
    system: 'سیستەمی پەیمانگای سۆران',
    version: '1.0.0',
    status: 'چالاک',
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
    statistics: {
      totalStudents: students.length,
      totalAttendance: attendance.length,
      totalGrades: grades.length,
      totalSyncs: syncHistory.length
    },
    endpoints: [
      'GET /api/status - پشکنینی بارەکەی API',
      'POST /api/backup - وەرگرتنی باکەپ لە سیستەمی مامۆستا',
      'GET /api/students - وەرگرتنی لیستی قوتابیان',
      'GET /api/attendance - وەرگرتنی زانیاری غیاب',
      'GET /api/sync-history - وەرگرتنی مێژووی یەکلاکردنەوە'
    ]
  });
});

// 2. وەرگرتنی باکەپ لە سیستەمی مامۆستا
app.post('/api/backup', authenticateToken, (req, res) => {
  try {
    const backupData = req.body;
    
    if (!backupData) {
      return res.status(400).json({
        success: false,
        message: 'زانیاری باکەپ پێویستە'
      });
    }

    // خوێندنەوەی زانیاریەکانی ئێستا
    const existingStudents = readData(STUDENTS_FILE);
    const existingAttendance = readData(ATTENDANCE_FILE);
    const existingSyncHistory = readData(SYNC_HISTORY_FILE);

    let importedStudents = 0;
    let importedAttendance = 0;
    let updatedAttendance = 0;

    // زیادکردنی قوتابیە نوێیەکان
    if (backupData.students && Array.isArray(backupData.students)) {
      backupData.students.forEach(newStudent => {
        // پشکنین بۆ بوونی پێشوو
        const existingIndex = existingStudents.findIndex(s => s.id === newStudent.id);
        
        if (existingIndex === -1) {
          // زیادکردنی قوتابی نوێ
          existingStudents.push({
            ...newStudent,
            importedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
            source: backupData.source || 'سیستەمی مامۆستا'
          });
          importedStudents++;
        } else {
          // نوێکردنەوەی قوتابی هەبوو
          existingStudents[existingIndex] = {
            ...existingStudents[existingIndex],
            ...newStudent,
            updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
            source: backupData.source || 'سیستەمی مامۆستا'
          };
        }
      });
    }

    // زیادکردنی غیابە نوێیەکان
    if (backupData.attendance && Array.isArray(backupData.attendance)) {
      backupData.attendance.forEach(newAttendance => {
        // گۆڕینی ID بۆ ناساندنی هەر غیابێک بە تایبەت
        const attendanceId = newAttendance.id || `${newAttendance.studentId}-${newAttendance.date}-${newAttendance.course || newAttendance.courseName}`;
        
        // پشکنین بۆ دۆزینەوەی غیابی هاوشێوە
        const existingIndex = existingAttendance.findIndex(a => 
          a.id === attendanceId || 
          (a.studentId === newAttendance.studentId && 
           a.date === newAttendance.date && 
           (a.course === newAttendance.course || a.courseName === newAttendance.courseName))
        );
        
        if (existingIndex === -1) {
          // زیادکردنی غیابی نوێ
          existingAttendance.push({
            id: attendanceId,
            ...newAttendance,
            courseName: newAttendance.course || newAttendance.courseName,
            hours: newAttendance.hours || (newAttendance.present === false ? 1 : 0),
            importedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
            source: backupData.source || 'سیستەمی مامۆستا',
            synced: true
          });
          importedAttendance++;
        } else {
          // نوێکردنەوەی غیابی هەبوو
          existingAttendance[existingIndex] = {
            ...existingAttendance[existingIndex],
            ...newAttendance,
            courseName: newAttendance.course || newAttendance.courseName,
            hours: newAttendance.hours || (newAttendance.present === false ? 1 : 0),
            updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
            source: backupData.source || 'سیستەمی مامۆستا',
            synced: true
          };
          updatedAttendance++;
        }
      });
    }

    // دروستکردنی تۆماری یەکلاکردنەوە
    const syncRecord = {
      id: uuidv4(),
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      source: backupData.source || 'سیستەمی مامۆستا',
      syncType: backupData.syncType || 'unknown',
      data: {
        studentsCount: backupData.students?.length || 0,
        attendanceCount: backupData.attendance?.length || 0,
        importedStudents,
        importedAttendance,
        updatedAttendance
      },
      success: true
    };

    existingSyncHistory.push(syncRecord);

    // پاشەکەوتکردنی زانیاریە نوێیەکان
    writeData(STUDENTS_FILE, existingStudents);
    writeData(ATTENDANCE_FILE, existingAttendance);
    writeData(SYNC_HISTORY_FILE, existingSyncHistory);

    // وەڵامدانەوە
    res.json({
      success: true,
      message: 'باکەپ بە سەرکەوتوویی وەرگیرا',
      summary: {
        importedStudents,
        importedAttendance,
        updatedAttendance,
        totalStudents: existingStudents.length,
        totalAttendance: existingAttendance.length
      },
      syncId: syncRecord.id,
      timestamp: syncRecord.timestamp
    });

  } catch (error) {
    console.error('هەڵە لە وەرگرتنی باکەپ:', error);
    
    // تۆماری هەڵەی یەکلاکردنەوە
    const existingSyncHistory = readData(SYNC_HISTORY_FILE);
    const errorSyncRecord = {
      id: uuidv4(),
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      source: req.body?.source || 'سیستەمی مامۆستا',
      syncType: req.body?.syncType || 'unknown',
      error: error.message,
      success: false
    };
    
    existingSyncHistory.push(errorSyncRecord);
    writeData(SYNC_HISTORY_FILE, existingSyncHistory);

    res.status(500).json({
      success: false,
      message: 'هەڵە لە وەرگرتنی باکەپ',
      error: error.message
    });
  }
});

// 3. وەرگرتنی لیستی قوتابیان
app.get('/api/students', authenticateToken, (req, res) => {
  try {
    const students = readData(STUDENTS_FILE);
    const { level, group, search } = req.query;
    
    let filteredStudents = [...students];
    
    // فیلتەرکردن بەپێی قۆناغ
    if (level) {
      filteredStudents = filteredStudents.filter(student => student.level == level);
    }
    
    // فیلتەرکردن بەپێی گروپ
    if (group) {
      filteredStudents = filteredStudents.filter(student => student.group === group);
    }
    
    // گەڕان بەپێی ناو
    if (search) {
      const searchLower = search.toLowerCase();
      filteredStudents = filteredStudents.filter(student => 
        student.name.toLowerCase().includes(searchLower) ||
        student.fatherName.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      success: true,
      count: filteredStudents.length,
      total: students.length,
      students: filteredStudents,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
  } catch (error) {
    console.error('هەڵە لە وەرگرتنی لیستی قوتابیان:', error);
    res.status(500).json({
      success: false,
      message: 'هەڵە لە وەرگرتنی زانیاری',
      error: error.message
    });
  }
});

// 4. وەرگرتنی زانیاری غیاب
app.get('/api/attendance', authenticateToken, (req, res) => {
  try {
    const attendance = readData(ATTENDANCE_FILE);
    const { date, studentId, course, fromDate, toDate } = req.query;
    
    let filteredAttendance = [...attendance];
    
    // فیلتەرکردن بەپێی بەروار
    if (date) {
      filteredAttendance = filteredAttendance.filter(a => a.date === date);
    }
    
    // فیلتەرکردن بەپێی IDی قوتابی
    if (studentId) {
      filteredAttendance = filteredAttendance.filter(a => a.studentId === studentId);
    }
    
    // فیلتەرکردن بەپێی دەرس
    if (course) {
      filteredAttendance = filteredAttendance.filter(a => 
        a.course === course || a.courseName === course
      );
    }
    
    // فیلتەرکردن بەپێی ماوەی کات
    if (fromDate && toDate) {
      filteredAttendance = filteredAttendance.filter(a => {
        const attendanceDate = moment(a.date);
        return attendanceDate.isBetween(
          moment(fromDate).startOf('day'),
          moment(toDate).endOf('day'),
          null,
          '[]'
        );
      });
    }
    
    // ژماردنەوەی حەضر و غیاب
    const presentCount = filteredAttendance.filter(a => a.present === true).length;
    const absentCount = filteredAttendance.filter(a => a.present === false).length;
    
    res.json({
      success: true,
      count: filteredAttendance.length,
      total: attendance.length,
      statistics: {
        presentCount,
        absentCount,
        attendanceRate: filteredAttendance.length > 0 ? 
          (presentCount / filteredAttendance.length * 100).toFixed(2) : 0
      },
      attendance: filteredAttendance,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
  } catch (error) {
    console.error('هەڵە لە وەرگرتنی زانیاری غیاب:', error);
    res.status(500).json({
      success: false,
      message: 'هەڵە لە وەرگرتنی زانیاری',
      error: error.message
    });
  }
});

// 5. وەرگرتنی مێژووی یەکلاکردنەوە
app.get('/api/sync-history', authenticateToken, (req, res) => {
  try {
    const syncHistory = readData(SYNC_HISTORY_FILE);
    const { limit } = req.query;
    
    let filteredHistory = [...syncHistory].reverse(); // کۆتاییەکان یەکەم بن
    
    if (limit) {
      filteredHistory = filteredHistory.slice(0, parseInt(limit));
    }
    
    // ژماردنەوەی سەرکەوتوو و هەڵە
    const successfulSyncs = syncHistory.filter(s => s.success).length;
    const failedSyncs = syncHistory.filter(s => !s.success).length;
    
    res.json({
      success: true,
      count: filteredHistory.length,
      total: syncHistory.length,
      statistics: {
        successfulSyncs,
        failedSyncs,
        successRate: syncHistory.length > 0 ? 
          (successfulSyncs / syncHistory.length * 100).toFixed(2) : 0
      },
      history: filteredHistory,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
  } catch (error) {
    console.error('هەڵە لە وەرگرتنی مێژووی یەکلاکردنەوە:', error);
    res.status(500).json({
      success: false,
      message: 'هەڵە لە وەرگرتنی زانیاری',
      error: error.message
    });
  }
});

// 6. وەرگرتنی زانیاری وردی قوتابی
app.get('/api/students/:id', authenticateToken, (req, res) => {
  try {
    const students = readData(STUDENTS_FILE);
    const attendance = readData(ATTENDANCE_FILE);
    const grades = readData(GRADES_FILE);
    
    const studentId = req.params.id;
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'قوتابی نەدۆزرایەوە'
      });
    }
    
    // وەرگرتنی غیابەکانی ئەم قوتابیە
    const studentAttendance = attendance.filter(a => a.studentId === studentId);
    
    // وەرگرتنی نمرەکانی ئەم قوتابیە
    const studentGrades = grades.filter(g => g.studentId === studentId);
    
    // ژماردنەوەی غیابەکان
    const totalAbsences = studentAttendance.filter(a => a.present === false).length;
    
    // هەژمارکردنی نمرەی تێکڕا
    let averageGrade = 0;
    if (studentGrades.length > 0) {
      const total = studentGrades.reduce((sum, grade) => sum + (grade.totalGrade || 0), 0);
      averageGrade = total / studentGrades.length;
    }
    
    res.json({
      success: true,
      student: {
        ...student,
        attendanceCount: studentAttendance.length,
        absencesCount: totalAbsences,
        gradesCount: studentGrades.length,
        averageGrade: averageGrade.toFixed(2)
      },
      attendance: studentAttendance.slice(-10), // 10 غیابی کۆتایی
      grades: studentGrades.slice(-10), // 10 نمرەی کۆتایی
      statistics: {
        totalAttendance: studentAttendance.length,
        totalAbsences,
        totalGrades: studentGrades.length,
        averageGrade: averageGrade.toFixed(2)
      },
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
  } catch (error) {
    console.error('هەڵە لە وەرگرتنی زانیاری قوتابی:', error);
    res.status(500).json({
      success: false,
      message: 'هەڵە لە وەرگرتنی زانیاری',
      error: error.message
    });
  }
});

// 7. هەڵگرتنی ڕاپۆرت
app.get('/api/reports/attendance', authenticateToken, (req, res) => {
  try {
    const attendance = readData(ATTENDANCE_FILE);
    const students = readData(STUDENTS_FILE);
    const { date, course, level, group } = req.query;
    
    let filteredAttendance = [...attendance];
    
    // فیلتەرکردن
    if (date) {
      filteredAttendance = filteredAttendance.filter(a => a.date === date);
    }
    
    if (course) {
      filteredAttendance = filteredAttendance.filter(a => 
        a.course === course || a.courseName === course
      );
    }
    
    // زیادکردنی زانیاری قوتابی بۆ هەر غیابێک
    const reportData = filteredAttendance.map(record => {
      const student = students.find(s => s.id === record.studentId);
      return {
        ...record,
        studentName: student?.name || 'نەناسراو',
        studentFatherName: student?.fatherName || '',
        studentLevel: student?.level || '',
        studentGroup: student?.group || ''
      };
    }).filter(record => 
      (!level || record.studentLevel == level) &&
      (!group || record.studentGroup === group)
    );
    
    // ژماردنەوەکان
    const presentCount = reportData.filter(r => r.present === true).length;
    const absentCount = reportData.filter(r => r.present === false).length;
    
    res.json({
      success: true,
      report: {
        date: date || 'هەموو بەروارەکان',
        course: course || 'هەموو دەرسەکان',
        level: level || 'هەموو قۆناغەکان',
        group: group || 'هەموو گروپەکان',
        totalStudents: reportData.length,
        presentCount,
        absentCount,
        attendanceRate: reportData.length > 0 ? 
          (presentCount / reportData.length * 100).toFixed(2) : 0
      },
      data: reportData,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
  } catch (error) {
    console.error('هەڵە لە دروستکردنی ڕاپۆرت:', error);
    res.status(500).json({
      success: false,
      message: 'هەڵە لە دروستکردنی ڕاپۆرت',
      error: error.message
    });
  }
});

// 8. زیادکردنی قوتابی (لەڕێگەی API)
app.post('/api/students', authenticateToken, (req, res) => {
  try {
    const newStudent = req.body;
    
    if (!newStudent.name || !newStudent.fatherName || !newStudent.level || !newStudent.group) {
      return res.status(400).json({
        success: false,
        message: 'زانیاریە سەرەکییەکان پێویستە (ناو، ناوی باوک، قۆناغ، گروپ)'
      });
    }
    
    const students = readData(STUDENTS_FILE);
    
    // پشکنین بۆ نەبوونی دووبارە
    const existingStudent = students.find(s => 
      s.name === newStudent.name && 
      s.fatherName === newStudent.fatherName &&
      s.level === newStudent.level
    );
    
    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: 'قوتابی پێشتر تۆمار کراوە'
      });
    }
    
    // دروستکردنی ID
    const studentId = uuidv4();
    const studentWithId = {
      id: studentId,
      ...newStudent,
      createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
      source: 'API'
    };
    
    students.push(studentWithId);
    writeData(STUDENTS_FILE, students);
    
    res.status(201).json({
      success: true,
      message: 'قوتابی بە سەرکەوتوویی زیاد کرا',
      student: studentWithId,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
  } catch (error) {
    console.error('هەڵە لە زیادکردنی قوتابی:', error);
    res.status(500).json({
      success: false,
      message: 'هەڵە لە زیادکردنی قوتابی',
      error: error.message
    });
  }
});

// 9. ڕێکخستنی سیستەم
app.get('/api/config', authenticateToken, (req, res) => {
  const students = readData(STUDENTS_FILE);
  const attendance = readData(ATTENDANCE_FILE);
  
  // وەرگرتنی قۆناغ و گروپە جیاوازەکان
  const levels = [...new Set(students.map(s => s.level))].sort();
  const groups = [...new Set(students.map(s => s.group))].sort();
  
  // وەرگرتنی دەرسە جیاوازەکان
  const courses = [...new Set(attendance.map(a => a.course || a.courseName))].filter(Boolean).sort();
  
  // وەرگرتنی بەروارە جیاوازەکان
  const dates = [...new Set(attendance.map(a => a.date))].sort().reverse().slice(0, 30);
  
  res.json({
    success: true,
    config: {
      levels,
      groups,
      courses,
      recentDates: dates,
      systemInfo: {
        name: 'سیستەمی پەیمانگای سۆران',
        version: '1.0.0',
        apiVersion: 'v1',
        support: 'سۆران ئێجوسی - ٠٧٥٠ ١٢٣ ٤٥٦٧'
      }
    },
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
  });
});

// 10. پاککردنەوەی زانیاری (فەق بۆ پەروەردەکاران)
app.delete('/api/data/:type', authenticateToken, (req, res) => {
  const { type } = req.params;
  const { password } = req.body;
  
  // پاسوۆردی پەروەردەکار
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({
      success: false,
      message: 'پاسوۆردی پەروەردەکار هەڵەیە'
    });
  }
  
  let filePath;
  let message;
  
  switch(type) {
    case 'attendance':
      filePath = ATTENDANCE_FILE;
      message = 'هەموو زانیاریەکانی غیاب سڕدرایەوە';
      break;
    case 'sync-history':
      filePath = SYNC_HISTORY_FILE;
      message = 'هەموو مێژووی یەکلاکردنەوە سڕدرایەوە';
      break;
    case 'all':
      // سڕینەوەی هەموو زانیاریەکان
      writeData(STUDENTS_FILE, []);
      writeData(ATTENDANCE_FILE, []);
      writeData(GRADES_FILE, []);
      writeData(SYNC_HISTORY_FILE, []);
      message = 'هەموو زانیاریەکانی سیستەم سڕدرانەوە';
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'جۆری زانیاری نادروستە'
      });
  }
  
  if (type !== 'all') {
    writeData(filePath, []);
  }
  
  res.json({
    success: true,
    message,
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
  });
});

// Route-ی سەرەکی
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'APIی سیستەمی پەیمانگای سۆران',
    version: '1.0.0',
    endpoints: [
      'GET  /api/status - پشکنینی API',
      'POST /api/backup - وەرگرتنی باکەپ لە سیستەمی مامۆستا',
      'GET  /api/students - لیستی قوتابیان',
      'GET  /api/students/:id - زانیاری وردی قوتابی',
      'POST /api/students - زیادکردنی قوتابی',
      'GET  /api/attendance - زانیاری غیاب',
      'GET  /api/reports/attendance - ڕاپۆرتی غیاب',
      'GET  /api/sync-history - مێژووی یەکلاکردنەوە',
      'GET  /api/config - ڕێکخستنی سیستەم',
      'DELETE /api/data/:type - پاککردنەوەی زانیاری (پەروەردەکار)'
    ],
    documentation: 'https://soran-institute-api.vercel.app/docs',
    support: 'سۆران ئێجوسی - ٠٧٥٠ ١٢٣ ٤٥٦٧'
  });
});

// Route-ی 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'ئەندپۆینت نەدۆزرایەوە',
    requestedUrl: req.originalUrl
  });
});

// دەستپێکردنی سێرڤەر
app.listen(PORT, () => {
  console.log(`✅ APIی سیستەمی پەیمانگا لە پۆرت ${PORT} چالاکە`);
  console.log(`🔑 تۆکینی API: ${API_TOKEN}`);
  console.log(`📁 پاشەکەوتەکانی داتا: ${DATA_DIR}`);
});
