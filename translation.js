import { playSound } from './audio.js';

let currentLanguage = 'en';
const translations = {};
const originalTexts = {};

export function storeOriginalTexts() {
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.dataset.key;
        if (el.tagName === 'INPUT') {
            originalTexts[key] = el.placeholder;
        } else if (el.dataset.key === 'postContentPlaceholder') {
            originalTexts[key] = el.dataset.placeholder;
        } else if (el.dataset.key === 'storyMode' || el.dataset.key === 'haosMode' || el.dataset.key === 'community' || el.dataset.key === 'mods' || el.dataset.key === 'settings') {
            originalTexts[key] = el.firstChild.textContent.trim();
        } else if (el.dataset.key === 'members') {
            originalTexts[key] = el.textContent.split('-')[0].trim();
        } else if (el.dataset.key === 'attachImage') {
            originalTexts[key] = el.textContent;
        } else if (el.dataset.key === 'uploading') {
            originalTexts[key] = el.textContent;
        } else if (el.dataset.key === 'reportPost') {
            originalTexts[key] = el.textContent;
        } else if (el.dataset.key === 'mods' || el.dataset.key === 'modsTitle' || el.dataset.key === 'createMod' || el.dataset.key === 'installedMods' || el.dataset.key === 'browseMods' || el.dataset.key === 'modEditor') {
            originalTexts[key] = el.textContent;
        }
        else {
            originalTexts[key] = el.textContent;
        }
    });
    translations['en'] = { ...originalTexts };
}

async function translateUI(language) {
    if (language === currentLanguage) return;
    if (translations[language]) {
        applyTranslations(language);
        currentLanguage = language;
        return;
    }

    const loader = document.getElementById('translation-loader');
    const langButtons = document.getElementById('language-buttons');
    loader.style.display = 'block';
    langButtons.style.display = 'none';

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Translate the values of the following JSON object from English to ${language}. Return only the translated JSON object. The keys must remain exactly the same. For "comingSoon", translate the phrase but keep the parentheses. For "members", just translate the word "Members".`,
                },
                {
                    role: 'user',
                    content: JSON.stringify(originalTexts),
                },
            ],
            json: true,
        });

        const translatedTexts = JSON.parse(completion.content);
        translations[language] = translatedTexts;
        applyTranslations(language);
        currentLanguage = language;

    } catch (error) {
        console.error(`Failed to translate to ${language}:`, error);
        const lastLangBtn = document.querySelector(`.lang-btn[data-lang="${currentLanguage}"]`);
        if(lastLangBtn) lastLangBtn.click();
    } finally {
        loader.style.display = 'none';
        langButtons.style.display = 'block';
    }
}

function applyTranslations(language) {
    const langCache = translations[language];
    if (!langCache) return;

    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.dataset.key;
        if (langCache[key]) {
             if (el.tagName === 'INPUT') {
                el.placeholder = langCache[key];
            } else if (key === 'postContentPlaceholder') {
                el.dataset.placeholder = langCache[key];
            } else if (key === 'storyMode' || key === 'haosMode') {
                const comingSoonSpan = el.querySelector('.coming-soon');
                el.firstChild.textContent = `${langCache[key]} `;
                if(comingSoonSpan) comingSoonSpan.textContent = langCache['comingSoon'];
            } else if (key === 'community' || key === 'mods' || key === 'settings') {
                const comingSoonSpan = el.querySelector('.coming-soon');
                el.firstChild.textContent = `${langCache[key]} `;
                if (comingSoonSpan) comingSoonSpan.textContent = langCache['comingSoonCustom'];
            } else if (key === 'members') {
                const currentCount = document.getElementById('participants-count').textContent.split('-')[1]?.trim() || '0';
                el.textContent = `${langCache[key]} - ${currentCount}`;
            }
            else {
                el.textContent = langCache[key];
            }
        }
    });
    const splashTitle = document.querySelector('#splash-screen h1');
    if(splashTitle && langCache['splashTitle']) {
        splashTitle.dataset.text = langCache['splashTitle'];
    }
}

export function setupLanguageSelector() {
    const langButtonsContainer = document.getElementById('language-buttons');
    
    langButtonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('lang-btn')) {
            const lang = e.target.dataset.lang;
            const otherInputContainer = document.getElementById('other-lang-input-container');

            if (lang === 'other') {
                otherInputContainer.style.display = 'flex';
                document.getElementById('other-lang-input').focus();
            } else {
                otherInputContainer.style.display = 'none';
                translateUI(lang);
                playSound('click');
            }

            langButtonsContainer.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
        }
    });

    document.getElementById('other-lang-submit').addEventListener('click', () => {
        const input = document.getElementById('other-lang-input');
        const customLang = input.value.trim();
        if (customLang) {
            translateUI(customLang);
            input.value = '';
            document.getElementById('other-lang-input-container').style.display = 'none';
        }
         playSound('click');
    });
     document.getElementById('other-lang-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('other-lang-submit').click();
        }
    });
}

export { currentLanguage, translations, originalTexts };