const state = {
    tab: null,
    draft: null,
    opportunity: null
};

const el = {
    baseUrl: document.getElementById('baseUrl'),
    userId: document.getElementById('userId'),
    opportunityId: document.getElementById('opportunityId'),
    tabMeta: document.getElementById('tabMeta'),
    statusLog: document.getElementById('statusLog'),
    diagnoseBtn: document.getElementById('diagnoseBtn'),
    captureBtn: document.getElementById('captureBtn'),
    generateBtn: document.getElementById('generateBtn'),
    fillBtn: document.getElementById('fillBtn')
};

function log(message) {
    el.statusLog.textContent = message;
}

function rememberContext() {
    chrome.storage.local.set({
        fundmeBaseUrl: el.baseUrl.value.trim(),
        fundmeUserId: el.userId.value.trim(),
        fundmeOpportunityId: el.opportunityId.value.trim()
    });
}

function getBaseUrl() {
    return (el.baseUrl.value || 'http://localhost:3000').replace(/\/$/, '');
}

function getApiUrl(pathname) {
    return `${getBaseUrl()}${pathname}`;
}

async function apiFetch(pathname, options = {}) {
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    const res = await fetch(getApiUrl(pathname), config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

async function withActiveTab(action) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error('No active browser tab found.');
    state.tab = tab;
    return action(tab);
}

async function sendContentMessage(type, payload = {}) {
    return withActiveTab(tab => new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { type, ...payload }, response => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                reject(new Error(lastError.message));
                return;
            }
            if (response?.error) {
                reject(new Error(response.error));
                return;
            }
            resolve(response);
        });
    }));
}

function injectedExtractFormSchema() {
    const clean = (text) => String(text || '').replace(/\b(Required|Optional|Validate|Check|Help)\b/gi, '').replace(/[*:]/g, '').replace(/\s+/g, ' ').trim();
    const cssPathFor = (element) => {
        if (!(element instanceof Element)) return '';
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
            let selector = current.nodeName.toLowerCase();
            if (current.id) {
                selector += `#${CSS.escape(current.id)}`;
                parts.unshift(selector);
                break;
            }
            if (current.name) selector += `[name="${CSS.escape(current.name)}"]`;
            parts.unshift(selector);
            current = current.parentElement;
        }
        return parts.join(' > ');
    };
    const isVisible = (field) => {
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = field.getBoundingClientRect();
        const name = field.getAttribute('name') || field.id || '';
        const type = (field.type || '').toLowerCase();
        const isSpecial = ['radio', 'checkbox', 'select-one', 'select-multiple'].includes(type) || field.tagName === 'SELECT';
        return rect.width > 1 || rect.height > 1 || isSpecial || name.length >= 3 || field.placeholder;
    };
    const getLabel = (field) => {
        const aria = field.getAttribute('aria-label');
        if (aria) return clean(aria);
        const labelledBy = field.getAttribute('aria-labelledby');
        if (labelledBy) {
            const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').filter(Boolean).join(' ');
            if (text) return clean(text);
        }
        if (field.id) {
            const label = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
            if (label?.textContent) return clean(label.textContent);
        }
        const wrapping = field.closest('label');
        if (wrapping?.textContent) return clean(wrapping.textContent);
        let container = field.parentElement;
        for (let i = 0; i < 4 && container; i += 1) {
            const label = container.querySelector('label, legend, [class*="label"], [class*="Label"], [class*="title"], [class*="Title"]');
            if (label && label !== field && clean(label.textContent).length > 1) return clean(label.textContent);
            container = container.parentElement;
        }
        return clean(field.placeholder || field.name || field.id || 'Application Field');
    };
    const slug = (value, fallback) => clean(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70) || fallback;
    const getSection = (field) => {
        const fieldset = field.closest('fieldset');
        const legend = fieldset?.querySelector('legend');
        if (legend?.textContent) return clean(legend.textContent);
        const section = field.closest('section, [role="group"], form, main, article, div');
        const heading = section?.querySelector('h1, h2, h3, h4');
        return clean(heading?.textContent) || 'Application Details';
    };
    const queryAllPiercing = (selector, root = document) => {
        const results = Array.from(root.querySelectorAll(selector));
        const withShadow = Array.from(root.querySelectorAll('*')).filter(el => el.shadowRoot);
        withShadow.forEach(el => results.push(...queryAllPiercing(selector, el.shadowRoot)));
        return results;
    };

    const fields = queryAllPiercing('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]')
        .filter(field => !field.closest('template') && isVisible(field));

    const radioGroups = new Map();
    const sections = new Map();

    fields.forEach((field, index) => {
        const tag = field.tagName.toLowerCase();
        const rawType = (field.type || tag).toLowerCase();
        const label = getLabel(field);
        const section = getSection(field);
        const id = slug(field.name || field.id || label, `field_${index + 1}`);

        if (rawType === 'radio') {
            const groupKey = field.name || id;
            const entry = radioGroups.get(groupKey) || {
                id: groupKey,
                label,
                type: 'select',
                required: field.required,
                placeholder: '',
                help_text: '',
                options: [],
                section,
                selectorHints: {
                    name: field.name || '',
                    id: field.id || '',
                    css: cssPathFor(field)
                }
            };
            entry.options.push(field.value || label || 'Option');
            radioGroups.set(groupKey, entry);
            return;
        }

        const descriptor = {
            id,
            label,
            type: tag === 'textarea' || tag === 'div' ? 'textarea' : (tag === 'select' ? 'select' : rawType),
            required: field.required,
            placeholder: field.placeholder || '',
            name: field.name || '',
            help_text: '',
            options: tag === 'select' ? Array.from(field.options || []).map(option => clean(option.textContent)).filter(Boolean) : [],
            section,
            selectorHints: {
                name: field.name || '',
                id: field.id || '',
                css: cssPathFor(field)
            }
        };

        if (!sections.has(section)) sections.set(section, []);
        sections.get(section).push(descriptor);
    });

    radioGroups.forEach(entry => {
        if (!sections.has(entry.section)) sections.set(entry.section, []);
        entry.options = Array.from(new Set(entry.options.filter(Boolean)));
        sections.get(entry.section).push(entry);
    });

    const normalizedSections = Array.from(sections.entries()).map(([title, fields]) => ({
        title,
        fields
    })).filter(section => section.fields.length > 0);

    const fieldCount = normalizedSections.reduce((total, section) => total + section.fields.length, 0);

    return {
        schema: {
            title: `${document.title || location.hostname} Application`,
            subtitle: `Captured from ${location.hostname}`,
            sections: normalizedSections,
            required_documents: []
        },
        fieldCount,
        pageTitle: document.title,
        selectedRootTag: document.body?.tagName?.toLowerCase() || 'body',
        selectedRootScore: fieldCount,
        frameUrl: location.href
    };
}

