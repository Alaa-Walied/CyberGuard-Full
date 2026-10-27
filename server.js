
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const exifr = require('exifr');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

const scanHistory = [];

console.log('CyberGuard backend initialized.');
console.log('Sightengine configuration:', {
    configured: Boolean(
        process.env.SIGHTENGINE_API_USER &&
        process.env.SIGHTENGINE_API_SECRET
    )
});

function addToHistory(entry) {
    scanHistory.unshift({
        ...entry,
        date: new Date()
    });

    // الاحتفاظ بآخر 100 فحص في الذاكرة
    if (scanHistory.length > 100) {
        scanHistory.pop();
    }
}

app.get('/', (req, res) => {
    res.send('CyberGuard Backend is Running!');
});

// --------------------------------------------------
// 1. URL scan — تجريبي حاليًا، وليس فحصًا أمنيًا حقيقيًا
// --------------------------------------------------
app.post('/api/scan/url', (req, res) => {
    const { url } = req.body || {};

    if (!url || typeof url !== 'string') {
        return res.status(400).json({
            status: 'error',
            message: 'من فضلك أدخلي رابطًا صحيحًا.'
        });
    }

    const message =
        'الفحص الأمني الحقيقي للرابط لم يتم تفعيله بعد. هذه نتيجة تجريبية فقط.';

    addToHistory({
        type: 'url',
        target: url,
        riskLevel: 'Unknown',
        message,
        isMock: true
    });

    return res.json({
        status: 'success',
        message,
        riskLevel: 'Unknown',
        isMock: true
    });
});

// --------------------------------------------------
// 2. File scan — تجريبي حاليًا
// --------------------------------------------------
app.post('/api/scan/file', (req, res) => {
    const fileName = req.body?.fileName || 'Unknown File';

    const message =
        'لم يتم تحليل محتوى الملف أمنيًا بعد. هذه نتيجة تجريبية وليست تأكيدًا على أمان الملف.';

    addToHistory({
        type: 'file',
        target: fileName,
        riskLevel: 'Unknown',
        message,
        isMock: true
    });

    return res.json({
        status: 'success',
        fileName,
        riskLevel: 'Unknown',
        message,
        isMock: true
    });
});

