import fetch from 'node-fetch';

async function findToken() {
  const res = await fetch('https://kava.tv/category/p1');
  const text = await res.text();
  const authToken = text.match(/authToken\s*[:=]\s*['"]([^'"]+)['"]/i)?.[1];
  const apiKey = text.match(/apiKey\s*[:=]\s*['"]([^'"]+)['"]/i)?.[1];
  const muviToken = text.match(/muviToken\s*[:=]\s*['"]([^'"]+)['"]/i)?.[1];
  
  console.log('authToken:', authToken);
  console.log('apiKey:', apiKey);
  console.log('muviToken:', muviToken);
  
  if (text.includes('authToken')) {
      console.log('Found authToken string but regex might have failed.');
      // Print context around authToken
      const index = text.indexOf('authToken');
      console.log('Context:', text.substring(index - 50, index + 100));
  }
}

findToken();
