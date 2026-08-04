/**
 * The official MuviDB accounts, shared by the footer and the About page so the
 * two can never drift apart.
 *
 * A null `href` renders the icon greyed out and inert rather than linking
 * nowhere — fill it in when the account exists and both surfaces pick it up.
 */
export const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    handle: '@muvidb_',
    href: 'https://www.instagram.com/muvidb_/',
    icon: 'ri:instagram-fill',
  },
  {
    label: 'X',
    handle: '@muvidb_',
    href: 'https://twitter.com/muvidb_',
    icon: 'ri:twitter-x-fill',
  },
  {
    label: 'TikTok',
    handle: '@muvidb',
    href: 'https://www.tiktok.com/@muvidb',
    icon: 'ri:tiktok-fill',
  },
  {
    label: 'LinkedIn',
    handle: 'MuviDB',
    href: 'https://www.linkedin.com/company/muvidb/',
    icon: 'ri:linkedin-fill',
  },
  {
    label: 'Facebook',
    handle: 'Coming soon',
    href: null,
    icon: 'ri:facebook-fill',
  },
];