async function requestSchemaFromAllFrames() {
    return new Promise(async (resolve, reject) => {
        let bestSchema = null;

        const listener = (msg) => {
            if (msg.type === 'SCHEMA_RESPONSE' && msg.schema) {
                if (!bestSchema || msg.schema.fieldCount > bestSchema.fieldCount) {
                    bestSchema = msg.schema;
                }
            }
        };
        chrome.runtime.onMessage.addListener(listener);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            chrome.runtime.onMessage.removeListener(listener);
            return reject(new Error('No active browser tab found.'));
        }

        // Guard: Diagnose only works on external grant application pages, not on FundMe itself
        if (isFundMeTab(tab.url)) {
            chrome.runtime.onMessage.removeListener(listener);
            return reject(new Error(
                '⚠️ You are on the FundMe app page.\n\nTo use Diagnose, navigate to the external grant application form (the "Apply" link) first, then click Diagnose.'
            ));
        }

        // Send via chrome.tabs.sendMessage so content.js's BROADCAST_EXTRACT_SCHEMA
        // handler is triggered correctly (executeScript runs in a separate isolated
        // context where content.js globals like extractFormSchema are not accessible).
        try {
            await chrome.tabs.sendMessage(tab.id, { type: 'BROADCAST_EXTRACT_SCHEMA' });
        } catch (e) {
            // Content script may not be injected yet — ignore and let timeout handle it
            console.warn('FundMe Popup: sendMessage failed:', e.message);
        }

        try {
            const injected = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: injectedExtractFormSchema
            });
            injected.forEach(item => {
                const schema = item?.result;
                if (schema?.fieldCount > 0 && (!bestSchema || schema.fieldCount > bestSchema.fieldCount)) {
                    bestSchema = schema;
                }
            });
        } catch (e) {
            console.warn('FundMe Popup: direct extraction failed:', e.message);
        }

        setTimeout(() => {
            chrome.runtime.onMessage.removeListener(listener);
            if (bestSchema) {
                resolve(bestSchema);
            } else {
                reject(new Error("No usable application fields were detected on this page. Check if the page is fully loaded."));
            }
        }, 5000);
    });
}

