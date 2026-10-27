
const API_BASE_URL = "http://localhost:5000";

// ===============================
// التنقل بين صفحات الموقع
// ===============================
const links = document.querySelectorAll("[data-page]");
const pages = document.querySelectorAll(".page-section");

function showPage(pageName) {
    pages.forEach(page => page.classList.remove("active-page"));

    const selectedPage = document.getElementById(pageName);

    if (selectedPage) {
        selectedPage.classList.add("active-page");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

links.forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        showPage(link.getAttribute("data-page"));
    });
});

// ===============================
// تسجيل الدخول والتنقل للفحص
// ===============================
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
    loginBtn.addEventListener("click", () => showPage("login"));
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", event => {
        event.preventDefault();

        const name = document.getElementById("userName")?.value.trim();
        const phone = document.getElementById("userPhone")?.value.trim();
        const email = document.getElementById("userEmail")?.value.trim();

        if (!name || !phone || !email) {
            alert("من فضلك املأ جميع البيانات.");
            return;
        }

        // تسجيل الدخول هنا تجريبي، وليس نظام مصادقة حقيقيًا.
        showPage("scan");
    });
}

const startScanBtn = document.getElementById("startScanBtn");

if (startScanBtn) {
    startScanBtn.addEventListener("click", () => showPage("scan"));
}

// ===============================
// عرض النتيجة في عناصر التصميم الحالية
// ===============================
function showResult(title, text) {
    const result = document.getElementById("scanResult");
    const resultTitle = document.getElementById("resultTitle");
    const resultText = document.getElementById("resultText");

    if (resultTitle) resultTitle.textContent = title;
    if (resultText) resultText.textContent = text;
    if (result) result.classList.add("show");
}

// ===============================
// فحص الصور باستخدام Sightengine
// يرسل الصورة نفسها إلى الـ Backend
// ===============================
async function submitImageForAIAnalysis(file, resultTarget = "scanResult") {
    if (!file) {
        alert("من فضلك اختاري صورة أولًا.");
        return;
    }

    if (!file.type || !file.type.startsWith("image/")) {
        alert("من فضلك اختاري ملف صورة صالحًا.");
        return;
    }

    const resultDiv = resultTarget === "aiImageResult"
        ? document.getElementById("aiImageResult")
        : null;

    if (resultDiv) {
        resultDiv.textContent = "جاري تحليل الصورة، برجاء الانتظار...";
    } else {
        showResult(
            "جاري تحليل الصورة...",
            "يتم إرسال الصورة إلى خدمة التحليل."
        );
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/ai-image-check`,
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message || "تعذر تحليل الصورة."
            );
        }

        const confidenceText =
            typeof data.confidence === "number"
                ? `درجة الكشف التي أعادتها الخدمة: ${data.confidence}%.`
                : "";

        const message = [
            data.message || "اكتمل تحليل الصورة.",
            confidenceText
        ].filter(Boolean).join(" ");

        let title = "نتيجة تحليل الصورة";

        if (data.classification === "likely_ai_generated") {
            title = "توجد مؤشرات على أن الصورة مولّدة بالذكاء الاصطناعي";
        } else if (data.classification === "inconclusive") {
            title = "نتيجة تحليل الصورة غير حاسمة";
        }

        if (resultDiv) {
            resultDiv.replaceChildren();

            const alertElement = document.createElement("div");

            alertElement.className =
                data.classification === "likely_ai_generated" ||
                data.classification === "inconclusive"
                    ? "alert alert-warning"
                    : "alert alert-success";

            alertElement.textContent = `${title}. ${message}`;
            resultDiv.appendChild(alertElement);
        } else {
            showResult(title, message);
        }

        console.log("Analysis provider:", data.provider || "unknown");
        console.log("Classification:", data.classification || "unknown");

    } catch (error) {
        console.error("Image analysis error:", error);

        const message =
            error.message || "تعذر الاتصال بخدمة تحليل الصور.";

        if (resultDiv) {
            resultDiv.replaceChildren();

            const alertElement = document.createElement("div");
            alertElement.className = "alert alert-danger";
            alertElement.textContent = message;

            resultDiv.appendChild(alertElement);
        } else {
            showResult("تعذر تحليل الصورة", message);
        }
    }
}

// ===============================
// زر فحص الصورة في قسم imageInput
// ===============================
const imageScanBtn = document.getElementById("imageScanBtn");

if (imageScanBtn) {
    imageScanBtn.addEventListener("click", async () => {
        const file = document.getElementById("imageInput")?.files?.[0];

        await submitImageForAIAnalysis(file, "scanResult");
    });
}

// الحفاظ على الدالة لو كانت مستخدمة في HTML
async function scanImage() {
    const file = document.getElementById("imageInput")?.files?.[0];

    await submitImageForAIAnalysis(file, "scanResult");
}

// ===============================
// زر فحص الصورة في قسم aiImageFile
// ===============================
async function checkAIImage() {
    const file = document.getElementById("aiImageFile")?.files?.[0];

    await submitImageForAIAnalysis(file, "aiImageResult");
}

// ===============================
// فحص الملفات
// تنبيه: هذا المسار تجريبي ولا يفحص محتوى الملف فعليًا
// ===============================
const fileScanBtn = document.getElementById("fileScanBtn");

if (fileScanBtn) {
    fileScanBtn.addEventListener("click", async () => {
        const file = document.getElementById("fileInput")?.files?.[0];

        if (!file) {
            alert("من فضلك اختاري ملفًا أولًا.");
            return;
        }

        showResult(
            "جاري فحص الملف...",
            "الفحص الأمني الحقيقي لمحتوى الملفات غير مفعّل بعد."
        );

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/scan/file`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        fileName: file.name
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "تعذر فحص الملف.");
            }

            showResult(
                "نتيجة فحص الملف",
                `اسم الملف: ${file.name}. ${data.message || ""} مستوى الخطر: ${data.riskLevel || "غير محدد"}`
            );

        } catch (error) {
            console.error("File scan error:", error);

            showResult(
                "خطأ في الاتصال",
                "تأكدي من تشغيل الـ Backend."
            );
        }
    });
}

