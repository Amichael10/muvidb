import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

const CONFIRMED_DELETE_IDS = [
  '584072f7-aace-40bf-b9ea-29041657ce3a', // Over The Bridge
  'd1d70fca-63e6-4f03-8e21-2c5dcac98a08', // The Black Book
  'd1c2b944-2b62-4879-a652-c5dfd0ed834d', // Mami Wata
  'a4a61a4a-9769-4b42-aeff-5882205b8542', // Blood Vessel
  '0dbd25ed-2e5f-4574-ad76-e9e786ff8d46', // Her Dark Past
  'd4e8c919-66c9-4595-9fdd-93d69ac2d534', // Through Her Eyes
  'fb043eed-091f-48a4-8194-86ed07841db9', // The Sixth Sense
  'b8de925e-661f-49aa-a3af-b13c31e2c698', // Gbas Gbos
  'a738a481-2b19-49e3-bf65-3469f4b1d443', // Full Time Husband
  '09a91ce3-ed6e-480a-936b-cce228bd4cde', // Echoes Of War
  '25ad3e59-bcf1-4db2-90af-655d07a9b9de', // Water For Gold
  'b69c2f3b-84bf-49e4-b5da-17ed584068aa', // THE MASKED KING
  'bed80e27-ace0-4dba-adb6-c906fa14d5b4', // A RIDE WITH FOREVER
  'bf8b371a-cc72-47ed-88a4-2f63c1626ddd', // Somewhere in Kole
  'd5e7eab0-b897-4c15-8e18-993f3a47a3af', // The Legend of Arhuanran
  'ecca5203-09d6-4048-9031-48353218e326', // The Warrior
  'efc84eb4-edc3-4fca-9d40-75b06c6ec63d', // DOKITA MUSA
  'edb5720f-4954-4e7f-b4eb-3375570847f4', // BETWEEN SILENCE & TRUTH
  'fc447113-862c-40e3-a505-56ad31fff035', // ASO EBI DIARIES
  '5e6dc08e-fb41-4bc5-910f-784fadec806e', // A Bride’s True Price?
  '82092225-9c91-4d70-a96a-103721244630', // Kiapo Cha Damu
  '831705f2-31cc-48bc-ae37-e1e08cab17c2', // Peace Across the Niger
  '8cbf8126-1b09-4b37-833d-e539e71398db', // The Strong One
  'd39c8e17-7203-4635-89c4-12785b5bd7c8', // Iyawo Soldier
  'ad0a9611-bf10-46a9-88a4-17e476d22e89', // Owo Olowo
  'ac99e392-79fa-453d-9de3-f3c4f916ece1', // Oxygen
  '90043aad-b9b1-45d5-a66f-c5daf5295084', // Eta Inu
  '891a78b1-2388-447e-b070-50c325451c33', // Ona Abayo
  '21709219-fa4a-4cb7-a44d-8ddf157e3eab', // Ebun Ala
  '1bc69872-270d-442e-9bad-90bd3ea750c4', // Ife Gbona
  '3a9f71f8-2c00-4187-bcd7-ca1405e769fc', // Ere Ise
  '43ef4941-ceb0-445c-bed0-3f455074682b', // Kini Ere
  '45662550-8200-458e-b62d-d9cda36c3ab3', // Igbagbo Odi
  '49315d06-d6d7-4f07-bcad-8b81028fb292', // Bekun Bekun
  '23479b4d-2170-494e-ae55-5b9ff59239e4', // Asilo Agbara
  '3c5a6a37-82e3-474e-8f96-ef1fa02d0588', // Ugegbe
  '35abc34d-a274-428d-9446-4dae2d4838d6', // Abiayamo
  '37d796c7-c83e-49dd-b275-26417859d6c4', // Abiymo
  '6bc0ce6d-b83a-4b97-8173-8323fb369198', // Afe Aje
  '752ee9e1-abd3-487e-af82-cbcb49342d98', // Ife Ilu
  '80d174b2-9d81-4aac-8619-78c1e23ba828', // Ala Ganna
  '65aed11b-c9de-47fc-9aba-bd0f3e0b81e2', // Itoni Olorun
  '5a869338-7546-4f34-84ec-a7a104f851cd', // Filmed In
  '1d87de67-9366-4628-ab75-070a0b11423d', // With Owen Gee
  '277e3189-7595-4737-b769-545bb3a17890', // Clapper Mogaji
  '02727d93-c0ec-4d8c-8f7f-bb1da742b2d7', // Clegane & Caden (CKtwins)
  'ba534c70-83b4-44f6-8168-073c13328d01', // Zaneta Grant & Wanita Fadipe
  '46d6d183-7f65-4084-bd7f-506366d65cb3', // Kuti - Tunde Babalola
  '3ef02339-5455-40b2-8dbf-b9c0b850b554', // Sunday Igboho
  'b380a84a-72e3-400e-90c8-1b10b9de7884', // Richard Mofe (Duplicate shell)
  '170569c3-49db-4e01-8981-1f3786c6aec5', // Enioluwa (Duplicate shell)
  'f8723e08-8fcc-409c-96a7-10d2f7bfc8c4', // Richard Ayodeji Makun (Duplicate shell)
  'dd89f26b-d999-4bb1-ae80-d9942238b925', // Maryam Apaokagi (Duplicate shell)
  '9b138c6a-3908-4bf7-a363-04b250263e0e'  // Waje (Duplicate shell)
];

