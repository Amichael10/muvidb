# Poster-based Streaming Alerts

In Social Studio, choose **Streaming Alert (Movie Poster)** and select a film.
Generation reads the current `films.poster_url`, checks the actual image dimensions,
and saves a separate JPEG copy for the draft. Landscape thumbnails are rejected with
“Portrait poster needed”. Replace the film poster, then generate again.

The entire poster is fitted within a 4:5 canvas (864 × 1080), with dark padding where
necessary, so titles and printed credits are not cropped. Captions are assembled
from the stored synopsis, availability, cast, and crew. Instagram and TikTok use
their respective saved handles; absent handles become names. Facebook uses names.
These are caption mentions, not Instagram photo-tag objects. Optional AI rewriting
remains available in the existing composer.

Returning focus to a draft checks whether the film's poster URL has changed.
**Use latest film poster** refreshes the media without replacing edited captions.
Scheduled/published posts cannot be refreshed; reopen a scheduled post for editing
first. A replacement uploaded at the exact same source URL can be picked up using
the refresh button even when the URL-change notice is absent.

## Accounts

- Streaming Alert Instagram is fixed to the connected `muvi_database` account.
  Missing that connection blocks publishing; the main Instagram is never a fallback.
- Streaming Alert Facebook, TikTok, and any other selected platforms use the
  **Main MuviDB** destination mappings.
- Other post types use their selected destination mappings.
- Scheduling saves each resolved connection ID on the variant. Publishing uses
  that ID rather than the most recently connected account.

Connect `@muvi_database` through Social Studio Connections using the Meta account
that manages it. Keep the existing main Instagram connection. Reconnect TikTok if
its connection is expired. No database migration is needed.

## TikTok photo delivery

Before a photo submission, the publisher converts each image to JPEG and stages
it in the configured social asset bucket. TikTok receives a same-origin URL:
`https://muvidb.com/api/media?op=social-photo&path=...`.
This endpoint serves JPEG bytes directly, without redirecting to Supabase. Its
path is restricted to prepared TikTok photos; it is not an arbitrary URL proxy.

`SOCIAL_PUBLIC_MEDIA_ORIGIN` optionally changes the origin; it defaults to
`https://muvidb.com`. The origin must serve this deployment, and its domain or URL
prefix must be verified in the TikTok application's URL properties. Verification
of an unrelated storage domain does not suffice. See the official
[media transfer guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide).

Deploy the code before testing live delivery. A successful local build does not
confirm TikTok domain verification or account permissions. No live social post is
sent by the automated tests.
