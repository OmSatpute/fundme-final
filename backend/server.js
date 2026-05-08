require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const logger = require('./utils/logger');
const { scrapeStartupGrants, scrapeDetails, scrapeApplyLink, scrapeOpportunityDetailData, scrapeGemBids } = require('./services/scraper');
const { cleanWithAI, formatDetailedContent } = require('./services/aiCleaner');
const { callOpenRouter, callLLM, callLLMForDraft } = require('./utils/ai');
const { extractTextFromPDF } = require('./utils/pdf');
const { extractJSON } = require('./utils/jsonSanitizer');
const {
  normalizeSchema,
  flattenSchema,
  buildInitialFormFields,
  calculateCompletion,
  inferSchemaFromOpportunity
} = require('./utils/formDrafts');
const supabase = require('./config/supabase');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Verify AI keys on startup
const { getGroqKey, getOpenRouterKey } = require('./utils/ai');
const groqKey = getGroqKey();
const orKey = getOpenRouterKey();
if (!groqKey && !orKey) {
  console.warn('⚠️  WARNING: No AI API keys found in key.txt. AI features will be disabled.');
} else {
  console.log(`✅ AI System: ${groqKey ? 'Groq ' : ''}${orKey ? 'OpenRouter ' : ''}keys detected.`);
}

// Middleware
app.use(cors());

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log request start
  logger.debug(`Request started: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user_agent: req.get('User-Agent')
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const responseTime = Date.now() - startTime;
    const userId = req.user_id || (req.body && req.body.user_id) || 'anonymous';

    logger.apiRequest(
      req.method,
      req.path,
      userId,
      res.statusCode,
      responseTime,
      null // Removed new Error() creation to avoid log noise from normal HTTP errors
    );

    originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Fix for common frontend misconfiguration prepending /undefined
app.use((req, res, next) => {
  if (req.path.startsWith('/undefined/')) {
    const newPath = req.url.replace('/undefined/', '/');
    logger.info(`Correcting /undefined path: ${req.url} -> ${newPath}`);
    req.url = newPath;
  }
  next();
});


// Health check for Railway/Render
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));


// ─── CLOUDINARY STORAGE ───────────────────────────────────────────────────────
const { storage: cloudinaryStorage, cloudinary } = require('./config/cloudinary');
const upload = multer({ storage: cloudinaryStorage });

// Separate multer for memory-only (AI generation)
const memoryUpload = multer({ storage: multer.memoryStorage() });

// ─── DB Helpers (Supabase Migration) ──────────────────────────────────────────
// Local JSON helpers removed. Queries now use the Supabase client.

function getHostMetadata(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const parts = parsed.hostname.split('.').filter(Boolean);
    const root_domain = parts.length >= 2 ? parts.slice(-2).join('.') : parsed.hostname;
    return {
      hostname: parsed.hostname,
      root_domain
    };
  } catch (err) {
    return {
      hostname: '',
      root_domain: ''
    };
  }
}

function getDefaultRequiredDocumentStatus(requiredDocuments = []) {
  return requiredDocuments.reduce((acc, doc) => {
    acc[doc] = 'missing';
    return acc;
  }, {});
}

async function upsertDraft({
  user_id,
  opportunity_id,
  schema,
  source_url = '',
  schema_source = 'manual',
  capture_meta = {}
}) {
  const normalizedSchema = normalizeSchema(schema);
  
  // Find existing draft
  const { data: existingDrafts, error: fetchError } = await supabase
    .from('drafts')
    .select('*')
    .eq('user_id', user_id)
    .eq('opportunity_id', opportunity_id);
    
  if (fetchError) throw fetchError;
  const existing = existingDrafts?.[0];

  const existingFields = existing ? existing.form_fields : {};
  const mergedFields = buildInitialFormFields(normalizedSchema, existingFields);
  const completion = calculateCompletion(normalizedSchema, mergedFields);
  const requiredDocumentsStatus = existing?.required_documents_status || getDefaultRequiredDocumentStatus(normalizedSchema.required_documents);

  const draftData = {
    title: normalizedSchema.title,
    subtitle: normalizedSchema.subtitle,
    form_schema: normalizedSchema,
    form_fields: mergedFields,
    completion,
    required_documents_status: requiredDocumentsStatus,
    schema_source,
    source_url,
    capture_meta,
    last_saved: new Date().toISOString()
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('drafts')
      .update(draftData)
      .eq('draft_id', existing.draft_id)
      .select();
    if (updateError) throw updateError;
    return updated[0];
  } else {
    const newDraft = {
      draft_id: 'd' + uuidv4().slice(0, 6),
      user_id,
      opportunity_id,
      created_at: new Date().toISOString(),
      status: 'draft',
      ...draftData
    };
    const { data: inserted, error: insertError } = await supabase
      .from('drafts')
      .insert(newDraft)
      .select();
    if (insertError) throw insertError;
    return inserted[0];
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Hash password securely
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = {
      user_id: 'u' + uuidv4().slice(0, 6),
      name,
      email,
      password: hashedPassword, // Secure hashed password
      role: role || 'founder',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff&size=32`,
      created_at: new Date().toISOString().slice(0, 10)
    };

    const { error: insertError } = await supabase.from('users').insert(user);
    if (insertError) throw insertError;

    const { password: _, ...safeUser } = user;
    res.status(201).json({ message: 'Account created', user: safeUser });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // For backward compatibility with existing plain text passwords
    let isValidPassword = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      // Hashed password - verify with bcrypt
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // Plain text password (existing users) - compare directly
      isValidPassword = password === user.password;
      // Optionally migrate to hashed password
      if (isValidPassword) {
        const saltRounds = 12;
        const newHashedPassword = await bcrypt.hash(password, saltRounds);
        await supabase.from('users').update({ password: newHashedPassword }).eq('user_id', user.user_id);
      }
    }

    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful', user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/users/check-email
app.get('/api/users/check-email', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query parameter is required' });

  const { data: user, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
    
  if (error) {
    console.error('Email check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.json({ exists: !!user });
});


// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────

// POST /api/upload
// POST /api/upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { user_id, doc_type, application_id } = req.body;

    // With Cloudinary, req.file.path is the full secure URL
    // req.file.filename is the public_id in Cloudinary
    const fileUrl = req.file.path;
    const publicId = req.file.filename;

    let documentRecord = {
      document_id: 'doc_' + uuidv4().slice(0, 8),
      filename: fileUrl, // Storing the full URL in the filename field for compatibility
      original_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_at: new Date().toISOString(),
      user_id,
      doc_type,
      application_id: application_id || null,
      uploaded_for: application_id ? 'application' : null,
      metadata: { public_id: publicId }
    };

    // 1. Save document record to Supabase
    const { error: docError } = await supabase.from('documents').insert(documentRecord);
    if (docError) throw docError;

    // 2. If it's a profile document, update founder profile
    if (user_id && doc_type && !application_id) {
      const { data: profile, error: profileFetchError } = await supabase
        .from('founder_profiles')
        .select('documents')
        .eq('user_id', user_id)
        .maybeSingle();

      if (profileFetchError) throw profileFetchError;
      if (profile) {
        const updatedDocs = { ...(profile.documents || {}), [doc_type]: fileUrl };
        await supabase
          .from('founder_profiles')
          .update({ documents: updatedDocs })
          .eq('user_id', user_id);
          
        logger.info('Document uploaded to Cloudinary profile', { user_id, doc_type, url: fileUrl });
      }
    }

    // 3. If it's an application document, update application
    if (application_id) {
      const { data: application, error: appFetchError } = await supabase
        .from('applications')
        .select('documents')
        .eq('application_id', application_id)
        .maybeSingle();

      if (appFetchError) throw appFetchError;
      if (application) {
        const updatedDocs = [...(application.documents || []), documentRecord];
        await supabase
          .from('applications')
          .update({ documents: updatedDocs })
          .eq('application_id', application_id);

        logger.info('Document uploaded to Cloudinary application', {
          user_id,
          application_id,
          doc_type,
          url: fileUrl
        });
      }
    }

    res.json({
      message: 'File uploaded to Cloudinary successfully',
      document: documentRecord,
      path: fileUrl
    });
  } catch (error) {
    logger.error('Cloudinary upload failed', error, { user_id: req.body.user_id });
    res.status(500).json({ error: 'File upload failed' });
  }
});