async function broadcastFillCommand(type, payload) {
    return new Promise(async (resolve) => {
        let totalFilled = 0;
        let allUnmatched = [];

        const listener = (msg) => {
            if (msg.type === 'FILL_RESPONSE') {
                totalFilled += msg.result.filledCount || 0;
                if (msg.result.unmatched) {
                    allUnmatched.push(...msg.result.unmatched);
                }
            }
        };
        chrome.runtime.onMessage.addListener(listener);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            // 1. Send to main frame via message (fastest)
            chrome.tabs.sendMessage(tab.id, { type, ...payload });

            // 2. Broadcast to all frames (including iframes) via executeScript
            chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: (t, p) => {
                    if (t === 'BROADCAST_FILL_FIELDS' && typeof fillFormFields === 'function') {
                        const res = fillFormFields(p.schema, p.values);
                        if (res?.filledCount > 0) chrome.runtime.sendMessage({ type: 'FILL_RESPONSE', result: res });
                    }
                    if (t === 'BROADCAST_FILL_MAPPING' && typeof fillWithMapping === 'function') {
                        const res = fillWithMapping(p.mapping, p.values);
                        if (res?.filledCount > 0) chrome.runtime.sendMessage({ type: 'FILL_RESPONSE', result: res });
                    }
                },
                args: [type, payload]
            }).catch(err => console.warn('FundMe Popup: Multi-frame fill failed:', err.message));
        }

        setTimeout(() => {
            chrome.runtime.onMessage.removeListener(listener);
            resolve({ filledCount: totalFilled, unmatched: [...new Set(allUnmatched)] });
        }, 600);
    });
}

function setBusy(button, busyText) {
    const original = button.dataset.originalText || button.textContent;
    button.dataset.originalText = original;
    button.disabled = true;
    button.textContent = busyText;
    return () => {
        button.disabled = false;
        button.textContent = original;
    };
}

