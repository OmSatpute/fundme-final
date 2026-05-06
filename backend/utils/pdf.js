const pdfParse = require('pdf-parse');

/**
 * Robustly extracts text from a PDF buffer, supporting multiple versions
 * of the pdf-parse library (classic function vs modern object-oriented v2+).
 */
async function extractTextFromPDF(dataBuffer) {
  try {
    if (!dataBuffer) return "";
    
    // Convert Buffer to Uint8Array for modern pdf-parse
    const uint8Array = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
    
    let text = "";
    if (pdfParse.PDFParse) {
      console.log("🔍 Using PDFParse Class...");
      const parser = new pdfParse.PDFParse(uint8Array);
      if (typeof parser.load === 'function') await parser.load();
      const result = await parser.getText();
      
      // Handle if result is an object/array
      if (typeof result === 'string') {
        text = result;
      } else if (result && result.items) {
        text = result.items.map(i => i.str || "").join(" ");
      } else {
        text = JSON.stringify(result);
      }
      console.log(`📝 Raw text sample: "${text.substring(0, 100)}..."`);
    } else if (typeof pdfParse === 'function') {
      const data = await pdfParse(dataBuffer);
      text = data.text || "";
    }

    return String(text || "").trim();
  } catch (err) {
    console.error("❌ PDF Parsing Error:", err.message);
    return "";
  }
}

module.exports = { extractTextFromPDF };