// GET /api/documents?user_id=&application_id=
// GET /api/documents?user_id=&application_id=
app.get('/api/documents', async (req, res) => {
  try {
    const { user_id, application_id } = req.query;

    if (!user_id && !application_id) {
      return res.status(400).json({ error: 'user_id or application_id is required' });
    }

    let query = supabase.from('documents').select('*');

    if (user_id) {
      query = query.eq('user_id', user_id).neq('uploaded_for', 'application');
    } else if (application_id) {
      query = query.eq('application_id', application_id);
    }

    const { data: documents, error } = await query;
    if (error) throw error;

    res.json(documents || []);
  } catch (error) {
    logger.error('Failed to fetch documents', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// DELETE /api/documents/:document_id
// DELETE /api/documents/:document_id
app.delete('/api/documents/:document_id', async (req, res) => {
  try {
    const { document_id } = req.params;

    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('document_id', document_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Remove file from Cloudinary if public_id exists
    const publicId = document.metadata?.public_id;
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
        logger.info('File deleted from Cloudinary', { publicId });
      } catch (err) {
        logger.error('Failed to delete file from Cloudinary', err, { publicId });
      }
    } else {
      // Fallback for legacy local files
      const filePath = path.join(UPLOADS_DIR, document.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove from database
    const { error: deleteError } = await supabase.from('documents').delete().eq('document_id', document_id);
    if (deleteError) throw deleteError;

    // Update profile references if applicable
    if (document.uploaded_for !== 'application') {
      const { data: profile, error: profileFetchError } = await supabase
        .from('founder_profiles')
        .select('documents')
        .eq('user_id', document.user_id)
        .maybeSingle();

      if (!profileFetchError && profile && profile.documents && profile.documents[document.doc_type] === document.filename) {
        const updatedDocs = { ...profile.documents };
        delete updatedDocs[document.doc_type];
        await supabase
          .from('founder_profiles')
          .update({ documents: updatedDocs })
          .eq('user_id', document.user_id);
      }
    }

    logger.info('Document deleted', { document_id, user_id: document.user_id });
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete document', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ─── FOUNDER PROFILE ─────────────────────────────────────────────────────────

// GET /api/founder/profile?user_id=
// GET /api/founder/profile?user_id=
app.get('/api/founder/profile', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: profile, error: profileError } = await supabase
    .from('founder_profiles')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  // Attach user's name from the users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('name, email')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!userError && user) {
    profile.founder_name = user.name;
    profile.email = user.email; // Account email fallback
  }

  res.json(profile);
});

// POST /api/founder/profile — create
// POST /api/founder/profile — create
app.post('/api/founder/profile', async (req, res) => {
  const { user_id, ...fields } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: existing, error: fetchError } = await supabase
    .from('founder_profiles')
    .select('founder_id')
    .eq('user_id', user_id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return res.status(409).json({ error: 'Profile already exists. Use PUT to update.' });

  const profile = {
    founder_id: 'f' + uuidv4().slice(0, 6),
    user_id,
    startup_name: fields.startup_name || '',
    sector: fields.sector || '',
    stage: fields.stage || '',
    startup_overview: fields.startup_overview || '',
    website: fields.website || '',
    application_email: fields.application_email || '',
    problem_statement: fields.problem_statement || '',
    solution_summary: fields.solution_summary || '',
    target_customers: fields.target_customers || '',
    business_model: fields.business_model || '',
    team_size: fields.team_size || 0,
    founded: fields.founded || fields.founded_year || '',
    incorporation: fields.incorporation || '',
    dpiit: fields.dpiit || '',
    location: fields.location || '',
    revenue: fields.revenue || '',
    traction_summary: fields.traction_summary || '',
    documents: { pitch_deck: null, financial_projections: null, letters_of_support: null, budget_breakdown: null },
    profile_completion: { score: 0, missing_fields: [] }
  };

  const { error: insertError } = await supabase.from('founder_profiles').insert(profile);
  if (insertError) throw insertError;

  res.status(201).json(profile);
});

// PUT /api/founder/profile — update
// PUT /api/founder/profile — update
app.put('/api/founder/profile', async (req, res) => {
  const { user_id, ...fields } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { error } = await supabase
    .from('founder_profiles')
    .update(fields)
    .eq('user_id', user_id);

  if (error) {
    logger.error('Profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }

  // Fetch and return the updated profile
  const { data: profile } = await supabase
    .from('founder_profiles')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  res.json(profile);
});

// ─── OPPORTUNITIES ────────────────────────────────────────────────────────────

let _gemBidsCache = { fetchedAt: 0, items: [] };

async function mergeGemBidsIntoSupabase(items) {
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const item of items) {
    const { data: existing, error: fetchError } = await supabase
      .from('opportunities')
      .select('opportunity_id, saved, match_score, first_seen_at, scraped_at')
      .or(`opportunity_id.eq.${item.opportunity_id},slug.eq.${item.slug}`)
      .maybeSingle();

    if (fetchError) {
      logger.error('Error fetching opportunity during GeM merge', fetchError);
      continue;
    }

    if (existing) {
      const updateData = {
        ...item,
        saved: existing.saved,
        match_score: existing.match_score || item.match_score || 0,
        first_seen_at: existing.first_seen_at || existing.scraped_at || now,
        last_seen_at: now,
        scraped_at: existing.scraped_at || now,
      };
      await supabase.from('opportunities').update(updateData).eq('opportunity_id', existing.opportunity_id);
      updated++;
    } else {
      const newData = {
        ...item,
        scraped_at: now,
        first_seen_at: now,
        last_seen_at: now,
      };
      await supabase.from('opportunities').insert(newData);
      added++;
    }
  }

  return { added, updated };
}

async function getStoredBusinessOpportunities() {
  const businessTypes = ['Contest', 'Fellowship', 'Other', 'Tender', 'Reverse Auction'];
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .or(`type.in.(${businessTypes.join(',')}),source.eq.gem`);
    
  if (error) throw error;
  return data || [];
}

// GET /api/business-opportunities - live GeM bids with stored fallback
app.get('/api/business-opportunities', async (req, res) => {
  const refresh = req.query.refresh === '1';
  const cacheMs = 15 * 60 * 1000;
  const cacheFresh = !refresh && _gemBidsCache.items.length > 0 && Date.now() - _gemBidsCache.fetchedAt < cacheMs;

  try {
    let gemItems = _gemBidsCache.items;
    if (!cacheFresh) {
      gemItems = await scrapeGemBids({ pages: 2, limit: 20 });
      _gemBidsCache = { fetchedAt: Date.now(), items: gemItems };
    }

    const mergeResult = await mergeGemBidsIntoSupabase(gemItems);
    await cleanExpiredOpportunities();

    res.json({
      source: 'gem',
      refreshed_at: new Date(_gemBidsCache.fetchedAt).toISOString(),
      ...mergeResult,
      opportunities: await getStoredBusinessOpportunities(),
    });
  } catch (err) {
    console.warn(`GeM business-opportunities refresh failed: ${err.message}`);
    try {
      res.json({
        source: 'stored',
        error: err.message,
        opportunities: await getStoredBusinessOpportunities(),
      });
    } catch (dbErr) {
      res.status(500).json({ error: 'Failed to fetch stored opportunities' });
    }
  }
});

// GET /api/opportunities?type=
app.get('/api/opportunities', async (req, res) => {
  const { type } = req.query;
  await cleanExpiredOpportunities();

  let query = supabase.from('opportunities').select('*');
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to fetch opportunities', error);
    return res.status(500).json({ error: 'Failed to fetch opportunities' });
  }

  res.json(data || []);
});

// GET /api/opportunities/:id/details
app.get('/api/opportunities/:id/details', async (req, res) => {
  const id = req.params.id;
  const { data: opp, error: fetchError } = await supabase
    .from('opportunities')
    .select('*')
    .or(`opportunity_id.eq.${id},slug.eq.${id}`)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

  // Return cached formatted data if it exists
  if (opp.formatted_details) {
    if (!opp.external_apply_url && opp.link) {
      opp.external_apply_url = await scrapeApplyLink(opp.link);
      await supabase.from('opportunities').update({ external_apply_url: opp.external_apply_url }).eq('opportunity_id', opp.opportunity_id);
    }
    return res.json({ formatted: opp.formatted_details, raw: opp.raw_scraped_text || '--', external_apply_url: opp.external_apply_url || '' });
  }

  if (!opp.link) return res.status(400).json({ error: 'No link available to scrape' });

  try {
    const raw = await scrapeDetails(opp.link);
    // Cache the raw text for future formatting
    const updateData = { raw_scraped_text: raw };
    if (!opp.external_apply_url) {
      updateData.external_apply_url = await scrapeApplyLink(opp.link);
    }
    await supabase.from('opportunities').update(updateData).eq('opportunity_id', opp.opportunity_id);
    res.json({ raw, external_apply_url: updateData.external_apply_url || opp.external_apply_url || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to scrape details: ' + err.message });
  }
});

// POST /api/ai/format-details
// Manually triggers the AI formatter for raw text and CACHES it
app.post('/api/ai/format-details', async (req, res) => {
  const { opportunity_id, raw_text } = req.body;
  console.log(`AI System: Formatting details for opportunity: ${opportunity_id}`);

  if (!raw_text || raw_text.trim().length < 10) {
    console.warn('AI System: Empty raw text received for formatting');
    return res.status(400).json({ error: 'raw_text is required and must be substantial' });
  }

  try {
    // Add protective throttle for free tier
    await new Promise(r => setTimeout(r, 2000));

    console.log('✨ AI System: Calling formatDetailedContent...');
    const formatted = await formatDetailedContent(raw_text);
    console.log('✅ AI System: Formatting complete.');

    // If ID provided, cache the result
    if (opportunity_id) {
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({ formatted_details: formatted })
        .eq('opportunity_id', opportunity_id);
        
      if (updateError) {
        console.error(`AI System: Failed to cache formatted details for ${opportunity_id}:`, updateError);
      } else {
        console.log(`💾 AI System: Cached formatted details for ${opportunity_id}`);
      }
    }

    res.json({ result: formatted });
  } catch (err) {
    console.error('❌ AI System: Error formatting details:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/opportunities/:id
app.get('/api/opportunities/:id', async (req, res) => {
  await cleanExpiredOpportunities();

  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .or(`opportunity_id.eq.${req.params.id},slug.eq.${req.params.id}`)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch opportunity', error);
    return res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
  
  if (!data) return res.status(404).json({ error: 'Opportunity not found' });
  res.json(data);
});

// ─── SCRAPING BACKGROUND WORKER (PRODUCTION) ─────────────────────────────────

const { cleanListingItem } = require('./services/aiCleaner');

let _scraperStatus = { running: false, lastRun: null, lastResult: null };

function parseDeadlineDate(deadline) {
  if (!deadline || typeof deadline !== 'string') return null;
  const normalized = deadline.trim();
  
  // Explicitly handle "Closed" or "Expired"
  if (/^(closed|expired|applications closed)$/i.test(normalized)) {
    return new Date(0); // Jan 1, 1970 - definitely expired
  }

  if (!normalized || /^(rolling|variable|not specified|timeline based|as per challenge timeline)$/i.test(normalized)) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(23, 59, 59, 999);
  return parsed;
}

function isDeadlineExpired(deadline, now = new Date()) {
  const deadlineDate = parseDeadlineDate(deadline);
  return Boolean(deadlineDate && deadlineDate < now);
}

function isRollingDeadline(deadline) {
  const normalized = String(deadline || '').trim();
  if (/^(closed|expired|applications closed)$/i.test(normalized)) return false;
  return !normalized || /^(rolling|variable|not specified|timeline based|as per challenge timeline)$/i.test(normalized);
}

async function cleanExpiredOpportunities(now = new Date()) {
  try {
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select('opportunity_id, deadline');

    if (error) throw error;

    const removedIds = [];
    for (const o of (opportunities || [])) {
      if (isDeadlineExpired(o.deadline, now)) {
        removedIds.push(o.opportunity_id);
      }
    }

    if (removedIds.length > 0) {
      logger.info(`Cleaning up ${removedIds.length} expired opportunities`);
      const { error: deleteError } = await supabase
        .from('opportunities')
        .delete()
        .in('opportunity_id', removedIds);
      if (deleteError) throw deleteError;
    }

    return { removed: removedIds.length, removedIds };
  } catch (err) {
    logger.error('Failed to cleanup expired opportunities', err);
    return { removed: 0, removedIds: [] };
  }
}

async function revalidateRollingOpportunities(limit = 12) {
  const now = new Date();
  const staleAfterMs = 24 * 60 * 60 * 1000;

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*');

  if (error) throw error;

  const candidates = (opportunities || [])
    .filter(o => o.link && isRollingDeadline(o.deadline))
    .filter(o => !o.rolling_verified_at || now - new Date(o.rolling_verified_at) > staleAfterMs)
    .slice(0, limit);

  if (candidates.length === 0) return { checked: 0, removed: 0, updated: 0 };

  let checked = 0;
  let updated = 0;
  const removeIds = [];

  for (const opp of candidates) {
    checked++;
    const details = await scrapeOpportunityDetailData(opp.link);
    const latestDeadline = details?.deadline;
    
    const updateData = { rolling_verified_at: now.toISOString() };

    if (latestDeadline && !isRollingDeadline(latestDeadline)) {
      updateData.deadline = latestDeadline;
      updated++;
      if (isDeadlineExpired(latestDeadline, now)) {
        removeIds.push(opp.opportunity_id);
      }
    }

    if (details?.raw_scraped_text) updateData.raw_scraped_text = details.raw_scraped_text;
    if (details?.external_apply_url && isValidExternalApplyUrl(details.external_apply_url)) {
      updateData.external_apply_url = details.external_apply_url;
    }
    
    await supabase.from('opportunities').update(updateData).eq('opportunity_id', opp.opportunity_id);
  }

  if (removeIds.length > 0) {
    await supabase.from('opportunities').delete().in('opportunity_id', removeIds);
  }

  await cleanExpiredOpportunities(now);
  return { checked, updated, removed: removeIds.length };
}

function calculateLocalMatchScore(profile = {}, opportunity = {}) {
  const profileSector = (profile.sector || profile.industry || '').toLowerCase();
  const profileStage = (profile.stage || '').toLowerCase();
  const profileText = `${profile.startup_overview || ''} ${profile.description || ''} ${profile.problem_statement || ''} ${profile.solution_summary || ''}`.toLowerCase();
  const oppSector = (opportunity.sector || '').toLowerCase();
  const oppStage = (opportunity.stage || '').toLowerCase();
  const oppText = `${opportunity.title || ''} ${opportunity.description || ''}`.toLowerCase();

  let score = 25;
  if (!oppSector || /all sectors|sector agnostic|technology/i.test(opportunity.sector || '')) score += 30;
  else if (profileSector && (oppSector.includes(profileSector) || profileSector.includes(oppSector))) score += 40;
  else if (profileSector && oppText.includes(profileSector)) score += 25;

  if (!oppStage || /idea|mvp|early|growth|scaling/i.test(oppStage)) score += 15;
  if (profileStage && (oppStage.includes(profileStage) || profileStage.includes(oppStage))) score += 20;

  const profileKeywords = profileText.split(/\W+/).filter(word => word.length > 4);
  const overlap = profileKeywords.filter(word => oppText.includes(word)).slice(0, 4).length;
  score += overlap * 5;

  return Math.max(35, Math.min(95, Math.round(score)));
}

function isValidExternalApplyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');
    if (host.includes('startupgrantsindia.com')) return false;
    if (host.includes('googletagmanager.com') || host.includes('google-analytics.com')) return false;
    if (host.includes('google.com') && url.pathname.includes('/ns.html')) return false;
    if (rawUrl.includes('/cdn-cgi/')) return false;
    return true;
  } catch {
    return false;
  }
}

async function enrichApplyLinks(items) {
  const { data: opportunities } = await supabase.from('opportunities').select('slug, external_apply_url');
  const existingBySlug = new Map();
  opportunities?.forEach(o => {
    if (o.slug) existingBySlug.set(o.slug, o);
  });

  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      const existing = item.slug ? existingBySlug.get(item.slug) : null;
      if (isValidExternalApplyUrl(existing?.external_apply_url)) {
        item.external_apply_url = existing.external_apply_url;
        continue;
      }

      if (!item.link) continue;
      const applyUrl = await scrapeApplyLink(item.link);
      if (applyUrl) item.external_apply_url = applyUrl;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return items;
}

async function enrichDetailData(items) {
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (!item.link) continue;

      const details = await scrapeOpportunityDetailData(item.link);
      if (!details || Object.keys(details).length === 0) continue;

      item.title = details.title || item.title;
      item.provider = details.provider || item.provider;
      item.description = details.description || item.description;
      item.eligibility = details.eligibility || item.eligibility;
      item.benefits = details.benefits || item.benefits;
      item.timeline = details.timeline || item.timeline;
      item.about = details.about || item.about;
      item.type = details.type || item.type;
      item.amount = details.amount || item.amount;
      item.deadline = details.deadline || item.deadline;
      item.location = details.location || item.location;
      item.external_apply_url = details.external_apply_url || item.external_apply_url;
      item.raw_scraped_text = details.raw_scraped_text || item.raw_scraped_text;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return items;
}

async function selectScrapedOpportunities(items, limit = 10) {
  if (items.length <= limit) return items;

  const { data: profiles } = await supabase.from('founder_profiles').select('*').limit(1);
  const profile = profiles?.[0] || {};
  const profileSector = (profile.sector || '').toLowerCase();
  const profileStage = (profile.stage || '').toLowerCase();

  const scored = items.map(item => {
    let score = Math.random();
    const sector = (item.sector || '').toLowerCase();
    const stage = (item.stage || '').toLowerCase();
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();

    if (sector && (sector === 'all sectors' || sector === 'sector agnostic')) score += 4;
    if (profileSector && (sector.includes(profileSector) || profileSector.includes(sector) || text.includes(profileSector))) score += 6;
    if (profileStage && (stage.includes(profileStage) || profileStage.includes(stage))) score += 3;

    return { item, score };
  });

  const profileMatches = scored
    .filter(entry => entry.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.ceil(limit * 0.6))
    .map(entry => entry.item);

  const selectedIds = new Set(profileMatches.map(item => item.slug || item.link || item.title));
  const randomRest = scored
    .filter(entry => !selectedIds.has(entry.item.slug || entry.item.link || entry.item.title))
    .sort(() => Math.random() - 0.5)
    .slice(0, limit - profileMatches.length)
    .map(entry => entry.item);

  return [...profileMatches, ...randomRest].slice(0, limit);
}

async function saveScrapedToSupabase(newData) {
  const now = new Date();
  const activeNewData = newData.filter(item => !isDeadlineExpired(item.deadline, now));

  // 1. Clean expired scraped entries in Supabase logic is handled by cleanExpiredOpportunities call before save
  
  // 2. Fetch existing slugs/links to decide update vs insert
  const { data: existingOpps } = await supabase.from('opportunities').select('opportunity_id, slug, link, external_apply_url, saved');
  const existingSlugs = new Map();
  existingOpps?.forEach(o => {
    if (o.slug) existingSlugs.set(o.slug, o);
    if (o.link) existingSlugs.set(o.link, o);
  });

  let addedCount = 0;
  let updatedCount = 0;
  let newlyAddedOpps = [];

  for (const item of activeNewData) {
    const existing = existingSlugs.get(item.slug) || existingSlugs.get(item.link);

    if (existing) {
      // Refresh metadata on existing entry
      const updateData = {
        title: item.title || existing.title,
        description: item.description || existing.description,
        provider: item.provider || existing.provider,
        type: item.type || existing.type,
        stage: item.stage || existing.stage,
        sector: item.sector || existing.sector,
        location: item.location || existing.location,
        eligibility: item.eligibility || existing.eligibility,
        benefits: item.benefits || existing.benefits,
        timeline: item.timeline || existing.timeline,
        about: item.about || existing.about,
        raw_scraped_text: item.raw_scraped_text || existing.raw_scraped_text,
        external_apply_url: isValidExternalApplyUrl(item.external_apply_url)
          ? item.external_apply_url
          : (isValidExternalApplyUrl(existing.external_apply_url) ? existing.external_apply_url : ''),
        last_seen_at: now.toISOString(),
      };
      if (item.amount && item.amount !== 'Variable') updateData.amount = item.amount;
      if (item.deadline && item.deadline !== 'Rolling') updateData.deadline = item.deadline;
      
      await supabase.from('opportunities').update(updateData).eq('opportunity_id', existing.opportunity_id);
      updatedCount++;
    } else {
      // Insert new opportunity
      const opp = {
        opportunity_id: 'opp_' + uuidv4().slice(0, 6),
        title: item.title,
        provider: item.provider || 'Startup Grants India',
        description: item.description || item.title,
        eligibility: item.eligibility || 'See opportunity page for detailed eligibility criteria.',
        benefits: item.benefits || '',
        timeline: item.timeline || '',
        about: item.about || '',
        type: item.type || 'Grant',
        amount: item.amount || 'Variable',
        deadline: item.deadline || 'Rolling',
        location: item.location || 'India',
        sector: item.sector || 'All Sectors',
        stage: item.stage || '',
        link: item.link,
        external_apply_url: isValidExternalApplyUrl(item.external_apply_url) ? item.external_apply_url : '',
        slug: item.slug || '',
        raw_scraped_text: item.raw_scraped_text || '',
        credibility_source: 'Verified via StartupGrantsIndia.com',
        match_score: 0,
        scraped_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      };
      await supabase.from('opportunities').insert(opp);
      newlyAddedOpps.push(opp);
      addedCount++;
    }
  }

  // 3. Auto-score new opportunities for all founder profiles
  if (newlyAddedOpps.length > 0) {
    const { data: profiles } = await supabase.from('founder_profiles').select('*');
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        fetch(`http://localhost:${PORT}/api/ai/match-opportunities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile, opportunities: newlyAddedOpps })
        }).catch(err => console.error('Background LLM scoring failed:', err.message));
      });
    }
  }

  const { count } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  return { added: addedCount, updated: updatedCount, total: count || 0 };
}

async function runScraper() {
  if (_scraperStatus.running) {
    console.warn('⚠️  Scraper is already running. Skipping.');
    return _scraperStatus;
  }

  _scraperStatus.running = true;
  const startTime = Date.now();
  console.log('\n🚀 ═══════════════════════════════════════════════════════════');
  console.log('   PRODUCTION SCRAPER — StartupGrantsIndia.com');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Phase 1: Scrape listings (multi-page, no AI needed)
    const rawItems = await scrapeStartupGrants();
    console.log(`\n📦 Scraped ${rawItems.length} total listings from site.`);

    // Phase 2: Clean and enrich (local inference, no API calls)
    const cleaned = rawItems
      .filter(item => item.title && item.title.length >= 5)
      .map(item => cleanListingItem(item));

    console.log(`🧹 Cleaned ${cleaned.length} valid opportunities.`);

    const candidatePool = await selectScrapedOpportunities(cleaned, 50);
    console.log(`Selected ${candidatePool.length} candidates for detail enrichment before final 10 active opportunities.`);

    // Phase 2.5: Capture full detail-page data and the real external Apply Now URL.
    const enrichedDetails = await enrichDetailData(candidatePool);
    const activeDetailed = enrichedDetails.filter(item => !isDeadlineExpired(item.deadline));
    const selected = await selectScrapedOpportunities(activeDetailed, 10);
    console.log(`Detail-enriched ${enrichedDetails.length} candidates (${activeDetailed.length} active, ${selected.length} selected for refresh).`);

    // Phase 3: Merge into database
    const result = await saveScrapedToSupabase(selected);
    const rollingCheck = await revalidateRollingOpportunities(50);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   Rolling recheck: ${rollingCheck.checked} checked, ${rollingCheck.updated} updated, ${rollingCheck.removed} removed`);
    console.log(`\n✅ Scraper complete in ${elapsed}s`);
    console.log(`   📊 Added: ${result.added} | Updated: ${result.updated} | Total in DB: ${result.total}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    _scraperStatus = {
      running: false,
      lastRun: new Date().toISOString(),
      lastResult: { ...result, rolling_recheck: rollingCheck, elapsed_seconds: parseFloat(elapsed), raw_scraped: rawItems.length },
    };

    return _scraperStatus;
  } catch (err) {
    console.error('❌ Scraper worker error:', err);
    _scraperStatus.running = false;
    _scraperStatus.lastResult = { error: err.message };
    return _scraperStatus;
  }
}

// Trigger scraper manually — returns detailed stats
app.get('/api/trigger-scraper', async (req, res) => {
  console.log('🔧 Manual scraper trigger via API…');
  const status = await runScraper();
  res.json({
    message: 'Scraping complete',
    ...status,
  });
});

// Get scraper status without triggering
app.get('/api/scraper-status', async (req, res) => {
  const { count } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  res.json({
    ..._scraperStatus,
    opportunities_in_db: count || 0,
  });
});

// Cron: every week (Sunday at midnight)
cron.schedule('0 0 * * 0', async () => {
  console.log('⏰ Auto scraping started by Cron…');
  await runScraper();
});


// ─── SAVED OPPORTUNITIES ──────────────────────────────────────────────────────

// GET /api/saved?user_id=
// GET /api/saved?user_id=
app.get('/api/saved', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: saved, error } = await supabase
    .from('saved_opportunities')
    .select('*, opportunity:opportunities(*)')
    .eq('user_id', user_id);

  if (error) {
    logger.error('Failed to fetch saved opportunities', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.json(saved || []);
});

// POST /api/saved
// POST /api/saved
app.post('/api/saved', async (req, res) => {
  const { user_id, opportunity_id } = req.body;
  if (!user_id || !opportunity_id) return res.status(400).json({ error: 'user_id and opportunity_id are required' });

  const { data: existing } = await supabase
    .from('saved_opportunities')
    .select('saved_id')
    .eq('user_id', user_id)
    .eq('opportunity_id', opportunity_id)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'Already saved' });

  const saved = {
    saved_id: 's' + uuidv4().slice(0, 6),
    user_id,
    opportunity_id,
    saved_date: new Date().toISOString().slice(0, 10)
  };

  const { error } = await supabase.from('saved_opportunities').insert(saved);
  if (error) throw error;

  res.status(201).json(saved);
});

// DELETE /api/saved (by query params)
// DELETE /api/saved (by query params)
app.delete('/api/saved', async (req, res) => {
  const { user_id, opportunity_id } = req.query;
  if (!user_id || !opportunity_id) return res.status(400).json({ error: 'user_id and opportunity_id are required' });

  const { error } = await supabase
    .from('saved_opportunities')
    .delete()
    .eq('user_id', user_id)
    .eq('opportunity_id', opportunity_id);

  if (error) throw error;
  res.json({ message: 'Opportunity unsaved' });
});

// DELETE /api/saved/:id
// DELETE /api/saved/:id
app.delete('/api/saved/:id', async (req, res) => {
  const { error } = await supabase.from('saved_opportunities').delete().eq('saved_id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Removed from saved' });
});

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

// GET /api/applications?user_id=
// GET /api/applications?user_id=
app.get('/api/applications', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: apps, error } = await supabase
    .from('applications')
    .select('*, opportunity:opportunities(*)')
    .eq('user_id', user_id);

  if (error) {
    logger.error('Failed to fetch applications', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.json(apps || []);
});





// GET /api/applications/:id
// GET /api/applications/:id
app.get('/api/applications/:id', async (req, res) => {
  const { data: app_, error } = await supabase
    .from('applications')
    .select('*, opportunity:opportunities(*)')
    .eq('application_id', req.params.id)
    .maybeSingle();

  if (error) throw error;
  if (!app_) return res.status(404).json({ error: 'Application not found' });

  res.json(app_);
});

// POST /api/applications — create new application
// POST /api/applications — create new application
app.post('/api/applications', async (req, res) => {
  const { user_id, opportunity_id } = req.body;
  if (!user_id || !opportunity_id) return res.status(400).json({ error: 'user_id and opportunity_id are required' });

  const { data: existing } = await supabase
    .from('applications')
    .select('application_id')
    .eq('user_id', user_id)
    .eq('opportunity_id', opportunity_id)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'Application already exists for this opportunity' });

  const appliedDate = todayIsoDate();
  const stage_details = normalizeStageDetails({
    Applied: {
      date: appliedDate,
      note: req.body.initial_note || 'Application tracked in FundMe'
    }
  });

  const application = {
    application_id: 'a' + uuidv4().slice(0, 6),
    user_id,
    opportunity_id,
    status: 'Applied',
    timeline: buildTimelineFromStageDetails(stage_details),
    stage_details,
    next_step: null,
    feedback: null,
    ai_insights: [],
    submitted_at: appliedDate,
    deadline: req.body.deadline || null,
    follow_up_date: req.body.follow_up_date || null,
    priority: req.body.priority || 'Medium',
    owner: req.body.owner || '',
    portal_status: req.body.portal_status || '',
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('applications').insert(application);
  if (error) throw error;

  res.status(201).json(application);
});

// PUT /api/applications/:id — update status / next step / feedback
// PUT /api/applications/:id — update status / next step / feedback
app.put('/api/applications/:id', async (req, res) => {
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select('*')
    .eq('application_id', req.params.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const { status, next_step, feedback, timeline, stage_details, follow_up_date, priority, owner, portal_status } = req.body;
  const currentStatus = status || application.status;
  let nextStageDetails = normalizeStageDetails(application.stage_details, application.timeline);

  if (Array.isArray(timeline)) {
    nextStageDetails = normalizeStageDetails(nextStageDetails, timeline);
  }

  if (stage_details && typeof stage_details === 'object') {
    nextStageDetails = normalizeStageDetails({ ...nextStageDetails, ...stage_details }, timeline || application.timeline);
  }

  if (currentStatus && nextStageDetails[currentStatus]) {
    if (!nextStageDetails[currentStatus].date) {
      nextStageDetails[currentStatus].date = todayIsoDate();
    }
    if (!nextStageDetails[currentStatus].note && next_step) {
      nextStageDetails[currentStatus].note = next_step;
    }
  }

  const updateData = {};

  if (status && status !== application.status) {
    updateData.status = status;
    updateData.next_step = getNextStep(status);
  }
  if (next_step !== undefined) updateData.next_step = next_step;
  if (feedback !== undefined) updateData.feedback = feedback;
  if (follow_up_date !== undefined) updateData.follow_up_date = follow_up_date || null;
  if (priority !== undefined) updateData.priority = priority || 'Medium';
  if (owner !== undefined) updateData.owner = owner || '';
  if (portal_status !== undefined) updateData.portal_status = portal_status || '';
  updateData.stage_details = nextStageDetails;
  updateData.timeline = buildTimelineFromStageDetails(nextStageDetails);
  updateData.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('applications')
    .update(updateData)
    .eq('application_id', req.params.id)
    .select()
    .single();

  if (updateError) throw updateError;
  res.json(updated);
});

// GET /api/applications/deadline-reminders?user_id=
// GET /api/applications/deadline-reminders?user_id=
app.get('/api/applications/deadline-reminders', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: applications, error } = await supabase
    .from('applications')
    .select('*, opportunity:opportunities(*)')
    .eq('user_id', user_id);

  if (error) throw error;
  const reminders = [];

  applications.forEach(app => {
    const opportunity = app.opportunity;
    if (!opportunity || !opportunity.deadline || opportunity.deadline === 'Rolling') return;

    const deadlineDate = new Date(opportunity.deadline);
    if (isNaN(deadlineDate)) return;

    const today = new Date();
    const daysUntilDeadline = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDeadline <= 7 && daysUntilDeadline >= 0) {
      reminders.push({
        application_id: app.application_id,
        opportunity_title: opportunity.title,
        deadline: opportunity.deadline,
        days_until_deadline: daysUntilDeadline,
        urgency: daysUntilDeadline <= 3 ? 'high' : daysUntilDeadline <= 5 ? 'medium' : 'low',
        status: app.status
      });
    }
  });

  reminders.sort((a, b) => a.days_until_deadline - b.days_until_deadline);
  res.json(reminders);
});

// GET /api/applications/analytics?user_id=
// GET /api/applications/analytics?user_id=
app.get('/api/applications/analytics', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: applications, error } = await supabase
    .from('applications')
    .select('status, submitted_at')
    .eq('user_id', user_id);

  if (error) throw error;

  const analytics = {
    total_applications: applications.length,
    status_breakdown: {},
    monthly_submissions: {},
    success_rate: 0,
    average_response_time: 0
  };

  applications.forEach(app => {
    // Status breakdown
    analytics.status_breakdown[app.status] = (analytics.status_breakdown[app.status] || 0) + 1;

    // Monthly submissions
    const month = app.submitted_at?.slice(0, 7) || 'unknown';
    analytics.monthly_submissions[month] = (analytics.monthly_submissions[month] || 0) + 1;
  });

  // Calculate success rate
  const successful = (analytics.status_breakdown['Accepted'] || 0) + (analytics.status_breakdown['Shortlisted'] || 0);
  analytics.success_rate = applications.length > 0 ? Math.round((successful / applications.length) * 100) : 0;

  res.json(analytics);
});

// Helper function for status progression
function getNextStep(currentStatus) {
  const statusFlow = {
    'Applied': 'Wait for confirmation email',
    'Under Review': 'Prepare for potential interview',
    'Shortlisted': 'Schedule interview/pitch preparation',
    'Interview / Pitch Round': 'Follow up within 1 week',
    'Accepted': 'Complete onboarding requirements',
    'Rejected': 'Review feedback and improve next application',
    'Waitlisted': 'Stay warm with the program team and share new traction',
    'Withdrawn': 'Archive notes and redirect effort to stronger opportunities'
  };

  return statusFlow[currentStatus] || 'Check application portal for updates';
}

const APPLICATION_STAGES = ['Applied', 'Under Review', 'Shortlisted', 'Interview / Pitch Round', 'Accepted', 'Rejected', 'Waitlisted', 'Withdrawn'];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStageDetails(input = {}, fallbackTimeline = []) {
  const details = {};

  APPLICATION_STAGES.forEach((stage) => {
    const existing = input?.[stage];
    details[stage] = {
      date: existing?.date || '',
      note: existing?.note || ''
    };
  });

  (fallbackTimeline || []).forEach((item) => {
    const stage = item?.stage || item?.status;
    if (!stage || !details[stage]) return;
    if (item?.date) details[stage].date = item.date;
    if (item?.note || item?.description) details[stage].note = item.note || item.description;
  });

  return details;
}

function buildTimelineFromStageDetails(stageDetails = {}) {
  return APPLICATION_STAGES
    .filter((stage) => {
      const entry = stageDetails?.[stage];
      return entry && (entry.date || entry.note);
    })
    .map((stage) => ({
      stage,
      date: stageDetails[stage].date || '',
      note: stageDetails[stage].note || ''
    }));
}

// ─── DRAFTS ───────────────────────────────────────────────────────────────────

// GET /api/drafts?user_id= — all drafts for user
// GET /api/drafts?user_id= — all drafts for user
app.get('/api/drafts', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: drafts, error } = await supabase
    .from('drafts')
    .select('*, opportunity:opportunities(*)')
    .eq('user_id', user_id);

  if (error) throw error;
  res.json(drafts || []);
});

// GET /api/drafts/by-opportunity?user_id=&opportunity_id=
// GET /api/drafts/by-opportunity?user_id=&opportunity_id=
app.get('/api/drafts/by-opportunity', async (req, res) => {
  const { user_id, opportunity_id } = req.query;
  if (!user_id || !opportunity_id) {
    return res.status(400).json({ error: 'user_id and opportunity_id are required' });
  }

  const { data: draft, error } = await supabase
    .from('drafts')
    .select('*, opportunity:opportunities(*)')
    .eq('user_id', user_id)
    .eq('opportunity_id', opportunity_id)
    .maybeSingle();

  if (error) throw error;
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  res.json(draft);
});

// POST /api/drafts/bootstrap
// POST /api/drafts/bootstrap
app.post('/api/drafts/bootstrap', async (req, res) => {
  const {
    user_id,
    opportunity_id,
    source_url = '',
    form_schema,
    schema_source = 'manual',
    capture_meta = {}
  } = req.body || {};

  if (!user_id || !opportunity_id) {
    return res.status(400).json({ error: 'user_id and opportunity_id are required' });
  }

  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('*')
    .or(`opportunity_id.eq.${opportunity_id},slug.eq.${opportunity_id}`)
    .maybeSingle();

  if (oppError) throw oppError;
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

  const schemaToUse = form_schema || opportunity.generated_application_schema || inferSchemaFromOpportunity(opportunity);
  const draft = await upsertDraft({
    user_id,
    opportunity_id: opportunity.opportunity_id,
    schema: schemaToUse,
    source_url,
    schema_source,
    capture_meta
  });

  res.status(201).json({ ...draft, opportunity });
});

// GET /api/drafts/:id
// GET /api/drafts/:id
app.get('/api/drafts/:id', async (req, res) => {
  const { data: draft, error } = await supabase
    .from('drafts')
    .select('*, opportunity:opportunities(*)')
    .eq('draft_id', req.params.id)
    .maybeSingle();

  if (error) throw error;
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  res.json(draft);
});

// PUT /api/drafts/:id — update draft fields
// PUT /api/drafts/:id — update draft fields
app.put('/api/drafts/:id', async (req, res) => {
  const { data: draft, error: fetchError } = await supabase
    .from('drafts')
    .select('*')
    .eq('draft_id', req.params.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  const { form_fields, required_documents_status, form_schema, source_url, schema_source, capture_meta } = req.body;

  const updateData = {};

  if (form_schema) {
    updateData.form_schema = normalizeSchema(form_schema, draft.title || 'Smart Application Draft');
    updateData.form_fields = buildInitialFormFields(updateData.form_schema, { ...draft.form_fields, ...(form_fields || {}) });
  }

  if (form_fields) {
    updateData.form_fields = { ...(updateData.form_fields || draft.form_fields), ...form_fields };
  }

  if (required_documents_status) {
    updateData.required_documents_status = { ...(updateData.required_documents_status || draft.required_documents_status), ...required_documents_status };
  }

  if (source_url !== undefined) updateData.source_url = source_url;
  if (schema_source !== undefined) updateData.schema_source = schema_source;
  if (capture_meta !== undefined) updateData.capture_meta = capture_meta;

  updateData.completion = calculateCompletion(updateData.form_schema || draft.form_schema || {}, updateData.form_fields || draft.form_fields || {});
  updateData.last_saved = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('drafts')
    .update(updateData)
    .eq('draft_id', req.params.id)
    .select()
    .single();

  if (updateError) throw updateError;
  res.json(updated);
});

// POST /api/extension/session
// POST /api/extension/session
app.post('/api/extension/session', async (req, res) => {
  const { user_id, opportunity_id, external_url } = req.body || {};
  if (!user_id || !opportunity_id || !external_url) {
    return res.status(400).json({ error: 'user_id, opportunity_id and external_url are required' });
  }

  const hostMeta = getHostMetadata(external_url);
  const session = {
    session_id: 'x' + uuidv4().slice(0, 6),
    user_id,
    opportunity_id,
    external_url,
    hostname: hostMeta.hostname,
    root_domain: hostMeta.root_domain,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Clean old sessions for same url/user/opp
  await supabase
    .from('extension_sessions')
    .delete()
    .eq('user_id', user_id)
    .eq('opportunity_id', opportunity_id)
    .eq('external_url', external_url);

  const { error } = await supabase.from('extension_sessions').insert(session);
  if (error) throw error;

  res.status(201).json(session);
});

// GET /api/extension/session?external_url=
// GET /api/extension/session?external_url=
app.get('/api/extension/session', async (req, res) => {
  const { external_url, user_id, opportunity_id } = req.query;
  if (!external_url && !(user_id && opportunity_id)) {
    return res.status(400).json({ error: 'external_url or user_id + opportunity_id is required' });
  }

  let query = supabase.from('extension_sessions').select('*');

  if (user_id && opportunity_id) {
    query = query.eq('user_id', user_id).eq('opportunity_id', opportunity_id);
  }

  const { data: sessions, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;

  let matches = sessions || [];

  if (external_url) {
    const targetMeta = getHostMetadata(external_url);
    matches = matches.filter(item => {
      const sessionHostname = item.hostname || getHostMetadata(item.external_url).hostname;
      const sessionRootDomain = item.root_domain || getHostMetadata(item.external_url).root_domain;
      return sessionHostname === targetMeta.hostname || (sessionRootDomain && sessionRootDomain === targetMeta.root_domain);
    });
  }

  const match = matches[0];
  if (!match) return res.status(404).json({ error: 'No staged extension session found for this site' });
  res.json(match);
});

// ─── USER SETTINGS ────────────────────────────────────────────────────────────

// GET /api/user?user_id=
// GET /api/user?user_id=
app.get('/api/user', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) throw error;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// PUT /api/user — update user settings
// PUT /api/user — update user settings
app.put('/api/user', async (req, res) => {
  const { user_id, ...fields } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  // Allow updating profile fields and settings
  const allowed = ['name', 'email', 'password', 'avatar', 'designation', 'phone', 'notifications', 'billing_email', 'gstin'];
  const updateData = {};
  allowed.forEach(k => { if (fields[k] !== undefined) updateData[k] = fields[k]; });

  const { data: user, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('user_id', user_id)
    .select()
    .single();

  if (error) {
    logger.error('User update error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// ─── AI INTEGRATION (OPENROUTER) ──────────────────────────────────────────────

// POST /api/ai/generate-profile
// Auto-generate: name, sector, stage, description, problem, solution, customers, model
// Supports: startup_overview (text), website (url), and file (PDF upload)
app.post('/api/ai/generate-profile', memoryUpload.single('file'), async (req, res) => {
  try {
    const { startup_overview, website } = req.body;
    console.log(`📩 Incoming Profile Gen Request:`, {
      contentType: req.get('content-type'),
      hasBody: !!req.body,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileType: req.file?.mimetype,
      fileSize: req.file?.size,
      overviewLen: startup_overview?.length || 0
    });

    let combinedContext = `Manual Overview: ${startup_overview || 'Not provided'}\n`;

    // 1. Optional Website Scraping
    if (website && website.startsWith('http')) {
      console.log(`🌐 Scraping website: ${website}`);
      try {
        const scraped = await scrapeDetails(website);
        if (scraped) combinedContext += `\nWebsite Content:\n${scraped.substring(0, 5000)}\n`;
      } catch (e) {
        console.warn(`Scrape failed for ${website}:`, e.message);
      }
    }

    // 2. Optional PDF Extraction
    if (req.file && (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf'))) {
      console.log(`📄 Attempting PDF extraction: ${req.file.originalname}`);
      try {
        const pdfText = await extractTextFromPDF(req.file.buffer);
        if (pdfText) {
          console.log(`✅ Extracted ${pdfText.length} characters from PDF.`);
          combinedContext += `\nPDF Content (Pitch Deck):\n${pdfText.substring(0, 5000)}\n`;
        } else {
          console.warn(`⚠️ PDF extraction returned no text.`);
        }
      } catch (e) {
        console.warn(`❌ PDF extraction failed:`, e.message);
      }
    }

    const prompt = `
      You are an expert startup analyst. Analyze the following context and extract a COMPREHENSIVE startup profile.
      Context:
      ${combinedContext}

      CRITICAL: Return ONLY a valid JSON object. No markdown, no chatter.
      JSON Schema:
      {
        "startup_name": "string",
        "sector": "string (MUST be exactly one of: AgriTech, AI / ML, DeepTech, FinTech, HealthTech, Climate / Energy, Smart Cities)",
        "stage": "string (MUST be exactly one of: Idea, MVP, Early Revenue, Growth, PMF, Scale)",
        "startup_overview": "string (improved description)",
        "problem_statement": "string",
        "solution_summary": "string",
        "target_customers": "string",
        "business_model": "string",
        "founded": "string (e.g. 2022)",
        "incorporation": "string",
        "dpiit": "string",
        "location": "string",
        "team_size": "number or string",
        "revenue": "string",
        "traction_summary": "string",
        "website": "string (Extract the URL or domain if present anywhere in the text, e.g. https://domain.com)"
      }

      Use high-quality, professional investor-ready language. Leave fields empty string "" if the information is strictly not available in the context.
    `;

    console.log(`🤖 Consulting AI for profile generation...`);
    const resultString = await callOpenRouter(prompt);

    // Robust cleaning
    let cleanJson = resultString.match(/\{[\s\S]*\}/);
    if (!cleanJson) throw new Error("AI failed to return valid JSON");

    // Final check for trailing commas etc
    let jsonText = cleanJson[0].replace(/,\s*([\]}])/g, '$1');
    const parsed = JSON.parse(jsonText);

    // If website was provided but not in AI result (or AI returned a placeholder), add it
    const falsyValues = ["", "none", "n/a", "not specified", "not provided", "null", "undefined", "unknown"];
    const isWebsiteMissing = !parsed.website || falsyValues.includes(String(parsed.website).toLowerCase().trim());
    
    if (website && isWebsiteMissing) {
      parsed.website = website;
    }

    res.json({ result: parsed });
  } catch (err) {
    console.error("Profile generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-application-schema
// POST /api/ai/generate-application-schema
app.post('/api/ai/generate-application-schema', async (req, res) => {
  try {
    const { opportunity_id, source_url = '' } = req.body || {};
    if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id is required' });

    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .or(`opportunity_id.eq.${opportunity_id},slug.eq.${opportunity_id}`)
      .maybeSingle();

    if (oppError) throw oppError;
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    const detailContext = JSON.stringify({
      title: opportunity.title,
      provider: opportunity.provider,
      description: opportunity.description,
      eligibility: opportunity.eligibility,
      benefits: opportunity.benefits,
      formatted_details: opportunity.formatted_details,
      raw_scraped_text: (opportunity.raw_scraped_text || '').slice(0, 5000),
      source_url: source_url || opportunity.link || ''
    });

    const prompt = `
      You are designing a structured grant application form for a funding opportunity.
      Infer the likely application questions a founder will need to answer.

      Return ONLY valid JSON with this exact structure:
      {
        "title": "string",
        "subtitle": "string",
        "sections": [
          {
            "title": "string",
            "fields": [
              {
                "id": "snake_case_key",
                "label": "Question text",
                "type": "text | textarea | email | url | number | date | select | checkbox",
                "required": true,
                "placeholder": "string",
                "help_text": "string",
                "options": ["choice 1"],
                "max_words": 150
              }
            ]
          }
        ],
        "required_documents": ["Pitch deck"]
      }

      Rules:
      - Prefer realistic founder application fields.
      - Group them into 2-5 sections.
      - Use textarea for narrative questions.
      - Use select only when the likely answer space is short and obvious.
      - Include required_documents when strongly implied.

      Opportunity context:
      ${detailContext}
    `;

    let schema = null;
    try {
      console.log('[AI] Calling LLM...');
      const aiResponse = await callLLM(prompt);
      console.log('[AI] Raw Response Received:', aiResponse?.substring(0, 200) + '...');

      // 3. Extract JSON
      console.log('[AI] Extracting JSON...');
      const result = extractJSON(aiResponse);
      console.log('[AI] Extracted JSON Keys:', Object.keys(result || {}));
      schema = result;
    } catch (err) {
      console.warn('Application schema AI generation failed, using fallback schema.', err.message);
    }

    const normalized = normalizeSchema(schema || inferSchemaFromOpportunity(opportunity), `${opportunity.title} Application Draft`);
    
    // Update opportunity with generated schema
    await supabase.from('opportunities').update({ generated_application_schema: normalized }).eq('opportunity_id', opportunity.opportunity_id);

    // Update existing drafts for this opportunity
    const { data: drafts } = await supabase.from('drafts').select('*').eq('opportunity_id', opportunity.opportunity_id);
    
    if (drafts) {
      for (const draft of drafts) {
        if (!draft.form_schema || draft.schema_source !== 'extension_capture') {
          const updateData = {
            form_schema: normalized,
            form_fields: buildInitialFormFields(normalized, draft.form_fields || {})
          };
          updateData.completion = calculateCompletion(normalized, updateData.form_fields);
          await supabase.from('drafts').update(updateData).eq('draft_id', draft.draft_id);
        }
      }
    }

    res.json({ result: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/feedback-insights
// Analyzes rejection feedback to give actionable advice
app.post('/api/ai/feedback-insights', async (req, res) => {
  try {
    const { application } = req.body;
    if (!application) return res.status(400).json({ error: 'Application data is required' });

    console.log(`🤖 AI System: Generating feedback insights for application ${application.application_id}`);

    const timeline = application.timeline || [];
    const rejectionEvent = timeline.find(t => (t.stage || t.status) === 'Rejected');
    const feedbackText = rejectionEvent?.note || application.feedback || 'No specific feedback provided.';

    const prompt = `
      You are a startup coach and investment analyst. A founder just got rejected from a funding opportunity.
      
      Opportunity: ${application.opportunity?.title || 'Unknown'}
      Rejection Feedback: "${feedbackText}"
      
      Task: Provide a 2-3 sentence "Actionable Insight". 
      - If the feedback is about "traction", suggest specific metrics to focus on.
      - If it's about "market size", suggest how to better articulate the TAM.
      - If it's vague, give general advice on how to follow up or improve the pitch deck.
      
      Keep it encouraging but professional. Start with "Insight:".
      Do not include any other chatter.
    `;

    try {
      const result = await callOpenRouter(prompt);
      const cleaned = result.replace(/^Insight:\s*/i, '').trim();
      res.json({ result: cleaned });
    } catch (err) {
      console.error('AI Insight generation failed', err);
      res.json({ result: "Focus on strengthening your core traction metrics and refining your value proposition for the next round." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getProfileSignature(profile = {}) {
  return JSON.stringify({
    sector: profile.sector || profile.industry || '',
    stage: profile.stage || '',
    startup_overview: profile.startup_overview || profile.description || '',
    problem_statement: profile.problem_statement || '',
    solution_summary: profile.solution_summary || '',
    target_customers: profile.target_customers || '',
    business_model: profile.business_model || '',
    location: profile.location || ''
  });
}

function normalizeMatchScore(score) {
  const parsed = Number(score);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

// Rank opportunities with match score (0-100)
app.post('/api/ai/match-opportunities', async (req, res) => {
  try {
    const { profile, opportunities } = req.body;
    console.log(`[DEBUG] /api/ai/match-opportunities called. Opportunities count: ${opportunities?.length}, Profile user_id: ${profile?.user_id}`);
    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      console.log(`[DEBUG] Returning empty because opportunities array is missing or empty`);
      return res.json({ result: [] });
    }
    const userId = profile?.user_id || 'anonymous';
    const profileSignature = getProfileSignature(profile || {});
    console.log(`[DEBUG] Calculated signature length: ${profileSignature.length}`);

    // Fetch cached scores from Supabase
    const oppIds = opportunities.map(o => o.opportunity_id);
    const { data: cachedScores } = await supabase
      .from('match_scores')
      .select('*')
      .eq('user_id', userId)
      .in('opportunity_id', oppIds);

    const cached = [];
    const toScore = [];
    opportunities.forEach(opportunity => {
      const cachedScore = cachedScores?.find(item => item.opportunity_id === opportunity.opportunity_id);

      if (cachedScore) {
        cached.push({
          opportunity_id: opportunity.opportunity_id,
          score: cachedScore.score,
          cached: true,
          reasons: cachedScore.reasons || []
        });
      } else {
        toScore.push(opportunity);
      }
    });

    console.log(`[DEBUG] Found ${cached.length} cached scores, ${toScore.length} remaining to score.`);

    if (toScore.length === 0) {
      return res.json({ result: cached });
    }
    console.log(`✨ Incoming match request for ${opportunities.length} items...`);

    // Chunk array to prevent LLM token limits and JSON truncation errors
    const CHUNK_SIZE = 5;
    let allResults = [];

    for (let i = 0; i < toScore.length; i += CHUNK_SIZE) {
      const chunk = toScore.slice(i, i + CHUNK_SIZE);
      console.log(`🤖 Requesting AI match scores for chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} items)...`);

      const prompt = `
        You are a strict startup funding analyst. Evaluate how strongly this founder profile matches each funding opportunity.
        
        DO NOT WRITE ANY CODE OR SCRIPTS. ONLY OUTPUT JSON.
        
        SCORE BANDS:
        - 90-100: Excellent fit. Sector/problem, stage, geography, and applicant type all clearly align.
        - 75-89: Strong fit. Most requirements align and the funding/support is highly relevant.
        - 55-74: Moderate fit. Generic or sector-agnostic opportunity with no obvious disqualifier, or partial sector/stage fit.
        - 30-54: Weak fit. Some usefulness, but sector, stage, geography, or applicant type is uncertain or loosely aligned.
        - 0-29: Poor fit. Clear mismatch, expired/closed, wrong geography, wrong applicant type, or incompatible stage.

        RUBRIC:
        1. Penalize clear hard mismatches. Do not give high scores just because the opportunity is a grant.
        2. Sector/problem fit is the strongest positive signal.
        3. Stage fit matters: idea-only, student-only, women-only, nonprofit-only, geography-only, or cohort-specific programs should score low when the profile does not match.
        4. All Sectors or Pan India is not automatically excellent. It should usually be 55-75 unless benefits and stage are strongly relevant.
        5. Benefits raise the score only if useful to this startup profile.
        6. Return varied, realistic scores and include 1-3 short reasons.

        Return a realistic score for every provided opportunity_id.

        CRITICAL: Never output markdown. Only output a valid JSON array. Do not output python code.
        Format: [ { "opportunity_id": "...", "score": 85, "reasons": ["sector fit", "stage fit"] }, ... ]
        
        Founder Profile:
        - Startup: ${profile.startup_name || 'Unknown'}
        - Sector: ${profile.sector || 'Unknown'}
        - Stage: ${profile.stage || 'Unknown'}
        - Overview: ${profile.startup_overview || profile.description || 'Unknown'}
        - Problem: ${profile.problem_statement || 'Unknown'}
        - Solution: ${profile.solution_summary || 'Unknown'}
        - Customers: ${profile.target_customers || 'Unknown'}
        - Business Model: ${profile.business_model || 'Unknown'}

	        Opportunities to Evaluate: 
	        ${JSON.stringify(chunk.map(o => ({
        opportunity_id: o.opportunity_id,
        title: o.title,
        sector: o.sector,
        stage: o.stage,
        type: o.type,
        amount: o.amount,
        deadline: o.deadline,
        location: o.location,
        desc: (o.description || '').substring(0, 900),
        about: (o.about || '').substring(0, 1000),
        eligibility: (o.eligibility || '').substring(0, 1000),
        benefits: (o.benefits || '').substring(0, 700),
        timeline: (o.timeline || '').substring(0, 500),
        raw: (o.raw_scraped_text || '').substring(0, 1200)
      })))}
      `;

      let resultText = await callLLM(prompt);

      // Clean potential markdown or chatter - Use robust regex to find the [ array ] or { object }
      let results = extractJSON(resultText);

      if (!results) {
        chunk.forEach(o => allResults.push({ opportunity_id: o.opportunity_id, score: 0 }));
        continue;
      }

      let items = Array.isArray(results) ? results : (Object.values(results).find(v => Array.isArray(v)) || [results]);
      if (Array.isArray(items)) {
        allResults = allResults.concat(items.map(item => ({
          opportunity_id: item.opportunity_id,
          score: normalizeMatchScore(item.score),
          reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 3) : []
        })));
      } else {
        chunk.forEach(o => allResults.push({ opportunity_id: o.opportunity_id, score: 0 }));
      }
    }

    // ID RECOVERY: Ensure every opportunity has a score
    const scoredIds = allResults.filter(p => p && p.opportunity_id).map(p => p.opportunity_id);
    const finalScores = allResults.filter(p => p && p.opportunity_id);

    toScore.forEach(o => {
      if (!scoredIds.includes(o.opportunity_id)) {
        finalScores.push({ opportunity_id: o.opportunity_id, score: calculateLocalMatchScore(profile, o), reasons: ['Local fallback score'] });
      }
    });

    console.log(`✅ AI delivered scores for ${finalScores.length} items.`);
    
    // Save scores to Supabase
    const scoresToInsert = finalScores.map(item => ({
      user_id: userId,
      opportunity_id: item.opportunity_id,
      profile_signature: profileSignature,
      score: normalizeMatchScore(item.score),
      reasons: item.reasons || [],
      scored_at: new Date().toISOString()
    }));

    await supabase.from('match_scores').upsert(scoresToInsert, { onConflict: 'user_id,opportunity_id' });

    console.log(`Match scoring returned ${cached.length + finalScores.length} items (${cached.length} cached).`);
    res.json({ result: [...cached, ...finalScores] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/summarize-opportunity
// Summarize in 3 bullets
app.post('/api/ai/summarize-opportunity', async (req, res) => {
  try {
    const { description } = req.body;
    const prompt = `Summarize the following opportunity in exactly 3 short bullet points. Only output the bullets.\n\nDescription: ${description}`;
    const result = await callOpenRouter(prompt);
    res.json({ result: result.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/eligibility
// Check eligibility
app.post('/api/ai/eligibility', async (req, res) => {
  try {
    const { profile, eligibility, description, opportunity_title, opportunity_sector } = req.body;

    console.log(`🔍 Eligibility Check: Startup Sector [${profile.sector || ''}] vs Opportunity [${opportunity_title}]`);

    const prompt = `You are a strict, objective Startup Funding Advisor. Your goal is to determine if a startup is eligible for a specific funding opportunity based on the provided details.

STARTUP PROFILE:
Name: ${profile.startup_name || 'Unnamed Startup'}
Sector: ${profile.sector || 'Unspecified'}
Stage: ${profile.stage || 'Unspecified'}
Description: ${profile.description || 'No description provided'}

OPPORTUNITY DETAILS:
Title: ${opportunity_title}
Sector Focus: ${opportunity_sector}
Description: ${description || 'Not provided'}
Known Criteria: ${eligibility !== 'See opportunity page for detailed eligibility criteria.' ? eligibility : 'Use description to infer criteria'}

RULES FOR EVALUATION:
1. Analyze the startup's sector, stage, and description against the opportunity's focus and description.
2. If the opportunity requires a specific sector (e.g., DeepTech) and the startup is in a completely different sector (e.g., EdTech) with no overlap, they are INELIGIBLE.
3. If the opportunity requires a specific stage (e.g., Early Revenue) and the startup is at Idea stage, they are INELIGIBLE.
4. If there's a reasonable overlap or the opportunity is sector-agnostic ("All Sectors"), they are ELIGIBLE.
5. Provide a realistic assessment. Do not force an ELIGIBLE status if there is a clear mismatch.

OUTPUT FORMAT:
STATUS: [ELIGIBLE or INELIGIBLE or POTENTIALLY ELIGIBLE]
- [Brief reason based on sector fit]
- [Brief reason based on stage or technological synergy]
- [Final conclusion]`;

    const result = await callOpenRouter(prompt);
    res.json({ result: result.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-draft
// Smart draft generation: only generates answers for MISSING fields.
// If a field already has a non-empty answer, it is skipped to save tokens.
app.post('/api/ai/generate-draft', async (req, res) => {
  console.log('[AI] Generate Draft Request Received');
  try {
    const { profile, form_fields: existingFields = {}, form_schema, opportunity } = req.body;
    console.log('[AI] Opportunity:', opportunity?.title || opportunity?.opportunity_id);

    const normalizedSchema = form_schema ? normalizeSchema(form_schema, opportunity?.title || 'Application Draft') : null;

    const allFieldContext = normalizedSchema
      ? flattenSchema(normalizedSchema).map(field => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder || '',
        name: field.name || '',
        options: field.options,
        help_text: field.help_text,
        max_words: field.max_words
      }))
      : [];

    // ── TOKEN SAVER: Only generate for fields that are missing or empty ──
    const missingFieldContext = allFieldContext.filter(field => {
      const existing = existingFields[field.id];
      // Skip if already has a non-empty, non-whitespace answer
      return !existing || String(existing).trim() === '';
    });

    const alreadyAnsweredCount = allFieldContext.length - missingFieldContext.length;
    if (alreadyAnsweredCount > 0) {
      console.log(`[AI] Skipping ${alreadyAnsweredCount} already-answered field(s). Only generating for ${missingFieldContext.length} missing field(s).`);
    }

    // If nothing is missing, return existing fields as-is — zero AI calls
    if (missingFieldContext.length === 0) {
      console.log('[AI] All fields already answered. Returning existing draft without calling AI.');
      return res.json({ result: existingFields, skipped: allFieldContext.length, generated: 0 });
    }

    const prompt = `
      You are an expert grant application assistant. Fill this application form using the founder's profile and opportunity details.
      
      CRITICAL RULES:
      1. ONLY use information explicitly stated in the profile
      2. NEVER invent metrics, revenue figures, customer counts, or partnerships
      3. For financial numbers, use exact figures from profile or leave empty
      4. NAME SPLITTING (FORCED RULE): 
         - If a field id/label/name/placeholder contains "First", "Given", or "Forename" -> Use ONLY the first name.
         - If a field id/label/name/placeholder contains "Last", "Family", or "Surname" -> Use ONLY the last name.
         - NEVER repeat the full name in both. If you only have one name field, use the full name.
      5. EMAIL RULE: ALWAYS use the "application_email" from the profile for any email fields.
      6. Keep responses concise and professional
      7. For unknown/missing information, use empty string ""
      8. Match the exact field requirements (word limits, format)
      
      Profile Analysis:
      - Founder Full Name: ${profile.founder_name || 'Not specified'}
      - Founder First Name: ${(profile.founder_name || '').split(' ')[0] || ''}
      - Founder Last Name: ${(profile.founder_name || '').split(' ').slice(1).join(' ') || ''}
      - Application Email: ${profile.application_email || profile.email || 'Not specified'}
      - Contact Phone: ${profile.phone || 'Not specified'}
      - Startup: ${profile.startup_name || 'Not specified'}
      - Website: ${profile.website || 'Not specified'}
      - Sector: ${profile.sector || 'Not specified'}
      - Stage: ${profile.stage || 'Not specified'}
      - Overview: ${profile.startup_overview || 'Not specified'}
      - Problem: ${profile.problem_statement || 'Not specified'}
      - Solution: ${profile.solution_summary || 'Not specified'}
      - Target Market: ${profile.target_customers || 'Not specified'}
      - Business Model: ${profile.business_model || 'Not specified'}
      - Team Size: ${profile.team_size || 'Not specified'}
      - Founded: ${profile.founded_year || 'Not specified'}
      
      Opportunity Context:
      - Title: ${opportunity?.title || 'Not specified'}
      - Provider: ${opportunity?.provider || 'Not specified'}
      - Type: ${opportunity?.type || 'Not specified'}
      - Sector Focus: ${opportunity?.sector || 'Not specified'}
      - Stage Focus: ${opportunity?.stage || 'Not specified'}
      
      Form Fields to Complete (MISSING fields only — do NOT regenerate already answered ones):
      ${JSON.stringify(missingFieldContext, null, 2)}
      
      Return ONLY a valid JSON object with field IDs as keys. No markdown, no explanations. 
      IMPORTANT: If you cannot find information for a field, use an empty string "". 
      DO NOT include any text before or after the JSON.
      
      Example format:
      {
        "field_id_1": "answer based on profile",
        "field_id_2": "another answer",
        "field_id_3": ""
      }
    `;

    // ── CHUNKED AI CALLS: increased batch size for faster models (Gemini Flash) ──
    const BATCH_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < missingFieldContext.length; i += BATCH_SIZE) {
      chunks.push(missingFieldContext.slice(i, i + BATCH_SIZE));
    }

    const totalMissing = missingFieldContext.length;
    console.log(`🤖 Generating AI draft for "${opportunity?.title || 'unknown'}" — ${totalMissing} missing field(s) in ${chunks.length} batch(es)...`);

    // Helper: build the profile+opportunity header (shared across all batches)
    const profileHeader = prompt.substring(0, prompt.indexOf('Form Fields to Complete'));

    function buildBatchPrompt(fields) {
      return `${profileHeader}
      Form Fields to Complete (MISSING fields only — do NOT regenerate already answered ones):
      ${JSON.stringify(fields, null, 2)}
      
      Return ONLY a valid JSON object with field IDs as keys. No markdown, no explanations.
      IMPORTANT: If you cannot find information for a field, use an empty string "".
      DO NOT include any text before or after the JSON.
      
      Example format:
      {
        "field_id_1": "answer based on profile",
        "field_id_2": "another answer",
        "field_id_3": ""
      }
    `;
    }

    // Process all batches sequentially and merge results
    const newAnswers = {};
    for (let batchIdx = 0; batchIdx < chunks.length; batchIdx++) {
      const batch = chunks[batchIdx];
      const batchPrompt = chunks.length === 1 ? prompt : buildBatchPrompt(batch);

      console.log(`[AI] Batch ${batchIdx + 1}/${chunks.length}: ${batch.length} field(s)...`);
      const aiResponse = await callLLMForDraft(batchPrompt);

      const parsed = extractJSON(aiResponse);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`[AI] Batch ${batchIdx + 1} returned invalid JSON — skipping batch.`);
        continue;
      }

      // Validate and clean batch answers
      Object.keys(parsed).forEach(fieldId => {
        const field = batch.find(f => f.id === fieldId);
        if (!field) return;

        let value = parsed[fieldId];
        if (field.type === 'checkbox') {
          newAnswers[fieldId] = Boolean(value);
        } else if (field.type === 'select') {
          newAnswers[fieldId] = field.options && field.options.includes(value) ? value : '';
        } else if (typeof value === 'string') {
          if (field.max_words && value.split(' ').length > field.max_words) {
            newAnswers[fieldId] = value.split(' ').slice(0, field.max_words).join(' ');
          } else {
            newAnswers[fieldId] = value.trim();
          }
        } else {
          newAnswers[fieldId] = String(value).trim();
        }
      });
    }

    // Ensure required missing fields have at least an empty string
    missingFieldContext.forEach(field => {
      if (field.required && !(field.id in newAnswers)) {
        newAnswers[field.id] = '';
      }
    });

    // Merge: existing answers take priority, new AI answers fill the gaps
    const mergedResult = { ...newAnswers, ...existingFields };
    // Re-apply new answers for fields that were empty in existingFields
    Object.keys(newAnswers).forEach(id => {
      if (!existingFields[id] || String(existingFields[id]).trim() === '') {
        mergedResult[id] = newAnswers[id];
      }
    });

    console.log(`✅ AI draft complete: ${Object.keys(newAnswers).length} new answers generated, ${alreadyAnsweredCount} fields reused from existing draft.`);
    res.json({
      result: mergedResult,
      generated: Object.keys(newAnswers).length,
      skipped: alreadyAnsweredCount
    });
  } catch (err) {
    console.error('❌ AI draft generation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/map-fields
// Use AI to map page labels to draft field IDs when direct text matching fails
app.post('/api/ai/map-fields', async (req, res) => {
  try {
    const { pageFields, draftSchema } = req.body;

    const draftFields = flattenSchema(draftSchema).map(f => ({ id: f.id, label: f.label }));

    const prompt = `
            You are an expert at mapping form fields between different systems.
            
            DRAFT FIELDS (Your source of truth):
            ${JSON.stringify(draftFields, null, 2)}
            
            PORTAL FIELDS (Found on the live webpage):
            ${JSON.stringify(pageFields.map(f => ({
      id: f.id,
      label: f.label,
      name: f.name || '',
      placeholder: f.placeholder || ''
    })), null, 2)}
            
            TASK:
            Map the PORTAL FIELDS to the DRAFT FIELDS.
            Many portal labels might be slightly different (e.g. "Company Name" vs "Startup Name").
            
            STRICT RULES:
            1. NEVER map both a "First Name" and "Last Name" portal field to the same draft field.
            2. Map "First Name" portal fields to "First Name" draft fields ONLY.
            3. Map "Last Name" portal fields to "Last Name" draft fields ONLY.
            4. If portal fields are generically labeled (e.g., both are "Name"), use their IDs or placeholders to differentiate.
            5. For "Full Name" portal fields, map to a "Full Name" draft field if it exists, otherwise leave for manual split.
            
            RETURN ONLY a JSON object where the key is the PORTAL FIELD ID and the value is the matching DRAFT FIELD ID.
            If no match is found for a portal field, omit it.
            
            Example Format:
            {
                "portal_input_1": "startup_name",
                "portal_input_2": "founder_email"
            }
        `;

    console.log('🤖 AI System: Mapping fuzzy fields for extension...');
    const aiResponse = await callLLM(prompt);
    const mapping = extractJSON(aiResponse);

    res.json({ mapping: mapping || {} });
  } catch (err) {
    console.error('Field mapping failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/draft-progress
// Analyze draft completion with the same provider chain used for draft generation.
app.post('/api/ai/draft-progress', async (req, res) => {
  try {
    const { draft = {}, form_schema, opportunity } = req.body;
    const fields = form_schema ? flattenSchema(form_schema) : [];
    const fieldValue = (fieldId) => String(draft.form_fields?.[fieldId] || '').trim();
    const totalFields = fields.length;
    const completedFields = fields.filter(f => fieldValue(f.id).length > 0).length;
    const requiredFields = fields.filter(f => f.required).length;
    const completedRequired = fields.filter(f => f.required && fieldValue(f.id).length > 0).length;
    const missingRequired = fields
      .filter(f => f.required && fieldValue(f.id).length === 0)
      .map(f => ({ id: f.id, label: f.label || f.id, section: f.section || 'Application Details' }));
    const weakFields = fields
      .filter(f => {
        const value = fieldValue(f.id);
        return value.length > 0 && (f.type === 'textarea' || f.max_words) && value.split(/\s+/).filter(Boolean).length < 20;
      })
      .slice(0, 6)
      .map(f => ({
        id: f.id,
        label: f.label || f.id,
        section: f.section || 'Application Details',
        words: fieldValue(f.id).split(/\s+/).filter(Boolean).length
      }));
    const requiredDocuments = Array.isArray(form_schema?.required_documents) ? form_schema.required_documents : [];
    const requiredDocumentStatus = draft.required_documents_status || {};
    const documentStatusValue = (doc) => {
      const key = String(doc).toLowerCase().trim();
      return String(requiredDocumentStatus[doc] || requiredDocumentStatus[key] || '').toLowerCase();
    };
    const missingDocuments = requiredDocuments.filter(doc =>
      !['ready', 'uploaded', 'provided', 'complete', 'completed'].includes(documentStatusValue(doc))
    );

    const completionRate = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    const requiredCompletionRate = requiredFields > 0 ? Math.round((completedRequired / requiredFields) * 100) : 0;
    const deterministicAnalysis = {
      completion_percentage: completionRate,
      completion_analysis: {
        total_fields: totalFields,
        completed_fields: completedFields,
        completion_rate: completionRate,
        required_fields: requiredFields,
        completed_required: completedRequired,
        required_completion_rate: requiredCompletionRate
      },
      missing_required_fields: missingRequired.map(f => f.id),
      missing_required_field_details: missingRequired,
      required_documents: requiredDocuments,
      missing_documents: missingDocuments,
      quality_assessment: {
        strengths: completedFields > 0 ? ['Draft has started and can be improved from existing answers.'] : ['Draft shell is ready for AI-assisted completion.'],
        weaknesses: [
          ...(missingRequired.length ? [`${missingRequired.length} required field(s) still need answers.`] : []),
          ...(weakFields.length ? [`${weakFields.length} answer(s) look too brief for reviewer confidence.`] : []),
          ...(missingDocuments.length ? [`${missingDocuments.length} required document(s) need attention.`] : [])
        ],
        overall_score: Math.max(0, Math.min(100, Math.round((completionRate * 0.65) + (requiredCompletionRate * 0.35))))
      },
      actionable_suggestions: [
        ...(missingRequired.length ? [`Start with required fields: ${missingRequired.slice(0, 3).map(f => f.label).join(', ')}.`] : []),
        ...(weakFields.length ? ['Expand brief answers with traction, eligibility, measurable impact, and specific examples.'] : []),
        ...(missingDocuments.length ? [`Prepare required documents: ${missingDocuments.slice(0, 4).join(', ')}.`] : []),
        'Review every answer for exact figures, founder contact details, and opportunity-specific language.'
      ].slice(0, 4),
      priority_improvements: [
        ...missingRequired.slice(0, 4).map(f => ({
          field: f.id,
          label: f.label,
          issue: 'Required field is empty',
          suggestion: `Add a concise answer for ${f.label} before applying.`
        })),
        ...weakFields.slice(0, 2).map(f => ({
          field: f.id,
          label: f.label,
          issue: `Answer is only ${f.words} word(s)`,
          suggestion: 'Add concrete metrics, customer context, traction, or program fit.'
        }))
      ].slice(0, 5),
      next_steps: completionRate >= 80 ? ['Review answers', 'Attach required documents', 'Submit through portal'] : ['Complete missing required fields', 'Improve short answers', 'Prepare required documents'],
      estimated_time_to_complete: Math.ceil((totalFields - completedFields + missingDocuments.length) * 2) + ' minutes'
    };

    const prompt = `
You are an expert grant application reviewer. Analyze this draft and provide actionable feedback.

Draft Details:
- Title: ${draft.title || draft.opportunity_title || 'Untitled'}
- Completion: ${completedFields}/${totalFields} fields (${completionRate}%)
- Required Fields: ${completedRequired}/${requiredFields} completed (${requiredCompletionRate}%)
- Opportunity: ${opportunity?.title || 'Not specified'}
- Sector: ${opportunity?.sector || 'Not specified'}

Form Fields Content:
${JSON.stringify(draft.form_fields || {}, null, 2)}

Form Schema:
${JSON.stringify(fields, null, 2)}

Required Documents:
${JSON.stringify(requiredDocuments, null, 2)}

Current Required Document Status:
${JSON.stringify(requiredDocumentStatus, null, 2)}

Return ONLY valid JSON with:
{
  "missing_required_fields": ["field_id"],
  "missing_required_field_details": [{"id":"field_id","label":"Field label","section":"Section"}],
  "missing_documents": ["document name"],
  "quality_assessment": {
    "strengths": ["specific strength"],
    "weaknesses": ["specific weakness"],
    "overall_score": 75
  },
  "actionable_suggestions": ["specific next action"],
  "priority_improvements": [
    {"field":"field_id","label":"Field label","issue":"specific issue","suggestion":"how to fix"}
  ],
  "next_steps": ["short next step"]
}

Focus on missing required fields, required documents, vague or short answers, opportunity alignment, and concrete metrics.
`;

    console.log(`Analyzing draft progress for ${draft.title || draft.opportunity_title || 'untitled draft'}...`);
    let analysis = deterministicAnalysis;
    let aiAvailable = false;
    try {
      const result = await callLLMForDraft(prompt);
      const parsed = extractJSON(result);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        analysis = parsed;
        aiAvailable = true;
      }
    } catch (aiErr) {
      console.warn(`Draft progress AI unavailable, returning deterministic analysis: ${aiErr.message}`);
    }

    const enhancedAnalysis = {
      ...deterministicAnalysis,
      ...(analysis || {}),
      completion_analysis: deterministicAnalysis.completion_analysis,
      missing_required_fields: Array.isArray(analysis?.missing_required_fields) ? analysis.missing_required_fields : deterministicAnalysis.missing_required_fields,
      missing_required_field_details: Array.isArray(analysis?.missing_required_field_details) ? analysis.missing_required_field_details : deterministicAnalysis.missing_required_field_details,
      missing_documents: Array.isArray(analysis?.missing_documents) ? analysis.missing_documents : deterministicAnalysis.missing_documents,
      ai_available: aiAvailable,
      next_steps: Array.isArray(analysis?.next_steps) ? analysis.next_steps : deterministicAnalysis.next_steps,
      estimated_time_to_complete: deterministicAnalysis.estimated_time_to_complete
    };

    console.log(`Draft analysis complete: ${completionRate}% complete, ${enhancedAnalysis.actionable_suggestions?.length || 0} suggestions`);
    res.json({ result: enhancedAnalysis });
  } catch (err) {
    console.error('Draft progress analysis failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/feedback-insights
// Output suggestions and improvements for a previous rejection
app.post('/api/ai/feedback-insights', async (req, res) => {
  try {
    const { application } = req.body;
    const prompt = `
      Analyze this rejected application and return suggestions for improving the next application.
      Return exactly 3 actionable bullet points.
      
      Application: ${JSON.stringify(application)}
    `;
    const result = await callOpenRouter(prompt);
    res.json({ result: result.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error in request', err, {
    path: req.path,
    method: req.method,
    user_id: req.user_id || 'anonymous',
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = {
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  };

  res.status(err.status || 500).json(errorResponse);
});
// Nightly automated scraper handled via single cron job at Line 255

// ─── STATIC FILES (React Build) ───────────────────────────────────────────────
const REACT_BUILD = path.join(__dirname, '..', 'build');
if (fs.existsSync(REACT_BUILD)) {
  app.use(express.static(REACT_BUILD));
  // SPA fallback — all non-API routes return React's index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(REACT_BUILD, 'index.html'));
  });
  console.log(`⚛️   Serving React build from: ${REACT_BUILD}`);
} else {
  console.warn(`⚠️   React build not found at ${REACT_BUILD}. Run "npm run build" in the frontend folder first.`);
}

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  FundMe server running at http://localhost:${PORT}`);
});
