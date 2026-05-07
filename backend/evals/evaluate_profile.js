const fs = require('fs');
const path = require('path');
const { callLLM } = require('../utils/ai');
const { scrapeDetails } = require('../services/scraper');
const { extractJSON } = require('../utils/jsonSanitizer');

// Load Dataset
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset.json'), 'utf8'));

async function singleLLMBaseline(input) {
  console.log('🏃 Running Single LLM Baseline (No Scraping)...');
  const prompt = `
    Analyze the following startup overview and extract a profile.
    Overview: ${input.startup_overview}

    Return ONLY a JSON object:
    {
      "startup_name": "string",
      "sector": "string",
      "stage": "string",
      "startup_overview": "string",
      "problem_statement": "string",
      "solution_summary": "string",
      "target_customers": "string",
      "business_model": "string"
    }
  `;
  const response = await callLLM(prompt);
  return extractJSON(response);
}

async function agenticBaseline(input) {
  console.log('🏃 Running Agentic Baseline (Scraping + Analysis)...');
  let combinedContext = `Manual Overview: ${input.startup_overview}\n`;
  
  if (input.website) {
    try {
      const scraped = await scrapeDetails(input.website);
      if (scraped) combinedContext += `\nWebsite Content:\n${scraped.substring(0, 5000)}\n`;
    } catch (e) {
      console.warn('Scrape failed:', e.message);
    }
  }

  const prompt = `
    You are an expert startup analyst. Analyze the following context and extract a COMPREHENSIVE startup profile.
    Context:
    ${combinedContext}

    Return ONLY a JSON object:
    {
      "startup_name": "string",
      "sector": "string",
      "stage": "string",
      "startup_overview": "string",
      "problem_statement": "string",
      "solution_summary": "string",
      "target_customers": "string",
      "business_model": "string"
    }
  `;
  const response = await callLLM(prompt);
  return extractJSON(response);
}

async function evaluateWithJudge(groundTruth, candidate, name) {
  console.log(`⚖️  LLM-as-Judge evaluating ${name}...`);
  const prompt = `
    You are a professional investment judge. Compare a "Candidate Profile" against a "Ground Truth Profile" for the same startup.
    
    GROUND TRUTH:
    ${JSON.stringify(groundTruth, null, 2)}
    
    CANDIDATE PROFILE (${name}):
    ${JSON.stringify(candidate, null, 2)}
    
    SCORING CRITERIA (0-10):
    1. Accuracy: Does it correctly capture the company name and core mission?
    2. Completeness: Does it fill in all fields (sector, stage, etc.) with high-quality detail?
    3. Hallucination: Does it invent facts not present in ground truth?
    
    Return ONLY a JSON object:
    {
      "score": 0.0,
      "reasoning": "string",
      "accuracy": 0.0,
      "completeness": 0.0,
      "hallucination_penalty": 0.0
    }
  `;
  const response = await callLLM(prompt);
  return extractJSON(response);
}

async function runEval() {
  const results = [];
  
  for (const testCase of dataset.test_cases) {
    console.log(`\n--- Testing: ${testCase.input.website} ---`);
    
    // 1. Run Baselines
    const baselineResult = await singleLLMBaseline(testCase.input);
    const agenticResult = await agenticBaseline(testCase.input);
    
    // 2. Evaluate
    const baselineEval = await evaluateWithJudge(testCase.ground_truth, baselineResult, 'Single LLM Baseline');
    const agenticEval = await evaluateWithJudge(testCase.ground_truth, agenticResult, 'Agentic Baseline');
    
    results.push({
      input: testCase.input,
      baselines: {
        single: { output: baselineResult, eval: baselineEval },
        agentic: { output: agenticResult, eval: agenticEval }
      }
    });
  }
  
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
  console.log('\n✅ Evaluation complete. Results saved to results.json');
  
  // Summary table
  console.table(results.map(r => ({
    Website: r.input.website,
    'Single Score': r.baselines.single.eval.score,
    'Agentic Score': r.baselines.agentic.eval.score
  })));
}

runEval().catch(console.error);
