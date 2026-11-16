import fs from 'fs';
import path from 'path';

type SongSeed = {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  energyLevel: 'chill' | 'medium' | 'high';
  tags?: string[];
};

const SEED_TRACKS: SongSeed[] = [
  // CULTURAL / HIGHLIFE / INDIGENOUS TRADITIONAL / YORUBA / IGBO / FOLK
  { title: 'Selense', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Osondu', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Anita', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Me You I', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Bolo Bolo', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Teach Me How To Love', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Awele', artist: 'Flavour & Umu Obiligbo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Ada Ada', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Game Changer (Dike)', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Big Baller', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Levels', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Doings', artist: 'Flavour & Phyno', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Culture', artist: 'Umu Obiligbo & Flavour & Phyno', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Chisom', artist: 'Umu Obiligbo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Iyamu', artist: 'Umu Obiligbo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Osondi Owendi', artist: 'Osita Osadebe', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Makojo', artist: 'Chief Stephen Osita Osadebe', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Identity', artist: 'Oliver De Coque', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Ka Anyi Bilie', artist: 'Oliver De Coque', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Guitar Boy', artist: 'Sir Victor Uwaifo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Joromi', artist: 'Sir Victor Uwaifo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Ja Funmi', artist: 'King Sunny Ade', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Synchro System', artist: 'King Sunny Ade', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Ariya', artist: 'King Sunny Ade', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Merciful God', artist: 'King Sunny Ade', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Aimasiko', artist: 'Ebenezer Obey', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'The Horse, The Man and His Son', artist: 'Ebenezer Obey', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Ade Ori Okin', artist: 'K1 De Ultimate', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Awade', artist: 'K1 De Ultimate', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Omo Naija', artist: 'K1 De Ultimate', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Seven Souls', artist: 'Beautiful Nubia', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Owuro L\'ojo', artist: 'Beautiful Nubia', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'What a Feeling', artist: 'Beautiful Nubia', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Jangbalajugbu', artist: 'Beautiful Nubia', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Ara', artist: 'Brymo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Good Morning', artist: 'Brymo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Olanrewaju', artist: 'Brymo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Banuso', artist: 'Brymo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Alajo Somolu', artist: 'Brymo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Prick No Get Shoulder', artist: 'Brymo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Fire On The Mountain', artist: 'Asa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Jailer', artist: 'Asa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Bibanke', artist: 'Asa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Eye Adaba', artist: 'Asa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Dead Again', artist: 'Asa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'The One That Never Comes', artist: 'Asa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Eji Owuro', artist: 'Sola Allyson', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Ayanmo', artist: 'Sola Allyson', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Yoga', artist: 'Asake', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },

  // NOLLYWOOD SOUNDTRACK & CLASSIC CINEMA
  { title: 'Billionaire (Happy Day)', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Money Power', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Fine Lady', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Cast Aside', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'I Go Pay', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Nyash Na Nyash', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Iyawo Mi', artist: 'Timi Dakolo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Great Nation', artist: 'Timi Dakolo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'The Vow', artist: 'Timi Dakolo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Wish Me Well', artist: 'Timi Dakolo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Ordinary People', artist: 'Cobhams Asuquo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'We Plenti', artist: 'Cobhams Asuquo & Simi', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Motherland', artist: 'Sound Sultan', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Area', artist: 'Sound Sultan', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },

  // CINEMATIC THRILLER / SUSPENSE / ACTION / CRIME
  { title: 'FIREGUN', artist: 'ODUMODUBLVCK & Fireboy DML', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Declan Rice', artist: 'ODUMODUBLVCK', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Blood On The Dance Floor', artist: 'ODUMODUBLVCK, Bloody Civilian & Wale', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Dog Eat Dog II', artist: 'ODUMODUBLVCK, Cruel Santino & Bella Shmurda', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'OZEBA', artist: 'Rema', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Heis', artist: 'Rema', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'March Am', artist: 'Rema', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Benin Boys', artist: 'Rema & Shallipopi', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Basquiat', artist: 'Asake', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Gbona', artist: 'Burna Boy', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Monster You Made', artist: 'Burna Boy & Chris Martin', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Kilometre', artist: 'Burna Boy', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Kwaku the Traveller', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Konongo Zongo', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Oil in My Head', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },

  // ROMANCE & DRAMA
  { title: 'Running (To You)', artist: 'Chike & Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Roju', artist: 'Chike', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Hard to Find', artist: 'Chike & Flavour', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Forgive', artist: 'Chike', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Spell', artist: 'Chike & Oxlade', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Believe Me', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'How Are You (My Friend)', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Count On You', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Wait for Me', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Romeo & Juliet', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Duduke', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Joromi', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Lovin', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Smile For Me', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Sade', artist: 'Adekunle Gold', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Orente', artist: 'Adekunle Gold', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Before You Wake Up', artist: 'Adekunle Gold', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Jealous', artist: 'Fireboy DML', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Need You', artist: 'Fireboy DML', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Like I Do', artist: 'Fireboy DML', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Tattoo', artist: 'Fireboy DML', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Love Nwantiti', artist: 'CKay', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Emiliana', artist: 'CKay', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Free Mind', artist: 'Tems', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Me & U', artist: 'Tems', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Love Me JeJe', artist: 'Tems', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Damages', artist: 'Tems', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },

  // UPBEAT / BOX OFFICE / CELEBRATION / PARTY
  { title: 'Lonely At The Top', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Active', artist: 'Asake & Travis Scott', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'MMS', artist: 'Asake & Wizkid', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Remember', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: '2:30', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Joha', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Sungba (Remix)', artist: 'Asake & Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Unavailable', artist: 'Davido & Musa Keys', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Feel', artist: 'Davido', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Awuke', artist: 'Davido & YG Marley', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Kante', artist: 'Davido & Fave', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Sensational', artist: 'Chris Brown, Davido & Lojay', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Buga', artist: 'Kizz Daniel & Tekno', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Cough (Odo)', artist: 'Kizz Daniel', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Twe Twe', artist: 'Kizz Daniel & Davido', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Showa', artist: 'Kizz Daniel', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'City Boys', artist: 'Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'It\'s Plenty', artist: 'Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Ye', artist: 'Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Calm Down', artist: 'Rema', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Charm', artist: 'Rema', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Soundgasm', artist: 'Rema', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Rush', artist: 'Ayra Starr', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Commas', artist: 'Ayra Starr', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Sability', artist: 'Ayra Starr', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Santa', artist: 'Rvssian, Rauw Alejandro & Ayra Starr', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Soso', artist: 'Omah Lay', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Holy Ghost', artist: 'Omah Lay', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Reason', artist: 'Omah Lay', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'chill' },
  { title: 'Mnike', artist: 'Tyler ICU', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },
  { title: 'Ke Star (Remix)', artist: 'Focalistic & Davido', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },
  { title: 'Tanzania', artist: 'Uncle Waffles & Tony Duardo', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },
  { title: 'Water', artist: 'Tyla', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'medium' },
  { title: 'Jump', artist: 'Tyla, Gunna & Skillibeng', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },
  { title: 'Cast', artist: 'Shallipopi & Odumodublvck', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },
  { title: 'Elon Musk', artist: 'Shallipopi', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },
  { title: 'Ex Convict', artist: 'Shallipopi', genre: 'amapiano_energy', mood: 'amapiano_energy', energyLevel: 'high' },

  // FAITH & GOSPEL (CHRISTIAN / INSPIRATIONAL EXCLUSIVELY)
  { title: 'Excess Love', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Wonder', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Na You Dey Reign', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Chinedum', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Yahweh Sabaoth', artist: 'Nathaniel Bassey', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Onise Iyanu', artist: 'Nathaniel Bassey', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Tobechukwu', artist: 'Nathaniel Bassey & Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Imela', artist: 'Nathaniel Bassey & Enitan Adaba', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Olorun Agbaye', artist: 'Nathaniel Bassey & Chandler Moore', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Too Faithful', artist: 'Moses Bliss', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Miracle No Dey Tire Jesus', artist: 'Moses Bliss', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Daddy Wey Dey Pamper', artist: 'Moses Bliss', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Fragrance to Fire', artist: 'Dunsin Oyekan', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'high' },
  { title: 'Breathe', artist: 'Dunsin Oyekan', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'The Blood and The Name', artist: 'Dunsin Oyekan', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'high' },
  { title: 'Capable God', artist: 'Judikay', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'high' },
  { title: 'Idinma', artist: 'Judikay', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Way Maker', artist: 'Sinach', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'I Know Who I Am', artist: 'Sinach', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'high' },
];

async function queryItunes(title: string, artist: string) {
  try {
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const firstArtist = artist.split(/[,&]/)[0].trim();
    const term = `${cleanTitle} ${firstArtist}`;
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', term);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '1');

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json() as any;
    const hit = json?.results?.[0];
    if (!hit) return null;
    return {
      streamUrl: typeof hit.previewUrl === 'string' ? hit.previewUrl : null,
      artworkUrl: typeof hit.artworkUrl100 === 'string' ? hit.artworkUrl100.replace('100x100bb', '300x300bb') : null,
      durationMs: typeof hit.trackTimeMillis === 'number' ? hit.trackTimeMillis : null,
      actualTitle: typeof hit.trackName === 'string' ? hit.trackName : title,
      actualArtist: typeof hit.artistName === 'string' ? hit.artistName : artist,
    };
  } catch {
    return null;
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function main() {
  console.log(`Resolving ${SEED_TRACKS.length} seed tracks with iTunes search...`);
  const resolved = [];
  let successCount = 0;

  for (let i = 0; i < SEED_TRACKS.length; i++) {
    const s = SEED_TRACKS[i];
    const hit = await queryItunes(s.title, s.artist);
    const audioId = `cat_${slugify(s.artist)}_${slugify(s.title)}`.slice(0, 60);

    const track = {
      audioId,
      audioType: 'music',
      title: hit?.actualTitle || s.title,
      artist: hit?.actualArtist || s.artist,
      genre: s.genre,
      mood: s.mood,
      energyLevel: s.energyLevel,
      durationMs: hit?.durationMs || 30000,
      artworkUrl: hit?.artworkUrl || null,
      previewUrl: hit?.streamUrl || null,
      isCurated: true,
    };

    if (track.previewUrl) successCount++;
    resolved.push(track);

    if ((i + 1) % 15 === 0 || i === SEED_TRACKS.length - 1) {
      console.log(`Processed ${i + 1}/${SEED_TRACKS.length} (${successCount} with live preview)`);
    }
    // slight delay to be gentle with iTunes rate limits
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`Done resolving. Total: ${resolved.length}, Playable streams: ${successCount}`);

  // Generate TypeScript source code for audio-catalog.ts
  const tsContent = `// Auto-generated verified African & Nollywood Cinema Audio Catalog
// Total tracks: ${resolved.length} (${successCount} with instant playable audio streams)
// Covers Afrobeats, Nollywood Soundtracks, Romance/Drama, Cultural Highlife, Amapiano, Faith/Gospel, Cinematic Thriller.

export type CuratedAudioTrack = {
  audioId: string;
  audioType: 'music' | 'original_sound';
  title: string;
  artist: string;
  genre: string;
  mood: string;
  energyLevel: 'chill' | 'medium' | 'high';
  durationMs: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  isCurated: boolean;
};

export const CURATED_AUDIO_CATALOG: CuratedAudioTrack[] = ${JSON.stringify(resolved, null, 2)};
`;

  const targetPath = path.resolve(process.cwd(), 'api/_lib/social-studio/platforms/audio-catalog.ts');
  fs.writeFileSync(targetPath, tsContent, 'utf-8');
  console.log(`Wrote updated audio catalog to: ${targetPath}`);
}

main().catch(console.error);
