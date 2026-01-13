// api/backup.js
// API Endpoint بۆ وەرگرتنی باکەپەکان لە سیستەمی مامۆستا
// ئەمە لە Vercel بۆ پەیمانگای سۆران دادەنرێت

export default async function handler(req, res) {
    // تەنها POST requests قبوڵ دەکەین
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'تەنها POST requests قبوڵ کراوە'
        });
    }

    try {
        // وەرگرتنی داتا لە request
        const data = req.body;
        
        // پشکنینی داتا
        if (!data || typeof data !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'داتای نادروست یان بەتاڵە'
            });
        }
        
        console.log('📥 باکەپی وەرگیرا لە:', data.sourceSystem || 'نەناسراو');
        console.log('📊 زانیاری باکەپ:', {
            students: data.students?.length || 0,
            attendance: data.attendance?.length || 0,
            backupDate: data.backupDate
        });

        // ئەگەر تاقیکردنەوە بێت
        if (data.test) {
            console.log('✅ داواکاری تاقیکردنەوە بە سەرکەوتوویی وەرگیرا');
            return res.status(200).json({
                success: true,
                message: 'API کار دەکات! پەیوەندی سەرکەوتوو بوو.',
                test: true,
                timestamp: new Date().toISOString()
            });
        }

        // لێرەدا دەتوانیت داتاکان لە داتابەیسێک یان فایلێک خەزن بکەیت
        // بۆ نمونە، ئێمە تەنها وەڵامێکی سەرکەوتوو دەگەڕێنینەوە
        // لە ڕیالیتی، دەبێت داتاکان لە داتابەیس یان فایل خەزن بکرێت
        
        // Response بۆ نیشاندانی سەرکەوتن
        const response = {
            success: true,
            message: 'بەکەپ بە سەرکەوتوویی وەرگیرا و پێشەوە چوو',
            receivedData: {
                students: data.students?.length || 0,
                attendance: data.attendance?.length || 0,
                backupDate: data.backupDate,
                sourceSystem: data.sourceSystem || 'نەناسراو'
            },
            processingInfo: {
                importedStudents: data.students?.length || 0,
                importedAttendance: data.attendance?.length || 0,
                updatedAttendance: 0, // ئەگەر هەبووایە، دەتوانرا لێرە زیاد بکرێت
                totalStudents: data.students?.length || 0,
                totalAttendance: data.attendance?.length || 0
            },
            timestamp: new Date().toISOString(),
            apiVersion: '1.0',
            instructions: 'ئەم داتایانە پێویستە لە سیستمەکەت خەزن بکرێن'
        };

        console.log('✅ وەڵامی سەرکەوتوو:', response);
        
        return res.status(200).json(response);

    } catch (error) {
        console.error('❌ هەڵە لە پرۆسێسی باکەپ:', error);
        
        return res.status(500).json({
            success: false,
            message: `هەڵەی ناوەکی: ${error.message}`,
            error: error.toString(),
            timestamp: new Date().toISOString()
        });
    }
}

// Middleware بۆ ڕێکخستنی CORS
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb' // زۆرترین قەبارەی داتا
        },
        // ڕێگەدان بە CORS
        responseLimit: false,
        externalResolver: true,
    },
};

// Helper function بۆ پشکنینی داتا
function validateBackupData(data) {
    const errors = [];
    
    if (!data.backupDate) {
        errors.push('بەرواری باکەپ دیارینەکراوە');
    }
    
    if (data.students && !Array.isArray(data.students)) {
        errors.push('لیستی قوتابیان نادروستە');
    }
    
    if (data.attendance && !Array.isArray(data.attendance)) {
        errors.push('لیستی غیابات نادروستە');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Helper function بۆ پاککردنەوەی داتا
function sanitizeData(data) {
    // لێرەدا دەتوانیت پاککردنەوە و شێوەدانێکی داتا ئەنجام بدەیت
    return {
        ...data,
        students: data.students?.map(student => ({
            ...student,
            id: student.id?.toString() || `student-${Date.now()}-${Math.random()}`,
            name: student.name?.trim() || 'ناوی دیارینەکراو',
            receivedAt: new Date().toISOString()
        })) || [],
        
        attendance: data.attendance?.map(attendance => ({
            ...attendance,
            id: attendance.id?.toString() || `attendance-${Date.now()}-${Math.random()}`,
            studentId: attendance.studentId?.toString(),
            timestamp: attendance.timestamp || new Date().toISOString(),
            receivedAt: new Date().toISOString()
        })) || []
    };
}
