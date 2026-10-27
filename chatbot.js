(function () {
    'use strict';

    // عنوان الباك إند (غيّريه لو السيرفر اتنقل لمكان تاني)
    const API_URL = 'http://localhost:5000/api/chat';

    const WELCOME = 'أهلاً بك في CyberGuard 👋\nأنا مساعدك الأمني، اسألني عن الروابط والملفات المشبوهة أو التصيد أو حماية حساباتك.';
    const SUGGESTIONS = ['ما هو التصيد؟', 'كيف أعرف أن الرابط مشبوه؟', 'كيف أحمي كلمة المرور؟'];
    const history = [];
    let busy = false;

    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text) e.textContent = text;
        return e;
    }

    // عرض النص بأمان (من غير innerHTML) مع دعم **الخط الغامق** والنقاط
    function fillText(node, text) {
        text.split('\n').forEach(function (line, i) {
            if (i > 0) node.appendChild(document.createTextNode('\n'));
            line = line.replace(/^\s*[\*\-]\s+/, '• ');
            line.split(/(\*\*[^*]+\*\*)/g).forEach(function (part) {
                if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
                    const s = document.createElement('strong');
                    s.textContent = part.slice(2, -2);
                    node.appendChild(s);
                } else if (part) {
                    node.appendChild(document.createTextNode(part));
                }
            });
        });
    }

    // ===== الزرار العائم =====
    const fab = el('button', 'cg-fab');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'فتح المساعد الذكي');
    const ring = el('span', 'cg-fab-ring');
    const face = el('span', 'cg-face');
    face.appendChild(el('span', 'cg-eye cg-eye-l'));
    face.appendChild(el('span', 'cg-eye cg-eye-r'));
    face.appendChild(el('span', 'cg-smile'));
    ring.appendChild(face);
    fab.appendChild(ring);

    // ===== نافذة الشات =====
    const box = el('div', 'cg-chat');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'مساعد CyberGuard');

    const head = el('div', 'cg-head');
    head.appendChild(el('span', 'cg-head-icon', '🛡️'));
    const title = el('div', 'cg-head-title', 'مساعد CyberGuard');
    title.appendChild(el('span', 'cg-head-sub', 'اسأل عن الأمان الرقمي'));
    head.appendChild(title);
    const closeBtn = el('button', 'cg-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'إغلاق');
    head.appendChild(closeBtn);

    const messages = el('div', 'cg-messages');
    const chips = el('div', 'cg-chips');

    const form = el('form', 'cg-form');
    const input = el('input', 'cg-input');
    input.type = 'text';
    input.placeholder = 'اكتب سؤالك هنا...';
    input.maxLength = 500;
    input.autocomplete = 'off';
    input.setAttribute('dir', 'auto');
    const sendBtn = el('button', 'cg-send', '➤');
    sendBtn.type = 'submit';
    sendBtn.setAttribute('aria-label', 'إرسال');
    form.appendChild(input);
    form.appendChild(sendBtn);

    box.appendChild(head);
    box.appendChild(messages);
    box.appendChild(chips);
    box.appendChild(form);
    document.body.appendChild(box);
    document.body.appendChild(fab);

    // ===== دوال مساعدة =====
    function scrollDown() {
        messages.scrollTop = messages.scrollHeight;
    }

    function addMessage(who, text) {
        const m = el('div', 'cg-msg ' + who);
        m.setAttribute('dir', 'auto');
        fillText(m, text);
        messages.appendChild(m);
        scrollDown();
    }

    function showTyping() {
        const t = el('div', 'cg-typing');
        t.appendChild(el('span'));
        t.appendChild(el('span'));
        t.appendChild(el('span'));
        messages.appendChild(t);
        scrollDown();
        return t;
    }

    function setBusy(state) {
        busy = state;
        input.disabled = state;
        sendBtn.disabled = state;
        if (!state) input.focus();
    }

    function toggle(open) {
        const willOpen = typeof open === 'boolean' ? open : !box.classList.contains('open');
        box.classList.toggle('open', willOpen);
        if (willOpen) {
            fab.classList.remove('cg-alert');
            input.focus();
            scrollDown();
        }
    }

    // ===== إرسال الرسالة للباك إند =====
    // scan = نتيجة الفحص (اختياري) لو المستخدم طلب شرحها
    async function send(text, scan) {
        text = String(text || '').trim();
        if (!text || busy) return;

        setBusy(true);
        chips.style.display = 'none';
        addMessage('user', text);
        input.value = '';
        const typing = showTyping();

        let reply = 'تعذّر الاتصال بالسيرفر، تأكد من تشغيل الباك إند ثم حاول مرة أخرى.';
        let ok = false;

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history: history.slice(-8), scan: scan || '' }),
                signal: AbortSignal.timeout(25000)
            });
            const data = await res.json();
            if (data && data.reply) {
                reply = data.reply;
                ok = res.ok;
            }
        } catch (err) {
            console.log('Chatbot error:', err);
        }

        typing.remove();
        addMessage('bot', reply);
        if (ok) {
            history.push({ role: 'user', text: text });
            history.push({ role: 'bot', text: reply });
        }
        setBusy(false);
    }

    // ===== الأحداث =====
    fab.addEventListener('click', function () { toggle(); });
    closeBtn.addEventListener('click', function () { toggle(false); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') toggle(false);
    });
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        send(input.value);
    });

    SUGGESTIONS.forEach(function (q) {
        const c = el('button', 'cg-chip', q);
        c.type = 'button';
        c.addEventListener('click', function () { send(q); });
        chips.appendChild(c);
    });

    // ===== شرح نتيجة الفحص =====
    // بنراقب صندوق النتيجة في الموقع من غير ما نغيّر كود الفحص نفسه
    const resultBox = document.getElementById('scanResult');
    let lastScan = '';
    let scanTimer = null;

    function readScanResult() {
        const t = document.getElementById('resultTitle');
        const x = document.getElementById('resultText');
        return ((t ? t.textContent : '') + ' - ' + (x ? x.textContent : '')).trim();
    }

    function offerExplain(scanText) {
        const m = el('div', 'cg-msg bot');
        m.setAttribute('dir', 'auto');
        m.appendChild(document.createTextNode('ظهرت نتيجة فحص جديدة 🛡️\nتحب أشرحها لك؟\n'));
        const b = el('button', 'cg-chip', 'اشرح لي النتيجة');
        b.type = 'button';
        b.addEventListener('click', function () {
            b.disabled = true;
            send('اشرح لي نتيجة الفحص بشكل مبسط', scanText);
        });
        m.appendChild(b);
        messages.appendChild(m);
        scrollDown();
        if (!box.classList.contains('open')) fab.classList.add('cg-alert');
    }

    function checkScan() {
        if (!resultBox) return;
        if (!resultBox.classList.contains('show')) {
            lastScan = '';
            return;
        }
        const current = readScanResult();
        if (!current || current.indexOf('ستظهر نتيجة الفحص هنا') !== -1 || current === lastScan) return;
        lastScan = current;
        offerExplain(current);
    }

    if (resultBox) {
        new MutationObserver(function () {
            clearTimeout(scanTimer);
            scanTimer = setTimeout(checkScan, 400);
        }).observe(resultBox, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    addMessage('bot', WELCOME);
})();