import fs from 'fs';
import path from 'path';

const logPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\09fe966f-883e-4cf9-88b9-73c8081b268d\\.system_generated\\tasks\\task-252.log';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line) => {
    if (line.includes('Processing:') || line.includes('Fetching details')) {
      console.log(line.trim());
    }
  });
} else {
  console.log('Log file does not exist');
}
