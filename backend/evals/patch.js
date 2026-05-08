const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../server.js');
let content = fs.readFileSync(file, 'utf8');

const regex = /"business_model": "string"\s*\}/;
const replacement = `"business_model": "string",
        "founded": "string",
        "incorporation": "string",
        "dpiit": "string",
        "location": "string",
        "team_size": "number or string",
        "revenue": "string",
        "traction_summary": "string",
        "website": "string"
      }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
  console.log("Successfully patched server.js");
} else {
  console.log("Could not find regex in server.js");
}
