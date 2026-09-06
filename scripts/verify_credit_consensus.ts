import {
  normalizePersonName,
  canonicalNameKey,
  nameSimilarity,
  reconcileAndVerifyCredits,
  type RawCandidate
} from './lib/credit_consensus_verifier';

async function runTests() {
  console.log('=== TEST 1: NAME NORMALIZATION & CANONICAL KEYS ===');
  const t1 = normalizePersonName('Chief Dr. Pete Edochie (MON)');
  console.log('Normalized Pete Edochie:', `"${t1}"`);
  console.assert(t1 === 'Pete Edochie', 'Failed Pete Edochie normalization');

  const sim1 = nameSimilarity('Mercy Aigbe', 'Mercy Algbe');
  console.log('Similarity "Mercy Aigbe" vs "Mercy Algbe":', sim1);
  console.assert(sim1 >= 0.88, 'Failed typo similarity threshold');

  const sim2 = nameSimilarity('Faithia Balogun', 'Faithia Williams');
  console.log('Similarity "Faithia Balogun" vs "Faithia Williams":', sim2);

  console.log('\n=== TEST 2: CONSENSUS & DEDUPLICATION ===');
  const fakeFilmId = '00000000-0000-0000-0000-000000000000';

  const worker1: RawCandidate[] = [
    { name: 'Odunlade Adekola', role: 'actor', creditType: 'actor', confidence: 0.92, frameSupport: 3, sourceWorker: 'worker1' },
    { name: 'Femi Adebayo', role: 'actor', creditType: 'actor', confidence: 0.88, frameSupport: 2, sourceWorker: 'worker1' },
    { name: 'Kunle Afolayan', role: 'Director', creditType: 'crew', confidence: 0.95, frameSupport: 1, sourceWorker: 'worker1' },
    { name: 'Random Glitch 123', role: 'actor', creditType: 'actor', confidence: 0.30, frameSupport: 1, sourceWorker: 'worker1' },
  ];

  const worker2: RawCandidate[] = [
    { name: 'Odunlade Adekola', role: 'actor', creditType: 'actor', confidence: 0.90, frameSupport: 3, sourceWorker: 'worker2' },
    { name: 'Femi Adebayo Salami', role: 'actor', creditType: 'actor', confidence: 0.85, frameSupport: 2, sourceWorker: 'worker2' },
    { name: 'Kunle Afolayan', role: 'Director', creditType: 'crew', confidence: 0.91, frameSupport: 1, sourceWorker: 'worker2' },
    { name: 'Sola Sobowale', role: 'actor', creditType: 'actor', confidence: 0.89, frameSupport: 2, sourceWorker: 'worker2' },
  ];

  const metadata: RawCandidate[] = [
    { name: 'Odunlade Adekola', role: 'actor', creditType: 'actor', confidence: 1.0, sourceWorker: 'metadata' },
    { name: 'Sola Sobowale', role: 'actor', creditType: 'actor', confidence: 1.0, sourceWorker: 'metadata' },
  ];

  const verified = await reconcileAndVerifyCredits(fakeFilmId, worker1, worker2, metadata);

  console.log('\n=== VERIFIED CREDITS OUTPUT ===');
  console.log(JSON.stringify(verified, null, 2));

  const actorNames = verified.filter(v => v.role === 'actor').map(v => v.personName);
  console.log('\nExtracted Actor Names:', actorNames);
  console.assert(new Set(actorNames).size === actorNames.length, 'DUPLICATE ACTOR FOUND!');
  console.assert(!actorNames.includes('Random Glitch 123'), 'Noise was not filtered out!');
  
  const director = verified.find(v => v.role === 'director');
  console.log('Extracted Director:', director?.personName);
  console.assert(director?.personName.includes('Kunle Afolayan'), 'Director was not extracted properly!');

  console.log('\n✅ ALL VERIFICATION TESTS PASSED!');
}

runTests().catch(console.error);