function getCurrentSiteSummary(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`;
    } catch (err) {
        return url;
    }
}

function isFundMeTab(url) {
    try {
        return new URL(url).origin === new URL(getBaseUrl()).origin;
    } catch (err) {
        return false;
    }
}

async function ensureIdentifiers() {
    const userId = el.userId.value.trim();
    const opportunityId = el.opportunityId.value.trim();
    rememberContext();
    if (!userId || !opportunityId) {
        throw new Error('User ID and Opportunity ID are required.');
    }
    return { userId, opportunityId };
}

async function loadDraftByContext(userId, opportunityId) {
    try {
        const draft = await apiFetch(`/api/drafts/by-opportunity?user_id=${encodeURIComponent(userId)}&opportunity_id=${encodeURIComponent(opportunityId)}`);
        state.draft = draft;
        return draft;
    } catch (err) {
        return null;
    }
}

async function stageLookup() {
    try {
        const session = await apiFetch(`/api/extension/session?external_url=${encodeURIComponent(state.tab.url)}`);
        el.userId.value = session.user_id || el.userId.value;
        el.opportunityId.value = session.opportunity_id || el.opportunityId.value;
        rememberContext();
        await loadDraftByContext(el.userId.value.trim(), el.opportunityId.value.trim());
        log(`Found staged session for ${new URL(state.tab.url).hostname}.\nUser: ${el.userId.value}\nOpportunity: ${el.opportunityId.value}`);
    } catch (err) {
        log(`Connected to ${new URL(state.tab.url).hostname}.\nNo staged FundMe session found yet. You can still enter User ID and Opportunity ID manually.`);
    }
}

async function loadTabContext() {
    const saved = await chrome.storage.local.get(['fundmeBaseUrl', 'fundmeUserId', 'fundmeOpportunityId']);
    if (saved.fundmeBaseUrl) el.baseUrl.value = saved.fundmeBaseUrl;
    if (saved.fundmeUserId) el.userId.value = saved.fundmeUserId;
    if (saved.fundmeOpportunityId) el.opportunityId.value = saved.fundmeOpportunityId;

    await withActiveTab(async tab => {
        const summary = getCurrentSiteSummary(tab.url);
        el.tabMeta.textContent = `Current site: ${summary}`;
        if (isFundMeTab(tab.url)) {
            log('Extension detected FundMe site. Switch to the application portal tab to use Smart Fill.');
            return;
        }
        await stageLookup();
    });

    // Listen for storage changes (e.g. if a session is stashed while popup is open)
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.fundmeUserId) el.userId.value = changes.fundmeUserId.newValue;
        if (changes.fundmeOpportunityId) el.opportunityId.value = changes.fundmeOpportunityId.newValue;
        if (changes.fundmeBaseUrl) el.baseUrl.value = changes.fundmeBaseUrl.newValue;
    });
}

async function diagnosePage() {
    const release = setBusy(el.diagnoseBtn, 'Inspecting...');
    try {
        if (isFundMeTab(state.tab?.url)) {
            throw new Error('Switch to the external application portal tab first.');
        }
        const extracted = await requestSchemaFromAllFrames();
        const sectionCount = extracted?.schema?.sections?.length || 0;
        const titles = (extracted?.schema?.sections || []).map(section => section.title).slice(0, 4);
        log(
            `Detected ${extracted?.fieldCount || 0} field(s) across ${sectionCount} section(s).\n` +
            `Selected container: ${extracted?.selectedRootTag || 'unknown'} (score ${extracted?.selectedRootScore || 0}).\n` +
            `Sections: ${titles.join(', ') || 'none'}`
        );
    } catch (err) {
        log(`Diagnose failed: ${err.message}`);
    } finally {
        release();
    }
}

async function captureForm() {
    const release = setBusy(el.captureBtn, 'Capturing...');
    try {
        const { userId, opportunityId } = await ensureIdentifiers();
        if (isFundMeTab(state.tab?.url)) {
            throw new Error('Open the external application portal tab first, then run capture there.');
        }

        const extracted = await requestSchemaFromAllFrames();
        if (!extracted?.schema?.sections?.length || !extracted.fieldCount) {
            throw new Error('No usable application fields were detected on this page.');
        }

        const draft = await apiFetch('/api/drafts/bootstrap', {
            method: 'POST',
            body: {
                user_id: userId,
                opportunity_id: opportunityId,
                source_url: state.tab.url,
                form_schema: extracted.schema,
                schema_source: 'extension_capture',
                capture_meta: {
                    captured_at: new Date().toISOString(),
                    field_count: extracted.fieldCount || 0,
                    page_title: extracted.pageTitle || '',
                    selected_root_tag: extracted.selectedRootTag || '',
                    selected_root_score: extracted.selectedRootScore || 0
                }
            }
        });

        state.draft = draft;
        log(
            `Captured ${extracted.fieldCount} live field(s).\n` +
            `Draft: ${draft.draft_id}\n` +
            `Schema source: ${draft.schema_source}\n` +
            `Page: ${getCurrentSiteSummary(state.tab.url)}`
        );
    } catch (err) {
        log(`Capture failed: ${err.message}`);
    } finally {
        release();
    }
}

async function generateAnswers() {
    const release = setBusy(el.generateBtn, 'Generating...');
    try {
        const { userId, opportunityId } = await ensureIdentifiers();
        if (!state.draft) {
            state.draft = await loadDraftByContext(userId, opportunityId);
        }
        if (!state.draft) {
            await captureForm();
        }
        if (!state.draft?.draft_id) {
            throw new Error('Capture the live form first, or make sure a saved draft exists for this opportunity.');
        }

        const [profile, opportunity] = await Promise.all([
            apiFetch(`/api/founder/profile?user_id=${encodeURIComponent(userId)}`),
            apiFetch(`/api/opportunities/${encodeURIComponent(opportunityId)}`)
        ]);

        const generated = await apiFetch('/api/ai/generate-draft', {
            method: 'POST',
            body: {
                profile,
                form_schema: state.draft.form_schema,
                form_fields: state.draft.form_fields || {}, // Pass existing answers so server skips them
                opportunity
            }
        });

        state.opportunity = opportunity;
        state.draft = await apiFetch(`/api/drafts/${state.draft.draft_id}`, {
            method: 'PUT',
            body: {
                form_fields: generated.result,
                source_url: state.tab?.url || state.draft.source_url || '',
                schema_source: state.draft.schema_source || 'extension_capture'
            }
        });

        const genCount = generated.generated ?? Object.keys(generated.result || {}).length;
        const skipCount = generated.skipped ?? 0;
        const skipNote = skipCount > 0 ? `\n${skipCount} field(s) reused from existing draft (tokens saved).` : '';
        log(`Generated ${genCount} new answer(s).${skipNote}\nDraft is ready to fill into the portal.`);

    } catch (err) {
        const message = String(err.message || '');
        if (message.includes('All AI providers')) {
            log('Generation failed because the AI provider keys or outbound AI access are not working. Check key.txt and confirm Groq/OpenRouter access from the FundMe server.');
        } else {
            log(`Generation failed: ${message}`);
        }
    } finally {
        release();
    }
}

async function fillPortal() {
    const release = setBusy(el.fillBtn, 'Filling...');
    try {
        const { userId, opportunityId } = await ensureIdentifiers();
        if (isFundMeTab(state.tab?.url)) {
            throw new Error('Switch back to the external application portal tab first.');
        }

        if (!state.draft) {
            state.draft = await loadDraftByContext(userId, opportunityId);
        }
        if (!state.draft?.draft_id) {
            throw new Error('No saved draft was found. Capture and generate answers first.');
        }

        const result = await broadcastFillCommand('BROADCAST_FILL_FIELDS', {
            schema: state.draft.form_schema,
            values: state.draft.form_fields || {}
        });

        const unmatched = (result?.unmatched || []).slice(0, 6);
        log(
            `Filled ${result?.filledCount || 0} field(s) on the live portal.\n` +
            `${unmatched.length ? `Still unmatched: ${unmatched.join(', ')}` : 'Everything matched cleanly.'}\n` +
            `Armed reactive watcher for conditional fields.`
        );

        if (state.tab?.id) {
            chrome.tabs.sendMessage(state.tab.id, {
                type: 'BROADCAST_START_WATCHER',
                payload: {
                    userId,
                    opportunityId,
                    baseUrl: getBaseUrl()
                }
            });
        }
    } catch (err) {
        log(`Fill failed: ${err.message}`);
    } finally {
        release();
    }
}

async function aiFillPortal() {
    const release = setBusy(el.aiFillBtn, 'AI Mapping...');
    try {
        const { userId, opportunityId } = await ensureIdentifiers();
        if (isFundMeTab(state.tab?.url)) {
            throw new Error('Switch back to the external application portal tab first.');
        }

        if (!state.draft) {
            state.draft = await loadDraftByContext(userId, opportunityId);
        }
        if (!state.draft?.draft_id) {
            throw new Error('No saved draft was found. Capture and generate answers first.');
        }

        log('Extracting portal fields for AI mapping...');
        const extracted = await requestSchemaFromAllFrames();
        const pageFields = (extracted?.schema?.sections || []).flatMap(s => s.fields || []);

        log('AI is mapping portal fields to your draft...');
        const { mapping } = await apiFetch('/api/ai/map-fields', {
            method: 'POST',
            body: {
                pageFields,
                draftSchema: state.draft.form_schema
            }
        });

        if (!mapping || Object.keys(mapping).length === 0) {
            throw new Error('AI could not find any matches between this page and your draft.');
        }

        log(`AI found ${Object.keys(mapping).length} matches. Filling now...`);
        
        // Re-map the draft values to the portal IDs
        const aiValues = {};
        Object.entries(mapping).forEach(([portalId, draftId]) => {
            aiValues[portalId] = state.draft.form_fields[draftId];
        });

        // Use the content script to fill using the AI mapping
        const result = await broadcastFillCommand('BROADCAST_FILL_MAPPING', {
            mapping,
            values: state.draft.form_fields
        });

        log(`AI Smart Fill complete! Filled ${result.filledCount} fields.\nArmed reactive watcher for conditional fields.`);
        
        if (state.tab?.id) {
            chrome.tabs.sendMessage(state.tab.id, {
                type: 'BROADCAST_START_WATCHER',
                payload: {
                    userId,
                    opportunityId,
                    baseUrl: getBaseUrl()
                }
            });
        }
    } catch (err) {
        log(`AI Smart Fill failed: ${err.message}`);
    } finally {
        release();
    }
}

el.baseUrl.addEventListener('change', rememberContext);
el.userId.addEventListener('change', rememberContext);
el.opportunityId.addEventListener('change', rememberContext);

el.diagnoseBtn.addEventListener('click', diagnosePage);
el.captureBtn.addEventListener('click', captureForm);
el.generateBtn.addEventListener('click', generateAnswers);
el.fillBtn.addEventListener('click', fillPortal);

loadTabContext().catch(err => {
    log(`Initialization failed: ${err.message}`);
});
