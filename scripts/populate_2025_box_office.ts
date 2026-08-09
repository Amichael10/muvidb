import { ingest2025Data } from './ingest_2025_yearbook';

async function run2025Ingestion() {
  console.log('🚀 Populating 2025 Box Office Figures & Actor Rankings...');

  const movies2025 = [
    { title: 'Everybody Loves Jenifa', box_office_ngn: 1124484669 },
    { title: 'Queen Lateefah', box_office_ngn: 365518067 },
    { title: 'Ajosepo', box_office_ngn: 257254189 },
    { title: 'Beast Of Two Worlds (Ajakaju)', box_office_ngn: 252801675 },
    { title: 'Alakada: Bad And Boujee', box_office_ngn: 229151225 },
    { title: 'Lakatabu', box_office_ngn: 202253250 },
    { title: 'The Waiter', box_office_ngn: 184706738 },
    { title: "Farmer's Bride", box_office_ngn: 167194969 },
    { title: 'Funmilayo Ransome Kuti', box_office_ngn: 157096847 },
    { title: 'Muri And Ko', box_office_ngn: 136021935 },
    { title: "All's Fair In Love", box_office_ngn: 132020689 },
    { title: 'Wives On Strike: The Uprising', box_office_ngn: 127146697 },
    { title: 'What About Us', box_office_ngn: 111462141 },
    { title: 'Ghetto Love Story', box_office_ngn: 94824996 },
    { title: 'Thin Line', box_office_ngn: 87874601 },
    { title: 'Blacksmith: Alagbede', box_office_ngn: 65136725 },
    { title: 'Criminal', box_office_ngn: 55850416 },
    { title: 'The Silent Intruder', box_office_ngn: 52659076 },
    { title: 'The Betrayed', box_office_ngn: 46103750 },
    { title: 'Saving Onome', box_office_ngn: 43406630 }
  ];

  const actors2025 = [
    { person_name: 'Falz', rank: 1, category: 'Highest Grossing Lead Actor', gross_label: 'N1.125B', gross_ngn: 1125000000, films: ['Everybody Loves Jenifa'], page: 81 },
    { person_name: 'Odunlade Adekola', rank: 2, category: 'Highest Grossing Lead Actor', gross_label: 'N718M', gross_ngn: 718000000, films: ['Beast Of Two Worlds', 'Lakatabu', 'Alakada: Bad & Boujee'], page: 81 },
    { person_name: 'Kunle Remi', rank: 3, category: 'Highest Grossing Lead Actor', gross_label: 'N501M', gross_ngn: 501000000, films: ['Muri & Ko', 'Queen Lateefah'], page: 81 },
    { person_name: 'Timini Egbuson', rank: 4, category: 'Highest Grossing Lead Actor', gross_label: 'N426M', gross_ngn: 426000000, films: ["All's Fair In Love", 'Ajosepo'], page: 81 },
    { person_name: 'Uzor Arukwe', rank: 5, category: 'Highest Grossing Lead Actor', gross_label: 'N242M', gross_ngn: 242000000, films: ['What About Us', 'Thin Line', 'Criminal'], page: 81 },
    { person_name: 'Funke Akindele', rank: 1, category: 'Highest Grossing Lead Actress', gross_label: 'N1.125B', gross_ngn: 1125000000, films: ['Everybody Loves Jenifa'], page: 82 },
    { person_name: 'Wunmi Toriola', rank: 2, category: 'Highest Grossing Lead Actress', gross_label: 'N365M', gross_ngn: 365000000, films: ['Queen Lateefah'], page: 82 },
    { person_name: 'Toyin Abraham', rank: 3, category: 'Highest Grossing Lead Actress', gross_label: 'N266M', gross_ngn: 266000000, films: ['Alakada: Bad & Boujee'], page: 82 },
    { person_name: 'Tomike Adeoye', rank: 4, category: 'Highest Grossing Lead Actress', gross_label: 'N257M', gross_ngn: 257000000, films: ['Ajosepo'], page: 82 },
    { person_name: 'Eniola Ajao', rank: 5, category: 'Highest Grossing Lead Actress', gross_label: 'N253M', gross_ngn: 253000000, films: ['Beast Of Two Worlds (Ajakaju)'], page: 82 },
    { person_name: 'Kehinde Bankole', rank: 6, category: 'Highest Grossing Lead Actress', gross_label: 'N222M', gross_ngn: 222000000, films: ['Funmilayo Ransome Kuti', 'Blacksmith'], page: 82 },
    { person_name: 'Tobi Makinde', rank: 1, category: 'Highest Grossing Male Supporting Role', gross_label: 'N1.140B', gross_ngn: 1140000000, films: ['Everybody Loves Jenifa'], page: 83 },
    { person_name: 'Layi Wasabi', rank: 2, category: 'Highest Grossing Male Supporting Role', gross_label: 'N1.125B', gross_ngn: 1125000000, films: ['Everybody Loves Jenifa'], page: 83 },
    { person_name: 'Lateef Adedimeji', rank: 3, category: 'Highest Grossing Male Supporting Role', gross_label: 'N455M', gross_ngn: 455000000, films: ['Beast Of Two Worlds', 'Lakatabu'], page: 83 },
    { person_name: 'Femi Adebayo', rank: 4, category: 'Highest Grossing Male Supporting Role', gross_label: 'N318M', gross_ngn: 318000000, films: ['Beast Of Two Worlds', 'Blacksmith'], page: 83 },
    { person_name: 'Omotunde Adebowale David', rank: 1, category: 'Highest Grossing Female Supporting Role', gross_label: 'N1.125B', gross_ngn: 1125000000, films: ['Everybody Loves Jenifa'], page: 84 },
    { person_name: 'Juliana Olayode', rank: 1, category: 'Highest Grossing Female Supporting Role', gross_label: 'N1.125B', gross_ngn: 1125000000, films: ['Everybody Loves Jenifa'], page: 84 },
    { person_name: 'Mercy Aigbe', rank: 2, category: 'Highest Grossing Female Supporting Role', gross_label: 'N764M', gross_ngn: 764000000, films: ['Thin Line', 'Beast Of Two Worlds', 'Ajosepo', "Farmer's Bride"], page: 84 },
    { person_name: 'Bukunmi Adeaga-Ilori', rank: 3, category: 'Highest Grossing Female Supporting Role', gross_label: 'N628M', gross_ngn: 628000000, films: ['Muri & Ko', 'Queen Lateefah', 'Wives On Strike 3'], page: 84 },
    { person_name: 'Bisola Aiyeola', rank: 4, category: 'Highest Grossing Female Supporting Role', gross_label: 'N393M', gross_ngn: 393000000, films: ['Ajosepo', 'Muri & Ko'], page: 84 }
  ];

  await ingest2025Data(movies2025, actors2025);
}

run2025Ingestion();
