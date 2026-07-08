import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function toTitleCase(str) {
  if (!str) return str;
  const isAllCaps = str === str.toUpperCase() && str !== str.toLowerCase();
  const target = isAllCaps ? str.toLowerCase() : str;
  return target.replace(/(?:^|[\s-'])\w/g, function(match) {
    return match.toUpperCase();
  });
}

function toSentenceCase(str) {
  if (!str) return str;
  const isAllCaps = str === str.toUpperCase() && str !== str.toLowerCase();
  const target = isAllCaps ? str.toLowerCase() : str;
  let result = target.charAt(0).toUpperCase() + target.slice(1);
  return result.replace(/([.!?]\s+)([a-z])/g, function(match, p1, p2) {
    return p1 + p2.toUpperCase();
  });
}

async function cleanDatabase() {
  console.log("Starting database casings cleanup...");

  // 1. Films Table (title, synopsis)
  console.log("Formatting films...");
  const { data: films, error: filmsError } = await supabase.from('films').select('id, title, synopsis');
  if (filmsError) {
    console.error("Error fetching films:", filmsError);
  } else {
    let updatedFilmsCount = 0;
    for (const film of films) {
      const updatePayload = {};
      if (film.title) {
        const formattedTitle = toSentenceCase(film.title.trim());
        if (formattedTitle !== film.title) {
          updatePayload.title = formattedTitle;
        }
      }
      if (film.synopsis) {
        const formattedSynopsis = toSentenceCase(film.synopsis.trim());
        if (formattedSynopsis !== film.synopsis) {
          updatePayload.synopsis = formattedSynopsis;
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('films').update(updatePayload).eq('id', film.id);
        if (error) {
          console.error(`Error updating film ${film.id}:`, error);
        } else {
          console.log(`Updated film ${film.id}:`, updatePayload);
          updatedFilmsCount++;
        }
      }
    }
    console.log(`Finished films. Updated ${updatedFilmsCount} films.`);
  }

  // 2. People Table (bio)
  console.log("Formatting people biography...");
  const { data: people, error: peopleError } = await supabase.from('people').select('id, bio');
  if (peopleError) {
    console.error("Error fetching people:", peopleError);
  } else {
    let updatedPeopleCount = 0;
    for (const person of people) {
      if (person.bio) {
        const formattedBio = toSentenceCase(person.bio.trim());
        if (formattedBio !== person.bio) {
          const { error } = await supabase.from('people').update({ bio: formattedBio }).eq('id', person.id);
          if (error) {
            console.error(`Error updating person bio ${person.id}:`, error);
          } else {
            console.log(`Updated person bio ${person.id}`);
            updatedPeopleCount++;
          }
        }
      }
    }
    console.log(`Finished people. Updated ${updatedPeopleCount} people biographies.`);
  }

  // 3. Channels Table (name, description)
  console.log("Formatting channels...");
  const { data: channels, error: channelsError } = await supabase.from('channels').select('id, name, description');
  if (channelsError) {
    console.error("Error fetching channels:", channelsError);
  } else {
    let updatedChannelsCount = 0;
    for (const channel of channels) {
      const updatePayload = {};
      if (channel.name) {
        const formattedName = toTitleCase(channel.name.trim());
        if (formattedName !== channel.name) {
          updatePayload.name = formattedName;
        }
      }
      if (channel.description) {
        const formattedDesc = toSentenceCase(channel.description.trim());
        if (formattedDesc !== channel.description) {
          updatePayload.description = formattedDesc;
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('channels').update(updatePayload).eq('id', channel.id);
        if (error) {
          console.error(`Error updating channel ${channel.id}:`, error);
        } else {
          console.log(`Updated channel ${channel.id}:`, updatePayload);
          updatedChannelsCount++;
        }
      }
    }
    console.log(`Finished channels. Updated ${updatedChannelsCount} channels.`);
  }

  // 4. Companies Table (name, description)
  console.log("Formatting companies...");
  const { data: companies, error: companiesError } = await supabase.from('companies').select('id, name, description');
  if (companiesError) {
    console.error("Error fetching companies:", companiesError);
  } else {
    let updatedCompaniesCount = 0;
    for (const company of companies) {
      const updatePayload = {};
      if (company.name) {
        const formattedName = toTitleCase(company.name.trim());
        if (formattedName !== company.name) {
          updatePayload.name = formattedName;
        }
      }
      if (company.description) {
        const formattedDesc = toSentenceCase(company.description.trim());
        if (formattedDesc !== company.description) {
          updatePayload.description = formattedDesc;
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('companies').update(updatePayload).eq('id', company.id);
        if (error) {
          console.error(`Error updating company ${company.id}:`, error);
        } else {
          console.log(`Updated company ${company.id}:`, updatePayload);
          updatedCompaniesCount++;
        }
      }
    }
    console.log(`Finished companies. Updated ${updatedCompaniesCount} companies.`);
  }

  // 5. Cinemas Table (name, chain, city, state, address, description)
  console.log("Formatting cinemas...");
  const { data: cinemas, error: cinemasError } = await supabase.from('cinemas').select('id, name, chain, city, state, address, description');
  if (cinemasError) {
    console.error("Error fetching cinemas:", cinemasError);
  } else {
    let updatedCinemasCount = 0;
    for (const cinema of cinemas) {
      const updatePayload = {};
      if (cinema.name) {
        const formattedName = toTitleCase(cinema.name.trim());
        if (formattedName !== cinema.name) updatePayload.name = formattedName;
      }
      if (cinema.chain) {
        const formattedChain = toTitleCase(cinema.chain.trim());
        if (formattedChain !== cinema.chain) updatePayload.chain = formattedChain;
      }
      if (cinema.city) {
        const formattedCity = toTitleCase(cinema.city.trim());
        if (formattedCity !== cinema.city) updatePayload.city = formattedCity;
      }
      if (cinema.state) {
        const formattedState = toTitleCase(cinema.state.trim());
        if (formattedState !== cinema.state) updatePayload.state = formattedState;
      }
      if (cinema.address) {
        const formattedAddress = toSentenceCase(cinema.address.trim());
        if (formattedAddress !== cinema.address) updatePayload.address = formattedAddress;
      }
      if (cinema.description) {
        const formattedDesc = toSentenceCase(cinema.description.trim());
        if (formattedDesc !== cinema.description) updatePayload.description = formattedDesc;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('cinemas').update(updatePayload).eq('id', cinema.id);
        if (error) {
          console.error(`Error updating cinema ${cinema.id}:`, error);
        } else {
          console.log(`Updated cinema ${cinema.id}:`, updatePayload);
          updatedCinemasCount++;
        }
      }
    }
    console.log(`Finished cinemas. Updated ${updatedCinemasCount} cinemas.`);
  }

  console.log("All cleanups completed successfully!");
}

cleanDatabase();
