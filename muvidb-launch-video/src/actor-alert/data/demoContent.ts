import { staticFile } from "remotion";

/**
 * Everything the demo says about a real actor, a real film and a real place to
 * watch it lives here. Swap these values to re-point the video at a different
 * actor or title without touching a single animation.
 *
 * ACCURACY RULE: every field below is copied from the MuviDB production
 * database or the live site, and each watch URL was requested and confirmed to
 * resolve. Do not hand-write a value here that you have not checked -- the
 * video makes factual claims about who is in what and where it can be watched.
 * See README.md ("Swapping the content") for the verification steps.
 */

export interface DemoActor {
  name: string;
  slug: string;
  photo: string;
  /** Role chips exactly as the profile renders them. */
  roles: string[];
  verified: boolean;
  /** Stats strip, as shown on the live profile. */
  stats: { theatricalGross: string; screenCredits: string };
  awardsSummary: string;
  availableForBookings: boolean;
}

export interface DemoFilm {
  title: string;
  slug: string;
  year: number;
  runtimeLabel: string;
  poster: string;
  genres: string[];
  /** Two-sentence, spoiler-free. Taken verbatim from films.synopsis. */
  synopsis: string;
  director: string;
  /** Billed cast as the film page lists them. */
  stars: string[];
  /** The character the followed actor plays, from the credits table. */
  characterName: string;
  muvidbScore: string;
}

export interface DemoDestination {
  /** Display name of the platform, e.g. "Netflix". */
  platform: string;
  /** Label the WhatsApp template renders for {{3}}. */
  platformLabel: string;
  /** Where the MuviDB film page sends the viewer. Verified to resolve. */
  watchUrl: string;
  brandColor: string;
}

export const actor: DemoActor = {
  name: "Femi Adebayo",
  slug: "femi-adebayo",
  photo: staticFile("assets/actors/femi-adebayo.jpg"),
  roles: ["ACTOR", "DIRECTOR", "PRODUCER", "WRITER"],
  verified: true,
  stats: { theatricalGross: "₦3.82B", screenCredits: "226" },
  awardsSummary: "13 Wins · 9 Nominations",
  availableForBookings: true,
};

export const film: DemoFilm = {
  title: "House of Ga'a",
  slug: "house-of-gaa-3",
  year: 2024,
  runtimeLabel: "2h",
  poster: staticFile("assets/posters/house-of-gaa.jpg"),
  genres: ["Action", "Drama", "History"],
  synopsis:
    "At the height of the 18th-century Oyo Empire, the ruthless prime minister Bashorun Ga'a executes an insatiable power grab, dethroning multiple kings before his own blood rises against him.",
  director: "Bolanle Austen-Peters",
  stars: ["Dele Odule", "Femi Branch", "Femi Adebayo", "Mike Afolarin", "Funke Akindele"],
  characterName: "Olukuoye",
  muvidbScore: "6.9",
};

export const destination: DemoDestination = {
  platform: "Netflix",
  platformLabel: "on Netflix",
  watchUrl: "https://www.netflix.com/title/81681233",
  brandColor: "#E50914",
};

/** The film page the WhatsApp button actually opens. */
export const filmPageUrl = `https://muvidb.com/film/${film.slug}`;

/**
 * Rendering of the live `movie_release_alert` WhatsApp Cloud API template.
 *
 * The shipped template (api/_lib/whatsapp_movie_alerts.ts) is an image-header
 * template with exactly four body parameters and one URL button:
 *   {{1}} followed actor(s)   {{2}} film title
 *   {{3}} where to watch      {{4}} film page link
 *
 * There is deliberately no synopsis parameter here, because the product does
 * not send one. The synopsis reaches the viewer on the film page in Scene 6.
 */
export const whatsappTemplate = {
  senderName: "MuviDB Alerts",
  /** WhatsApp shows this on Business accounts. */
  businessLabel: "Business account",
  headerImage: film.poster,
  params: {
    actors: actor.name,
    title: film.title,
    platform: destination.platformLabel,
    link: filmPageUrl,
  },
  buttonLabel: "View on MuviDB",
  footer: `You're receiving this because you follow ${actor.name} on MuviDB.`,
  /** Lock-screen banner copy. */
  notification: {
    app: "WhatsApp",
    title: "MuviDB Alerts",
    body: `🎬 New movie alert! ${actor.name} features in a movie you can now watch.`,
  },
} as const;

/** Body text as the template assembles it, used by the chat bubble. */
export const alertBodyLines = [
  { kind: "heading", text: "🎬 NEW MOVIE ALERT!" },
  {
    kind: "paragraph",
    text: `One of your favourite actors, *${whatsappTemplate.params.actors}*, appears in a movie that's now available to watch.`,
  },
  { kind: "field", label: "🎥 Movie", value: whatsappTemplate.params.title },
  { kind: "field", label: "📺 Now streaming", value: whatsappTemplate.params.platform },
  { kind: "link", label: "Watch", value: whatsappTemplate.params.link },
] as const;

/** On-screen copy, kept out of the scene files so captions stay editable. */
export const script = {
  hook1: "Your favourite actor has a new movie.",
  hook2: "Wouldn't you want to know?",
  discover: "Find your favourite actor.",
  follow1: "Follow once.",
  follow2: "We'll keep you updated.",
  notify: "And when they're in something new…",
  alert: "Everything you need. In one message.",
  watch: "One tap. You're watching.",
  brand1: "Follow the stars.",
  brand2: "Never miss their stories.",
  cta: "Start following at muvidb.com",
} as const;
