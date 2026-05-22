import fs from 'fs';
const t = fs.readFileSync('filmhouse_dump.html', 'utf8'); 
const regex = /\"show_time\":\"([^\"]+)\"/g; 
let m, c=0; 
while((m=regex.exec(t)) && c<10) { 
  console.log(m[1]); 
  c++; 
}
if(c === 0) console.log('No showtimes found');
