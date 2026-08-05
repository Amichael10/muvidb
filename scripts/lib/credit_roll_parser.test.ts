import { describe, expect, it } from 'vitest';
import {
  consolidateCreditObservations,
  parseCreditFrame,
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