async function executeCleanup() {
  console.log('=== STEP 1: Deleting 54 confirmed zero-credit mistake records ===');
  const { error: delErr } = await supabase
    .from('people')
    .delete()
    .in('id', CONFIRMED_DELETE_IDS);

  if (delErr) {
    console.error('Delete error:', delErr);
  } else {
    console.log(`Successfully deleted ${CONFIRMED_DELETE_IDS.length} mistake records from people!`);
  }

  console.log('\n=== STEP 2: Correcting Harvester Name Artifacts ===');
  // 1. L. Ben Touitou -> Ben Touitou
  await supabase.from('people').update({ name: 'Ben Touitou' }).eq('id', '1fa91f43-cfa3-40aa-824a-0b9e5e34f0df');
  console.log('Corrected: "L. Ben Touitou" -> "Ben Touitou"');

  // 2. Directorkingsley Iweru -> Kingsley Iweru
  await supabase.from('people').update({ name: 'Kingsley Iweru' }).eq('id', 'd30aa1a3-67c7-49ce-95de-a5f7e685b223');
  console.log('Corrected: "Directorkingsley Iweru" -> "Kingsley Iweru"');

  // 3. Continuity... Segun Oladoye -> Segun Oladoye
  await supabase.from('people').update({ name: 'Segun Oladoye' }).eq('id', '5ba45f37-8750-4e8a-b090-214424340327');
  console.log('Corrected: "Continuity... Segun Oladoye" -> "Segun Oladoye"');

  // 4. Gafferfamous Moses -> Famous Moses
  await supabase.from('people').update({ name: 'Famous Moses' }).eq('id', '638efd01-7de4-4ca2-9220-e6aa0f71a870');
  console.log('Corrected: "Gafferfamous Moses" -> "Famous Moses"');

  // 5. Screenplay... Kolade Segun Okeowo -> Kolade Segun Okeowo
  await supabase.from('people').update({ name: 'Kolade Segun Okeowo' }).eq('id', 'e4c4ae03-9a64-49c4-9164-64cb51ba4e90');
  console.log('Corrected: "Screenplay... Kolade Segun Okeowo" -> "Kolade Segun Okeowo"');

  // 6. WRITTEN BY ADEVINKA ADEGBITE -> Adeyinka Adegbite
  await supabase.from('people').update({ name: 'Adeyinka Adegbite' }).eq('id', 'ee534652-8c44-441c-8f47-74e8e83d784b');
  console.log('Corrected: "WRITTEN BY ADEVINKA ADEGBITE" -> "Adeyinka Adegbite"');

  // 7. WRITTEN BY ANNBOYE OLAWUSI -> Ajiboye Olawusi
  await supabase.from('people').update({ name: 'Ajiboye Olawusi' }).eq('id', '30a9f09e-2f06-4d7d-8d71-6df268ff4b74');
  console.log('Corrected: "WRITTEN BY ANNBOYE OLAWUSI" -> "Ajiboye Olawusi"');

  // Re-link duplicate credit from WRITTEN BY AJIBOYE CLAWUS
  await supabase.from('credits').update({ person_id: '30a9f09e-2f06-4d7d-8d71-6df268ff4b74' }).eq('person_id', 'dc8041ec-caeb-44d2-8be1-8330b01dc88c');
  await supabase.from('people').delete().eq('id', 'dc8041ec-caeb-44d2-8be1-8330b01dc88c');
  console.log('Cleaned and merged "WRITTEN BY AJIBOYE CLAWUS" into "Ajiboye Olawusi"');

  // 8. "Assistant Director" pseudo-person cleanup
  const ASST_DIR_ID = '537c4728-181e-4882-8f1b-cd4720a127ec';
  await supabase.from('credits').delete().eq('person_id', ASST_DIR_ID);
  await supabase.from('people').delete().eq('id', ASST_DIR_ID);
  console.log('Removed "Assistant Director" pseudo-person and its false credit entries');

  console.log('\nAll targeted cleanups and corrections completed successfully!');
}

executeCleanup().catch(console.error);