// ===============================
// فحص الروابط
// تنبيه: المسار الحالي تجريبي وليس فحصًا أمنيًا حقيقيًا
// ===============================
const urlScanBtn = document.getElementById("urlScanBtn");

if (urlScanBtn) {
    urlScanBtn.addEventListener("click", async () => {
        const url = document.getElementById("urlInput")?.value.trim() || "";

        if (!url) {
            alert("من فضلك أدخلي الرابط أولًا.");
            return;
        }

        showResult(
            "جاري فحص الرابط...",
            "يتم إرسال الرابط إلى السيرفر. الفحص الأمني الحقيقي للرابط غير مفعّل بعد."
        );

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/scan/url`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "تعذر فحص الرابط.");
            }

            showResult(
                "نتيجة فحص الرابط",
                `الرابط: ${url}. الحالة: ${data.message || "غير محددة"}. مستوى الخطر: ${data.riskLevel || "غير محدد"}.`
            );

        } catch (error) {
            console.error("URL scan error:", error);

            showResult(
                "خطأ في الاتصال",
                "فشل الاتصال بالسيرفر. تأكدي من تشغيل الـ Backend."
            );
        }
    });
}

// ===============================
// جلب سجل الفحوصات
// ===============================
async function loadScanHistory() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/scans/history`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status === "success") {
            console.log("سجل الفحوصات:", data.history);
        }

    } catch (error) {
        console.error("History loading error:", error);
    }
}

// ===============================
// عرض سجل الفحوصات في الجدول
// ===============================
async function fetchAndDisplayHistory() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/scans/history`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const tbody = document.getElementById("historyTableBody");

        if (!tbody) return;

        tbody.replaceChildren();

        if (
            data.status === "success" &&
            Array.isArray(data.history) &&
            data.history.length > 0
        ) {
            data.history.forEach(item => {
                const row = document.createElement("tr");

                const typeCell = document.createElement("td");
                typeCell.style.padding = "10px";

                if (item.type === "ai-image") {
                    typeCell.textContent = "🖼️ تحليل صورة بالذكاء الاصطناعي";
                } else if (item.type === "file") {
                    typeCell.textContent = "📁 ملف";
                } else if (item.type === "audio") {
                    typeCell.textContent = "🎙️ صوت";
                } else {
                    typeCell.textContent = "🔗 رابط";
                }

                const targetCell = document.createElement("td");
                targetCell.style.padding = "10px";
                targetCell.style.color = "#38bdf8";
                targetCell.textContent =
                    item.target || item.fileName || "غير محدد";

                const riskCell = document.createElement("td");
                riskCell.style.padding = "10px";
                riskCell.style.fontWeight = "bold";
                riskCell.textContent = item.riskLevel || "غير محدد";

                const messageCell = document.createElement("td");
                messageCell.style.padding = "10px";
                messageCell.textContent =
                    item.message || "لا توجد تفاصيل";

                row.append(
                    typeCell,
                    targetCell,
                    riskCell,
                    messageCell
                );

                tbody.appendChild(row);
            });

        } else {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.style.padding = "15px";
            cell.style.textAlign = "center";
            cell.style.color = "#888";
            cell.textContent = "لا توجد فحوصات مسجلة حتى الآن";

            row.appendChild(cell);
            tbody.appendChild(row);
        }

    } catch (error) {
        console.error("History display error:", error);
        alert("تعذر جلب سجل الفحوصات. تأكدي من تشغيل السيرفر.");
    }
}

// ===============================
// إتاحة الدوال التي قد يستدعيها HTML
// ===============================
window.showPage = showPage;
window.scanImage = scanImage;
window.checkAIImage = checkAIImage;
window.loadScanHistory = loadScanHistory;
window.fetchAndDisplayHistory = fetchAndDisplayHistory;
