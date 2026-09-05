import { describe, expect, it } from 'vitest';
import {
  alignOcrRows,
  consolidateCreditObservations,
  parseCreditFrame,
  parseTesseractTsv,
  type OcrLine,
  type OcrWord,
} from './credit_roll_parser';

function line(top: number, entries: Array<[string, number, number, number?]>): OcrLine {
  const words: OcrWord[] = entries.map(([text, left, width, confidence = 92]) => ({
    text,
    left,
    top,
    width,
    height: 14,
    confidence,
    lineKey: `1.1.1.${top}`,
  }));
  return {
    text: words.map((word) => word.text).join(' '),
    words,
    left: Math.min(...words.map((word) => word.left)),
    top,
    right: Math.max(...words.map((word) => word.left + word.width)),
    bottom: top + 14,
    confidence: words.reduce((sum, word) => sum + word.confidence, 0) / words.length / 100,
  };
}

describe('credit roll layout parser', () => {
  it('pairs separate OCR blocks by baseline and keeps shared characters in the actor column', () => {
    const rows = alignOcrRows([
      line(90, [['CAST', 189, 38]]),
      line(204, [['Susan', 121, 43]]), line(203, [['TERSY', 209, 47], ['AKPATA', 259, 61]]),
      line(243, [['Patrick', 116, 49]]), line(242, [['RAY', 210, 28], ['ADEKA', 243, 53]]),
      line(281, [['Chuddy', 108, 57]]), line(280, [['BRYAN', 210, 51], ['OKOYE', 265, 52]]),
      line(320, [['Neighbor', 98, 67]]), line(319, [['DIANA', 210, 49], ['CHILDS', 264, 53]]),
      line(359, [['Love', 92, 33], ['Birds', 129, 36]]), line(357, [['FUNMI', 210, 49], ['ODUSE', 263, 52]]),
      line(396, [['OLAWALE', 209, 76], ['IBRAHIM', 289, 64]]),
      line(436, [['Handyman', 21, 81], ['NG', 107, 21], ['Rep', 137, 28]]),
      line(435, [['BELLE', 210, 46], ['MARIAM', 260, 62], ['SOROH', 326, 54]]),
    ]);
    const parsed = parseCreditFrame(rows, 1, 1, 100);
    expect(parsed.map((credit) => [credit.name, credit.roleOrCharacter])).toEqual([
      ['Tersy Akpata', 'Susan'], ['Ray Adeka', 'Patrick'], ['Bryan Okoye', 'Chuddy'],
      ['Diana Childs', 'Neighbor'], ['Funmi Oduse', 'Love Birds'], ['Olawale Ibrahim', 'Love Birds'],
      ['Belle Mariam Soroh', 'Handyman NG Rep'],
    ]);
  });

  it('does not turn unresolved cast pairs into names-only Actor entries after a CAST heading', () => {
    const parsed = parseCreditFrame([
      line(80, [['CAST', 189, 38]]),
      line(100, [['Susan', 121, 43], ['TERSY', 209, 47], ['AKPATA', 259, 61]]),
      line(125, [['Patrick', 116, 49], ['RAY', 210, 28], ['ADEKA', 243, 53]]),
      line(150, [['Chuddy', 108, 57], ['BRYAN', 210, 51], ['OKOYE', 265, 52]]),
      line(175, [['Love', 92, 33], ['Birds', 129, 36], ['FUNMIODUSE', 210, 105]]),
      line(200, [['Handyman', 21, 81], ['NG', 107, 21], ['Rep', 137, 28], ['BELLEMARIAMSOROH', 210, 170]]),
    ], 1, 1, 100);
    expect(parsed).toHaveLength(3);
    expect(parsed.some((credit) => /Love Birds|Handyman/.test(credit.name))).toBe(false);
  });

  it('matches complete crew headings before shorter prefixes', () => {
    const parsed = parseCreditFrame([
      line(100, [['SCRIPT', 10, 60], ['SUPERVISOR', 80, 100], ['OKOCHI', 300, 80], ['LAWRENCE', 390, 100]]),
      line(125, [['SOUND', 10, 60], ['RECORDIST', 80, 100], ['EJIKE', 300, 50], ['MBA', 360, 45]]),
      line(150, [['CAMERA', 10, 70], ['ASST', 90, 60], ['ADEWALE', 300, 90], ['ABIODUN', 400, 90]]),
      line(175, [['MAKE', 10, 40], ['UP', 60, 25], ['ARTIST', 95, 60], ['AKUCHIE', 300, 90], ['CHIKODI', 400, 90]]),
    ], 1, 1, 100);
    expect(parsed.map((credit) => [credit.name, credit.roleOrCharacter])).toEqual([
      ['Okochi Lawrence', 'Continuity'], ['Ejike Mba', 'Sound Recordist'],
      ['Adewale Abiodun', 'Camera Assistant'], ['Akuchie Chikodi', 'Makeup'],
    ]);
  });

  it('does not carry a crew role across a blank section when the next heading is unreadable', () => {
    const parsed = parseCreditFrame([
      line(100, [['GAFFER', 100, 75]]),
      line(125, [['OLAWALE', 80, 90], ['IBRAHIM', 180, 90]]),
      line(230, [['BABATUNDE', 60, 110], ['ADELEKE', 180, 90]]),
    ], 1, 1, 100);
    expect(parsed.map((credit) => credit.name)).toEqual(['Olawale Ibrahim']);
  });

  it('preserves OCR punctuation until person-name cleanup removes a parenthetical nickname', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t100\t100\t100\t14\t95\tDIRECTOR',
      '5\t1\t2\t1\t1\t1\t100\t130\t80\t14\t95\tDEMILADE',
      '5\t1\t2\t1\t1\t2\t185\t130\t80\t14\t95\tMEDUOYE',
      '5\t1\t2\t1\t1\t3\t270\t130\t60\t14\t95\t(HENDS)',
    ].join('\n');
    expect(parseCreditFrame(parseTesseractTsv(tsv), 1, 1, 100)[0].name).toBe('Demilade Meduoye');
  });

  it('consolidates swapped and near OCR variants of the same credited name', () => {
    const parsed = consolidateCreditObservations([
      {
        name: 'Adebayo Femi',
        roleOrCharacter: 'Actor',
        creditType: 'actor',
        frameIndex: 1,
        frameSec: 1,
        videoSec: 101,
        ocrConfidence: 0.82,
        evidenceText: 'ADEBAYO FEMI',
        layout: { mode: 'grouped-cast', personBox: [10, 10, 120, 24] },
      },
      {
        name: 'Ferni Adebayo',
        roleOrCharacter: 'Actor',
        creditType: 'actor',
        frameIndex: 2,
        frameSec: 2,
        videoSec: 102,
        ocrConfidence: 0.78,
        evidenceText: 'FERNI ADEBAYO',
        layout: { mode: 'grouped-cast', personBox: [10, 10, 120, 24] },
      },
      {
        name: 'Femi Adebayo',
        roleOrCharacter: 'Actor',
        creditType: 'actor',
        frameIndex: 3,
        frameSec: 3,
        videoSec: 103,
        ocrConfidence: 0.94,
        evidenceText: 'FEMI ADEBAYO',
        layout: { mode: 'grouped-cast', personBox: [10, 10, 120, 24] },
      },
      {
        name: 'Femi Adebayo',
        roleOrCharacter: 'Actor',
        creditType: 'actor',
        frameIndex: 4,
        frameSec: 4,
        videoSec: 104,
        ocrConfidence: 0.91,
        evidenceText: 'FEMI ADEBAYO',
        layout: { mode: 'grouped-cast', personBox: [10, 10, 120, 24] },
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      name: 'Femi Adebayo',
      roleOrCharacter: 'Actor',
      creditType: 'actor',
      frameSupport: 4,
    });
  });

  it('separates characters from actors in a repeated two-column cast card', () => {
    const lines = [
      line(100, [['CAST', 400, 55]]),
      line(130, [['AGNES', 343, 58], ['DESTINY', 433, 77], ['ETIKO', 517, 55]]),
      line(155, [['KATE', 355, 46], ['CHINENYE', 432, 95], ['NNEBE', 533, 59]]),
      line(180, [['FRANK', 342, 58], ['NOHMI', 433, 63], ['GEORGE', 503, 74]]),
      line(205, [['DOCTOR', 325, 75], ['LORENTTA', 433, 95], ['IGBINIGE', 536, 82]]),
    ];

    const parsed = parseCreditFrame(lines, 32, 96, 4_296);
    expect(parsed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Destiny Etiko',
        roleOrCharacter: 'Agnes',
        creditType: 'actor',
      }),
      expect.objectContaining({
        name: 'Nohmi George',
        roleOrCharacter: 'Frank',
        creditType: 'actor',
      }),
    ]));
    expect(parsed).toHaveLength(4);
    expect(parsed.every((credit) => credit.layout.mode === 'two-column-cast')).toBe(true);
  });

  it('separates actors from characters when actor names are in the left column', () => {
    const lines = [
      line(100, [['CAST', 400, 55]]),
      line(130, [['TAIWO', 255, 62], ['IBIKUNLE', 326, 88], ['PRINCIPAL', 548, 92], ['AKINLOLU', 650, 91]]),
      line(155, [['LAIDE', 252, 58], ['BAKARE', 321, 76], ['MADAM', 548, 72], ['RANTI', 631, 64]]),
      line(180, [['YEMI', 258, 55], ['BLAQ', 322, 50], ['POLICE', 548, 68], ['OFFICER', 625, 78]]),
      line(205, [['BAYO', 258, 55], ['BANKOLE', 322, 82], ['DOCTOR', 548, 75]]),
    ];

    const parsed = parseCreditFrame(lines, 33, 33, 4_233);
    expect(parsed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Taiwo Ibikunle',
        roleOrCharacter: 'Principal Akinlolu',
        creditType: 'actor',
      }),
      expect.objectContaining({
        name: 'Laide Bakare',
        roleOrCharacter: 'Madam Ranti',
        creditType: 'actor',
      }),
      expect.objectContaining({
        name: 'Yemi Blaq',
        roleOrCharacter: 'Police Officer',
        creditType: 'actor',
      }),
    ]));
    expect(parsed).toHaveLength(4);
    expect(parsed.every((credit) => credit.layout.mode === 'two-column-cast')).toBe(true);
  });

  it('treats role headings as roles and following lines as crew names', () => {
    const lines = [
      line(100, [['CREW', 408, 61]]),
      line(130, [['MAKE', 405, 45], ['UP', 457, 28]]),
      line(155, [['EZE', 381, 38], ['COLLETTE', 426, 83]]),
      line(180, [['PRODUCTION', 330, 120], ['ASSISTANTS', 457, 103]]),
      line(205, [['CHINEMEREM', 347, 118], ['AWOKE', 472, 70]]),
      line(230, [['KINGSLEY', 374, 78], ['OBIDI', 460, 55]]),
      line(255, [['SUBTITLER', 392, 100]]),
      line(280, [['ADA', 390, 42], ['EZE', 440, 38]]),
    ];

    const parsed = parseCreditFrame(lines, 47, 141, 4_341);
    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Eze Collette', roleOrCharacter: 'Makeup', creditType: 'crew' },
      { name: 'Chinemerem Awoke', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Kingsley Obidi', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Ada Eze', roleOrCharacter: 'Subtitler', creditType: 'crew' },
    ]);
  });

  it('never emits role labels or short OCR fragments as people', () => {
    const lines = [
      line(100, [['PRODUCER', 397, 96]]),
      line(130, [['SA', 380, 25], ['DE', 415, 25], ['EACH', 450, 50]]),
      line(160, [['EXECUTIVE', 344, 100], ['PRODUCER', 451, 96]]),
      line(190, [['DESTINY', 376, 77], ['ETIKO', 460, 55]]),
    ];

    const parsed = parseCreditFrame(lines, 56, 168, 4_368);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      name: 'Destiny Etiko',
      roleOrCharacter: 'Executive Producer',
      creditType: 'crew',
    });
  });

  it('parses vertical extras lists as actors, not crew', () => {
    const parsed = parseCreditFrame([
      line(100, [['EXTRAS', 405, 78]]),
      line(130, [['EZE', 381, 38], ['COLLETTE', 426, 83]]),
      line(155, [['CHIDERA', 370, 75], ['ABBADAVID', 452, 92]]),
      line(180, [['CREW', 408, 61]]),
      line(205, [['CAMERA', 385, 72], ['TECH', 464, 50]]),
      line(230, [['IBRAHIM', 370, 74], ['ABDULAZEEZ', 451, 104]]),
    ], 40, 120, 4_320);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Eze Collette', roleOrCharacter: 'Extra', creditType: 'actor' },
      { name: 'Chidera Abbadavid', roleOrCharacter: 'Extra', creditType: 'actor' },
      { name: 'Ibrahim Abdulazeez', roleOrCharacter: 'Camera Technician', creditType: 'crew' },
    ]);
  });

  it('parses stacked character-group cast cards and does not emit headings as actors', () => {
    const parsed = parseCreditFrame([
      line(100, [['FOLA\'S', 180, 78], ['FRIEND', 272, 90]]),
      line(135, [['GBEMISOLA', 190, 110], ['ANJOLA', 312, 76]]),
      line(160, [['BUKOLA', 190, 76], ['ELUTIPE', 278, 82]]),
      line(185, [['OLATUNDE', 190, 96], ['OPEYEMI', 300, 92]]),
      line(210, [['ESTHER', 190, 72], ['SANTOS', 272, 76]]),
      line(235, [['OLUWASEUN', 190, 110], ['AYOOLA', 312, 78]]),
      line(285, [['OLOSHO\'S', 190, 100]]),
      line(325, [['TOSIN', 190, 66], ['IPINLAYE', 268, 88]]),
      line(350, [['NWORIE', 190, 72], ['CYTHIA', 272, 72]]),
      line(375, [['ALIYAH', 190, 76], ['MAJEK', 276, 65]]),
      line(425, [['EXTRAS', 190, 78]]),
      line(465, [['ABISOYE', 190, 82], ['NINOLA', 282, 74]]),
      line(490, [['TOSIN', 190, 66], ['AKINSIKUN', 268, 94]]),
    ], 44, 44, 2_044);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Gbemisola Anjola', roleOrCharacter: 'Fola\'s Friend', creditType: 'actor' },
      { name: 'Bukola Elutipe', roleOrCharacter: 'Fola\'s Friend', creditType: 'actor' },
      { name: 'Olatunde Opeyemi', roleOrCharacter: 'Fola\'s Friend', creditType: 'actor' },
      { name: 'Esther Santos', roleOrCharacter: 'Fola\'s Friend', creditType: 'actor' },
      { name: 'Oluwaseun Ayoola', roleOrCharacter: 'Fola\'s Friend', creditType: 'actor' },
      { name: 'Tosin Ipinlaye', roleOrCharacter: 'Olosho\'s', creditType: 'actor' },
      { name: 'Nworie Cythia', roleOrCharacter: 'Olosho\'s', creditType: 'actor' },
      { name: 'Aliyah Majek', roleOrCharacter: 'Olosho\'s', creditType: 'actor' },
      { name: 'Abisoye Ninola', roleOrCharacter: 'Extra', creditType: 'actor' },
      { name: 'Tosin Akinsikun', roleOrCharacter: 'Extra', creditType: 'actor' },
    ]);
    expect(parsed.some((credit) => credit.name === 'Fola\'s Friend')).toBe(false);
    expect(parsed.some((credit) => credit.name === 'Olosho\'s')).toBe(false);
  });

  it('rejects subtitle-like two-column dialogue even when OCR sees repeated gaps', () => {
    const parsed = parseCreditFrame([
      line(100, [['I', 260, 12], ['NEED', 510, 54], ['YOU', 574, 42]]),
      line(125, [['PLEASE', 220, 70], ['FORGIVE', 510, 82], ['ME', 604, 28]]),
      line(150, [['WHY', 258, 48], ['ARE', 510, 42], ['YOU', 562, 42]]),
      line(175, [['THIS', 252, 52], ['IS', 510, 22], ['NOT', 544, 38]]),
    ], 45, 45, 2_045);

    expect(parsed).toEqual([]);
  });

  it('parses plain cast, supporting cast, and special appearance sections as actors', () => {
    const parsed = parseCreditFrame([
      line(100, [['CAST', 405, 55]]),
      line(130, [['YEMI', 370, 55], ['BLAQ', 435, 50]]),
      line(155, [['SUPPORTING', 332, 105], ['CAST', 446, 55]]),
      line(180, [['JIDE', 370, 48], ['KOSOKO', 428, 74]]),
      line(205, [['SPECIAL', 302, 78], ['APPEARANCE', 390, 118]]),
      line(230, [['SOLA', 358, 48], ['SOBOWALE', 416, 94]]),
      line(255, [['CREW', 408, 61]]),
      line(280, [['DIRECTOR', 385, 90]]),
      line(305, [['KUNLE', 370, 64], ['AFOLAYAN', 444, 92]]),
    ], 42, 42, 4_242);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Yemi Blaq', roleOrCharacter: 'Actor', creditType: 'actor' },
      { name: 'Jide Kosoko', roleOrCharacter: 'Supporting Cast', creditType: 'actor' },
      { name: 'Sola Sobowale', roleOrCharacter: 'Special Appearance', creditType: 'actor' },
      { name: 'Kunle Afolayan', roleOrCharacter: 'Director', creditType: 'crew' },
    ]);
  });

  it('parses misspelled extras headings with two-column names-only lists', () => {
    const parsed = parseCreditFrame([
      line(100, [['SCHOOL', 362, 88], ['EXTARS', 462, 88]]),
      line(130, [['UCHE', 245, 58], ['UGOCHI', 314, 78], ['CHINNY', 548, 78], ['AUSTINE', 638, 88]]),
      line(155, [['GODWIN', 236, 82], ['NAACY', 329, 68], ['CARITAS', 548, 88], ['LINDA', 646, 62]]),
      line(180, [['QUEEN', 251, 75], ['RICHARD', 338, 86], ['CHUKWU', 548, 86], ['MIRABEL', 646, 86]]),
      line(205, [['OKWUNWE', 231, 94], ['CEEC', 337, 58], ['BENEDICT', 548, 94], ['BLESSING', 652, 94]]),
      line(230, [['ADANNA', 236, 82], ['RICHARD', 329, 86], ['UGOCHUKWU', 548, 118], ['VICTORIA', 678, 86]]),
      line(255, [['It\'s', 240, 30], ['so', 280, 22], ['insane', 314, 66], ['I', 392, 10], ['really', 414, 60], ['try', 486, 32]]),
    ], 52, 252, 6_781);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Uche Ugochi', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Chinny Austine', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Godwin Naacy', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Caritas Linda', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Queen Richard', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Chukwu Mirabel', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Okwunwe Ceec', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Benedict Blessing', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Adanna Richard', roleOrCharacter: 'School Extra', creditType: 'actor' },
      { name: 'Ugochukwu Victoria', roleOrCharacter: 'School Extra', creditType: 'actor' },
    ]);
  });

  it('splits merged actor and character text on grouped cast cards', () => {
    const parsed = parseCreditFrame([
      line(100, [['CAST', 405, 55]]),
      line(130, [['CHRISTABEL', 245, 112], ['EKEH', 365, 55], ['Ndidi', 428, 62]]),
      line(155, [['PRINCE', 252, 74], ['NWAFOR', 336, 84], ['Ojo', 428, 40]]),
      line(180, [['ONYEKA', 245, 78], ['EZEJIOFOR', 334, 112], ['Doctor', 454, 70], ['2', 532, 16]]),
    ], 53, 253, 6_782);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Christabel Ekeh', roleOrCharacter: 'Ndidi', creditType: 'actor' },
      { name: 'Prince Nwafor', roleOrCharacter: 'Ojo', creditType: 'actor' },
      { name: 'Onyeka Ezejiofor', roleOrCharacter: 'Doctor 2', creditType: 'actor' },
    ]);
  });

  it('parses two-column crew names under a crew role heading', () => {
    const parsed = parseCreditFrame([
      line(100, [['CREW', 408, 61]]),
      line(130, [['PRODUCTION', 330, 120], ['ASSISTANTS', 457, 103]]),
      line(155, [['CHINEMEREM', 236, 118], ['AWOKE', 364, 70], ['KINGSLEY', 548, 88], ['OBIDI', 646, 64]]),
      line(180, [['BLESSING', 246, 94], ['OKAFOR', 352, 78], ['UCHE', 548, 58], ['NWACHUKWU', 616, 112]]),
      line(205, [['MAKE', 405, 45], ['UP', 457, 28]]),
      line(230, [['EZE', 381, 38], ['COLLETTE', 426, 83]]),
    ], 54, 254, 6_783);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Chinemerem Awoke', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Kingsley Obidi', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Blessing Okafor', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Uche Nwachukwu', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Eze Collette', roleOrCharacter: 'Makeup', creditType: 'crew' },
    ]);
  });

  it('parses Royal Arts-style crew cards without accepting watermarks or companies', () => {
    const parsed = parseCreditFrame([
      line(100, [['CREW', 408, 61]]),
      line(130, [['EXECUTIVE', 350, 100], ['PRODUCER', 458, 96]]),
      line(155, [['DIANA', 374, 62], ['CHILDS', 446, 72]]),
      line(180, [['DIRECTOR', 385, 90]]),
      line(205, [['OLAIDE', 245, 78], ['ABRAHAM', 335, 100], ['CROSS', 447, 70], ['AYODELE', 529, 88]]),
      line(230, [['STORY/SCREENPLAY', 330, 170]]),
      line(255, [['DIANA', 374, 62], ['CHILDS', 446, 72]]),
      line(280, [['ASSISTANT', 345, 102], ['DIRECTOR', 457, 90]]),
      line(305, [['DEMILADE', 252, 98], ['MEDUOYE', 360, 92], ['(HENDS)', 462, 82]]),
      line(330, [['PROPS', 354, 66], ['ASSISTANT', 430, 102]]),
      line(355, [['MATTHEW', 238, 96], ['JAMES', 344, 68], ['GODSPOWER', 424, 118]]),
      line(380, [['1st', 402, 35], ['Ac', 446, 28]]),
      line(405, [['EZEKIEL', 354, 84], ['ENIOLA', 448, 74]]),
      line(430, [['BOOM', 354, 62], ['OPERATOR', 426, 98]]),
      line(455, [['OJUKWU', 396, 78]]),
      line(480, [['HOD', 294, 42], ['HAIR', 345, 54], ['AND', 408, 44], ['MAKEUP', 462, 82]]),
      line(505, [['GRACE', 370, 70], ['ANYIM', 450, 64]]),
      line(530, [['ROYALARTS', 312, 122], ['T', 446, 16]]),
      line(555, [['MAKE', 323, 56], ['UP', 389, 28], ['ASSISTANT', 428, 102]]),
      line(580, [['IFETOMIWA', 320, 108], ['ADEBAYO', 438, 92]]),
      line(605, [['POST', 360, 56], ['PRODUCTION', 426, 120]]),
      line(630, [['THE7EVENTH', 326, 132], ['STUDIO', 470, 76]]),
    ], 55, 255, 6_784);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Diana Childs', roleOrCharacter: 'Executive Producer', creditType: 'crew' },
      { name: 'Olaide Abraham Cross Ayodele', roleOrCharacter: 'Director', creditType: 'crew' },
      { name: 'Diana Childs', roleOrCharacter: 'Story/Screenplay', creditType: 'crew' },
      { name: 'Demilade Meduoye', roleOrCharacter: 'Assistant Director', creditType: 'crew' },
      { name: 'Matthew James Godspower', roleOrCharacter: 'Props Assistant', creditType: 'crew' },
      { name: 'Ezekiel Eniola', roleOrCharacter: 'First Assistant Camera', creditType: 'crew' },
      { name: 'Ojukwu', roleOrCharacter: 'Boom Operator', creditType: 'crew' },
      { name: 'Grace Anyim', roleOrCharacter: 'Head of Hair and Makeup', creditType: 'crew' },
      { name: 'Ifetomiwa Adebayo', roleOrCharacter: 'Assistant Makeup', creditType: 'crew' },
    ]);
    expect(parsed.some((credit) => /Royal|Studio|The7/i.test(credit.name))).toBe(false);
  });

  it('parses sparse-text crew OCR when normal OCR misses small headings', () => {
    const parsed = parseCreditFrame([
      line(100, [['GAFFER', 400, 70]]),
      line(125, [['OLAWALE', 350, 88], ['IBRAHIM', 448, 82]]),
      line(150, [['BEST', 386, 52], ['BOY', 448, 42]]),
      line(175, [['BABATUNDE', 326, 112], ['ADELEKE', 450, 86]]),
      line(200, [['SCRIPT', 362, 74], ['SUPERVISOR', 446, 114]]),
      line(225, [['ATTAH', 306, 66], ['AYEGBA', 382, 82], ['VICTOR', 474, 74]]),
      line(250, [['PRODUCTION', 284, 120], ['CORDINATOR', 414, 112]]),
      line(275, [['ABASS', 255, 68], ['ADEKUNLE', 333, 102], ['GBOLAHAN', 445, 106]]),
      line(300, [['PRODUCTION', 318, 120], ['ASSISTANT', 448, 102]]),
      line(325, [['AYOMIDE', 346, 90], ['ADEWALE', 446, 88]]),
      line(350, [['POST', 354, 56], ['PRODUCTION', 420, 120]]),
      line(375, [['THE7EVENTH', 326, 132], ['STUDIO', 470, 76]]),
      line(400, [['EDITOR', 398, 70]]),
      line(425, [['JOSHUA', 344, 78], ['CASSIDY', 432, 84]]),
      line(450, [['ROYAL', 292, 70], ['ARTS', 374, 54], ['TV', 438, 28]]),
      line(475, [['SOUND', 400, 70]]),
      line(500, [['DIM', 382, 40], ['SINCLAIR', 432, 90]]),
      line(525, [['RENTAL', 398, 72]]),
      line(550, [['KMINDS', 354, 82], ['RENTALS', 446, 86]]),
    ], 56, 256, 6_785);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Olawale Ibrahim', roleOrCharacter: 'Gaffer', creditType: 'crew' },
      { name: 'Babatunde Adeleke', roleOrCharacter: 'Best Boy', creditType: 'crew' },
      { name: 'Attah Ayegba Victor', roleOrCharacter: 'Continuity', creditType: 'crew' },
      { name: 'Abass Adekunle Gbolahan', roleOrCharacter: 'Production Coordinator', creditType: 'crew' },
      { name: 'Ayomide Adewale', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Joshua Cassidy', roleOrCharacter: 'Editor', creditType: 'crew' },
      { name: 'Dim Sinclair', roleOrCharacter: 'Sound', creditType: 'crew' },
    ]);
    expect(parsed.some((credit) => /Royal|Studio|Rental/i.test(credit.name))).toBe(false);
  });

  it('does not invert title-case character labels when OCR compacts the actor name', () => {
    const parsed = parseCreditFrame([
      line(100, [['Susan', 142, 54], ['TERSY', 316, 60], ['AKPATA', 388, 72]]),
      line(125, [['Patrick', 126, 72], ['RAY', 318, 42], ['ADEKA', 370, 62]]),
      line(150, [['Chuddy', 132, 72], ['BRYAN', 318, 70], ['OKOYE', 400, 70]]),
      line(175, [['Love', 118, 52], ['Birds', 180, 58], ['FUNMIODUSE', 318, 126]]),
    ], 57, 257, 6_786);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Tersy Akpata', roleOrCharacter: 'Susan', creditType: 'actor' },
      { name: 'Ray Adeka', roleOrCharacter: 'Patrick', creditType: 'actor' },
      { name: 'Bryan Okoye', roleOrCharacter: 'Chuddy', creditType: 'actor' },
    ]);
    expect(parsed.some((credit) => credit.name === 'Love Birds')).toBe(false);
  });

  it('parses dotted-leader cast cards even when OCR misses the cast heading', () => {
    const parsed = parseCreditFrame([
      line(100, [['RAYMOND.....osseseueuennESO', 105, 199, 0], ['DIKE', 310, 32]]),
      line(125, [['JANE\'S', 104, 49], ['BOYFRIEND.......IGUNWE', 158, 172, 48], ['ALFRED', 334, 57, 61]]),
      line(150, [['DETECTIVE', 105, 80], ['1.....scseeneeCHUKWU', 191, 144, 0], ['FRANCIS', 341, 62]]),
      line(175, [['DETECTIVE', 105, 80], ['2.....eaeseaenCHIEKE', 190, 134, 0], ['DONALD', 330, 59]]),
      line(200, [['BARRISTER.........:.s:e-BRIGHT', 105, 222, 0], ['OMOREGIE', 331, 79, 69]]),
      line(225, [['GATEMAN.', 104, 70, 42], ['......sseseseeeeD', 180, 66, 0], ['ESMOND', 261, 85], ['ANYANWU.', 350, 72, 66]]),
      line(250, [['MAN.', 105, 30, 60], ['.ssssstststsnseseeeeAKANNO', 142, 189, 0], ['CHIMEZIE', 336, 68], ['FERDINARD', 410, 83]]),
    ], 58, 258, 6_787);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Eso Dike', roleOrCharacter: 'Raymond', creditType: 'actor' },
      { name: 'Igunwe Alfred', roleOrCharacter: 'Jane\'s Boyfriend', creditType: 'actor' },
      { name: 'Chukwu Francis', roleOrCharacter: 'Detective 1', creditType: 'actor' },
      { name: 'Chieke Donald', roleOrCharacter: 'Detective 2', creditType: 'actor' },
      { name: 'Bright Omoregie', roleOrCharacter: 'Barrister', creditType: 'actor' },
      { name: 'Esmond Anyanwu', roleOrCharacter: 'Gateman', creditType: 'actor' },
      { name: 'Akanno Chimezie Ferdinard', roleOrCharacter: 'Man', creditType: 'actor' },
    ]);
  });

  it('parses dotted-leader crew cards and rejects company-like assignees', () => {
    const parsed = parseCreditFrame([
      line(100, [['STORYISCREENPLAY......0:sseenneneeeMIRIAM', 10, 270, 70], ['OGBONNA', 285, 86]]),
      line(125, [['SCRIPT', 10, 70], ['SUPERVISOR.......:.nssssenneeeOKOCHI', 92, 265, 70], ['|.', 365, 14], ['LAWERNCE', 385, 88]]),
      line(150, [['SOUND', 10, 68], ['RECORDIST......sssesuneeEJIKE', 88, 252, 75], ['MBA', 350, 42], ['(HOMEBOY)', 402, 96]]),
      line(175, [['MAKE', 10, 55], ['-', 72, 8], ['UP', 88, 28], ['ARTIST......sssnssessennennesAKUCHIE', 124, 286, 70], ['CHIKODI', 418, 82]]),
      line(200, [['WARDROBE', 10, 100], ['DESIGNER.......:.esssneUK,', 122, 238, 70], ['CONCEPT', 368, 88], ['12', 466, 24]]),
      line(225, [['D.O.P\'s..................EMEKA', 10, 250, 70], ['EZEMONYE', 270, 92]]),
      line(250, [['sessesessssstiniianssnsestestseeesssssned', 10, 265, 0], ['CHIDOMERE', 284, 108], ['.B.', 402, 22], ['OBINNA', 434, 76], ['(C.S.N)', 520, 70]]),
      line(275, [['CAMERA', 10, 76], ['ASST....:ssnsseennennADEWALE', 98, 245, 70], ['ABIODUN', 352, 84]]),
      line(300, [['STILL', 10, 54], ['-', 72, 8], ['PHOTO....snsnsstsnnnnseennEMZY', 88, 280, 70], ['DIRECTION', 380, 96]]),
      line(325, [['PRODUCTION', 10, 120], ['ASST', 140, 45], ['1.....essnsneesneOMOTAYO', 194, 220, 70], ['SAMUEL', 424, 76]]),
      line(350, [['ASST', 194, 45], ['2................JOHN', 248, 160, 70], ['ABUA', 418, 54]]),
      line(375, [['PRODUCTION', 10, 120], ['MANAGER......s::snseneAKANNO', 140, 270, 70], ['CHIMEZIE', 420, 92], ['FERDINARD', 522, 102]]),
      line(400, [['ART', 10, 42], ['DIRECTOR.....csennnssessnseeOKORO', 64, 280, 70], ['IFEBUCHE', 354, 92], ['(LILY', 456, 48], ['FLOWER)', 512, 78]]),
      line(425, [['WELFARE', 10, 84], ['MANAGER......r.sessensenneCOMFORTABLE', 104, 300, 70], ['ZONE', 414, 54]]),
      line(450, [['EDITOR...nnnssnennsnasnnsnneinsenseeeNWAOGU', 10, 350, 70], ['EMMANUEL', 370, 100], ['(YOUNGMASTER)', 482, 130]]),
      line(475, [['ASSISTANTS....scssnssnsnnsnsnsseNWAOGU', 10, 330, 70], ['JOHNPAUL', 350, 94], ['(PATORCHIZZY)', 454, 124]]),
      line(500, [['sessesessssstiniianssnsestestseeesssssned', 10, 265, 0], ['KWUEGBU', 284, 88], ['CHISOM', 382, 76], ['CYNTHIA', 468, 84], ['(SUNSHINE)', 560, 100]]),
      line(525, [['ssoseesseannaennsessen', 10, 160, 0], ['CHINONSOBLACK', 180, 150], ['AGU.', 340, 45]]),
      line(550, [['SOUND', 10, 68], ['TRACK....nnsssnnnsnnnneKANIFE', 88, 270, 70], ['UDOCHUKWU', 368, 112], ['WEST', 490, 52], ['(UD)', 552, 40]]),
      line(575, [['PRODUCER..w.sns:nsennsnnnnsenseesnn', 10, 320, 70], ['SOLOMON', 342, 86], ['APETE', 438, 66]]),
      line(600, [['EXECUTIVE', 10, 108], ['PRODUCER......n.seuMERCY', 128, 240, 70], ['JOHNSON', 378, 86], ['OKOJIE', 474, 74]]),
      line(625, [['DIRECTOR....nsssnssnsenenssesenseeee', 10, 320, 70], ['ESMOND', 342, 84], ['ANYANWU', 436, 88]]),
    ], 59, 259, 6_788);

    expect(parsed.map(({ name, roleOrCharacter, creditType }) => ({
      name,
      roleOrCharacter,
      creditType,
    }))).toEqual([
      { name: 'Miriam Ogbonna', roleOrCharacter: 'Story/Screenplay', creditType: 'crew' },
      { name: 'Okochi I Lawernce', roleOrCharacter: 'Continuity', creditType: 'crew' },
      { name: 'Ejike Mba', roleOrCharacter: 'Sound Recordist', creditType: 'crew' },
      { name: 'Akuchie Chikodi', roleOrCharacter: 'Makeup', creditType: 'crew' },
      { name: 'Emeka Ezemonye', roleOrCharacter: 'Director of Photography', creditType: 'crew' },
      { name: 'Chidomere B Obinna', roleOrCharacter: 'Director of Photography', creditType: 'crew' },
      { name: 'Adewale Abiodun', roleOrCharacter: 'Camera Assistant', creditType: 'crew' },
      { name: 'Omotayo Samuel', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'John Abua', roleOrCharacter: 'Production Assistant', creditType: 'crew' },
      { name: 'Akanno Chimezie Ferdinard', roleOrCharacter: 'Production Manager', creditType: 'crew' },
      { name: 'Okoro Ifebuche', roleOrCharacter: 'Art Director', creditType: 'crew' },
      { name: 'Nwaogu Emmanuel', roleOrCharacter: 'Editor', creditType: 'crew' },
      { name: 'Nwaogu Johnpaul', roleOrCharacter: 'Assistant', creditType: 'crew' },
      { name: 'Kwuegbu Chisom Cynthia', roleOrCharacter: 'Assistant', creditType: 'crew' },
      { name: 'Chinonsoblack Agu', roleOrCharacter: 'Assistant', creditType: 'crew' },
      { name: 'Kanife Udochukwu West', roleOrCharacter: 'Soundtrack', creditType: 'crew' },
      { name: 'Solomon Apete', roleOrCharacter: 'Producer', creditType: 'crew' },
      { name: 'Mercy Johnson Okojie', roleOrCharacter: 'Executive Producer', creditType: 'crew' },
      { name: 'Esmond Anyanwu', roleOrCharacter: 'Director', creditType: 'crew' },
    ]);
    expect(parsed.some((credit) => /Concept|Direction|Comfortable Zone/i.test(credit.name))).toBe(false);
  });

  it('requires repeated frame support downstream and merges tiny OCR variants', () => {
    const base = parseCreditFrame([
      line(100, [['CAST', 400, 55]]),
      line(130, [['DOCTOR', 325, 75], ['LORENTTA', 433, 95], ['IGBINIGE', 536, 82]]),
      line(155, [['AGNES', 343, 58], ['DESTINY', 433, 77], ['ETIKO', 517, 55]]),
      line(180, [['KATE', 355, 46], ['CHINENYE', 432, 95], ['NNEBE', 533, 59]]),
    ], 1, 3, 4_203);
    const repeat = parseCreditFrame([
      line(100, [['CAST', 400, 55]]),
      line(130, [['DOCTOR', 325, 75], ['LORENTTA', 433, 95], ['IGBINIGIE', 536, 89]]),
      line(155, [['AGNES', 343, 58], ['DESTINY', 433, 77], ['ETIKO', 517, 55]]),
      line(180, [['KATE', 355, 46], ['CHINENYE', 432, 95], ['NNEBE', 533, 59]]),
    ], 2, 6, 4_206);

    const consolidated = consolidateCreditObservations([...base, ...repeat]);
    const lorentta = consolidated.find((credit) => credit.name.startsWith('Lorentta'));
    expect(lorentta?.frameSupport).toBe(2);
    expect(consolidated.filter((credit) => credit.name.startsWith('Lorentta'))).toHaveLength(1);
  });
});