// --------------------------------------------------
// 3. AI-generated image detection — Sightengine API
// --------------------------------------------------
app.post(
    '/api/ai-image-check',
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'لم يتم رفع أي صورة.'
                });
            }

            if (!req.file.mimetype?.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    message: 'الملف المرفوع ليس ملف صورة صالحًا حسب نوعه المعلن.'
                });
            }

            const apiUser = process.env.SIGHTENGINE_API_USER;
            const apiSecret = process.env.SIGHTENGINE_API_SECRET;

            if (!apiUser || !apiSecret) {
                return res.status(503).json({
                    success: false,
                    message: 'خدمة تحليل الصور غير مهيأة. راجعي إعدادات Sightengine في ملف .env.'
                });
            }

            // البيانات الوصفية قد تساعد في الفحص، لكنها لا تثبت أصالة الصورة.
            let hasMetadata = false;

            try {
                const exifData = await exifr.parse(req.file.buffer);
                hasMetadata = Boolean(
                    exifData &&
                    (
                        exifData.Make ||
                        exifData.Model ||
                        exifData.DateTimeOriginal
                    )
                );
            } catch {
                // غياب بيانات EXIF لا يعني أن الصورة مزيفة.
                hasMetadata = false;
            }

            // إرسال الصورة نفسها إلى خدمة الكشف الخارجية.
            const formData = new FormData();

            formData.append(
                'media',
                new Blob([req.file.buffer], {
                    type: req.file.mimetype
                }),
                req.file.originalname || 'uploaded-image'
            );

            formData.append('models', 'genai');
            formData.append('api_user', apiUser);
            formData.append('api_secret', apiSecret);

            const response = await fetch(
                'https://api.sightengine.com/1.0/check.json',
                {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(30000)
                }
            );

            const result = await response.json();

            if (
                !response.ok ||
                result.status !== 'success' ||
                !result.type ||
                typeof result.type.ai_generated !== 'number'
            ) {
                console.error(
                    'Sightengine request failed:',
                    result.error?.message || `HTTP ${response.status}`
                );

                return res.status(502).json({
                    success: false,
                    message: 'تعذر إكمال تحليل الصورة حاليًا. حاولي مرة أخرى لاحقًا.'
                });
            }

            // الدرجة التي ترجعها الخدمة تقع بين 0 و1.
            const aiScore = result.type.ai_generated;

            if (aiScore < 0 || aiScore > 1) {
                return res.status(502).json({
                    success: false,
                    message: 'خدمة تحليل الصور أعادت نتيجة غير صالحة.'
                });
            }

            const confidence = Number((aiScore * 100).toFixed(1));

            let classification;
            let message;
            let isAI = null;

            if (aiScore >= 0.70) {
                classification = 'likely_ai_generated';
                isAI = true;
                message =
                    `الخدمة رصدت مؤشرات قوية على أن الصورة مولّدة بالذكاء الاصطناعي. درجة الكشف: ${confidence}٪. النتيجة مؤشر وليست إثباتًا قاطعًا.`;
            } else if (aiScore <= 0.30) {
                classification = 'likely_not_ai_generated';
                isAI = false;
                message =
                    `الخدمة رصدت مؤشرات منخفضة على توليد الصورة بالذكاء الاصطناعي. درجة الكشف: ${confidence}٪. هذا لا يضمن أن الصورة أصلية أو خالية من التعديل.`;
            } else {
                classification = 'inconclusive';
                message =
                    `نتيجة تحليل الصورة غير حاسمة. درجة الكشف التي أعادتها الخدمة: ${confidence}٪. يلزم فحص إضافي قبل إصدار حكم.`;
            }

            const responseData = {
                success: true,
                message,
                confidence,
                isAI,
                classification,
                metadataPresent: hasMetadata,
                provider: 'Sightengine',
                note: 'هذا الفحص مخصص لتقدير احتمال توليد الصورة بالذكاء الاصطناعي، ولا يثبت وحده حدوث Deepfake أو Face Swap.'
            };

            addToHistory({
                type: 'ai-image',
                target: req.file.originalname || 'uploaded-image',
                riskLevel:
                    classification === 'likely_ai_generated'
                        ? 'Elevated'
                        : classification === 'inconclusive'
                            ? 'Unknown'
                            : 'Undetermined',
                message,
                confidence,
                classification,
                provider: 'Sightengine'
            });

            return res.json(responseData);
        } catch (error) {
            console.error(
                'Image analysis error:',
                error.name === 'TimeoutError'
                    ? 'Sightengine request timed out.'
                    : error.message
            );

            if (error.name === 'TimeoutError') {
                return res.status(504).json({
                    success: false,
                    message: 'استغرق تحليل الصورة وقتًا أطول من المتوقع. حاولي مرة أخرى.'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحليل الصورة. لم يتم إصدار نتيجة أمنية.'
            });
        }
    }
);

// --------------------------------------------------
// 4. Audio scan — تجريبي، لا يكشف التزييف الصوتي فعليًا
// --------------------------------------------------
app.post(
    '/api/scan/audio',
    upload.single('audioFile'),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'لم يتم رفع أي ملف صوتي.'
            });
        }

        const message =
            'تم استلام الملف الصوتي، لكن خدمة الكشف الحقيقي عن التزييف الصوتي غير مفعلة بعد.';

        addToHistory({
            type: 'audio',
            target: req.file.originalname || 'uploaded-audio',
            riskLevel: 'Unknown',
            message,
            isMock: true
        });

        return res.json({
            success: true,
            isDeepfake: null,
            message,
            confidence: null,
            isMock: true
        });
    }
);

// --------------------------------------------------
// 5. Scan history — محفوظة في الذاكرة حتى إعادة تشغيل الخادم
// --------------------------------------------------
app.get('/api/scans/history', (req, res) => {
    return res.json({
        status: 'success',
        count: scanHistory.length,
        history: scanHistory
    });
});

// --------------------------------------------------
// 6. التعامل مع أخطاء رفع الملفات
// --------------------------------------------------
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                message: 'حجم الملف أكبر من الحد المسموح به (10 MB).'
            });
        }

        return res.status(400).json({
            success: false,
            message: 'حدثت مشكلة أثناء رفع الملف.'
        });
    }

    console.error('Unhandled server error:', err.message);

    return res.status(500).json({
        success: false,
        message: 'حدث خطأ داخلي في الخادم.'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
