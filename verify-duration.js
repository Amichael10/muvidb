const parseDuration = (iso) => {
  if (!iso) return { formatted: null, totalSeconds: 0 }
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return { formatted: '0:00', totalSeconds: 0 }
  const hours = parseInt(match[1] || 0)
  const minutes = parseInt(match[2] || 0)
  const seconds = parseInt(match[3] || 0)
  const totalSeconds = (hours * 3600) + (minutes * 60) + seconds
  
  let formatted = ''
  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  } else {
    formatted = `${minutes}:${String(seconds).padStart(2, '0')}`
  }
  
  return { formatted, totalSeconds }
}

function testDuration() {
  const cases = [
    { iso: 'PT2M30S', expectedSec: 150, expectedForm: '2:30' },
    { iso: 'PT15M', expectedSec: 900, expectedForm: '15:00' },
    { iso: 'PT16M', expectedSec: 960, expectedForm: '16:00' },
    { iso: 'PT1H2M30S', expectedSec: 3750, expectedForm: '1:02:30' },
    { iso: '', expectedSec: 0, expectedForm: null },
  ];

  console.log('--- Testing parseDuration ---');
  let allPassed = true;
  cases.forEach(c => {
    const result = parseDuration(c.iso);
    const passed = result.totalSeconds === c.expectedSec && result.formatted === c.expectedForm;
    console.log(`ISO: ${c.iso.padEnd(10)} | Expected: ${String(c.expectedSec).padEnd(5)} | Result: ${String(result.totalSeconds).padEnd(5)} | ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (!passed) allPassed = false;
  });
  
  if (allPassed) {
    console.log('\nAll duration tests passed!');
  } else {
    process.exit(1);
  }
}

testDuration();
