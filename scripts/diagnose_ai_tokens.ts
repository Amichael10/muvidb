import { generateAIContent } from '../api/_lib/ai_service';
import { validateCreditsWithAi } from './lib/ai_credit_validator';

async function testAllAi() {
  console.log('================================================================');
  console.log('🤖 DIAGNOSTIC: Testing AI Engine & Token/Quota Status');
  console.log('================================================================\n');

  // 1. Direct AI Generation test
  console.log('1️⃣  Testing raw generateAIContent()...');
  try {
    const res = await generateAIContent('Respond with JSON: {"status": "ok", "provider": "active"}', { preferredProvider: 'groq' });
    console.log('✅ AI responded successfully!');
    console.log('   Engine used:', res.telemetry?.engine);
    console.log('   Raw text:', res.text.trim());
  } catch (err: any) {
    console.error('❌ Direct AI call failed:', err.message);
  }

  // 2. Validate real credit test
  console.log('\n2️⃣  Testing validateCreditsWithAi() with sample candidates...');
  try {
    const samples = [
      { raw: 'Okiki Afolayan', role: 'director', creditType: 'crew' as const },
      { raw: 'Sound Man', role: 'sound', creditType: 'crew' as const },
      { raw: 'Mitchell Okoro', role: 'actor', creditType: 'actor' as const }
    ];

    const valResults = await validateCreditsWithAi('Live Quota Test Film', samples);
    console.log('✅ Validator Results:');
    for (const r of valResults) {
      console.log(`   • "${r.raw}" -> ${r.isValidHumanName ? 'APPROVED (' + r.cleanName + ')' : 'REJECTED: ' + r.rejectionReason} (Confidence: ${r.confidence}%)`);
    }
  } catch (err: any) {
    console.error('❌ Validator test failed:', err.message);
  }

  console.log('\n✨ Diagnostic complete.');
}

testAllAi().catch(console.error);
