# Meta WhatsApp Movie Alerts Setup Guide

This guide walks you through connecting the **Meta WhatsApp Cloud API** to MuviDB so that whenever an actor's movie or cinema release drops, their followers automatically receive an alert on WhatsApp with the film poster, cast details, and deep-link.

---

## 1. How It Works
1. **User Follows an Actor**:
   - On the actor profile ([`PersonDetail.jsx`](file:///c:/Users/User/Filmdba/lumi/src/pages/PersonDetail.jsx)), clicking **"Follow"** checks if the user has opted into WhatsApp.
   - If not, the **WhatsAppOptInModal** pops up asking for their WhatsApp number (+234...).
   - Upon opting in, their number is saved to `users.whatsapp_phone`, and `follows.notify_whatsapp = true`.
2. **Movie Publication / Cinema Alert Trigger**:
   - When a film is saved or marked published in Admin Films, it fires the alert engine [`whatsapp_movie_alerts.ts`](file:///c:/Users/User/Filmdba/lumi/api/_lib/whatsapp_movie_alerts.ts).
3. **Multi-Actor Deduplicator (Smart Grouping)**:
   - If a user follows 5 actors who all appear in the same film, the engine groups them and sends **only 1 message**:
     > *"Actors you follow (Lateef Olofin, Funke Akindele, and 1 other) are starring in the new release: Jagun Jagun 2!"*
   - An alert record is saved into `whatsapp_movie_alert_log` with a unique constraint on `(user_id, film_id)` to prevent duplicates.
4. **Unsubscribe / Compliance**:
   - Every message includes "Reply STOP to unsubscribe".
   - The inbound webhook at `/api/whatsapp?action=webhook` listens for "STOP" and automatically disables alerts for that phone number.

---

## 2. Meta WhatsApp Cloud API Setup (Step-by-Step)

### Step A: Create a Meta App
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** > **Create App**.
3. Choose **Other** > Select **Business** as the app type.
4. Name your app `MuviDB` and link your Meta Business Account.

### Step B: Add WhatsApp Product
1. In the App Dashboard, scroll down and find **WhatsApp**, then click **Set up**.
2. Under WhatsApp > **API Setup**:
   - Note down your **Phone number ID**.
   - Note down your **WhatsApp Business Account ID**.
   - Generate a temporary access token (or generate a permanent System User Token in Meta Business Settings > Users > System Users with `whatsapp_business_messaging` permission).

### Step C: Create the WhatsApp Template
In the WhatsApp Business Manager under **Message Templates**:
1. Click **Create Template**.
2. **Category**: `Marketing` or `Utility`
3. **Template Name**: `movie_release_alert`
4. **Language**: `English` (`en`)
5. **Header**: Select **Media** > **Image**
6. **Body**:
   ```
   🎬 New Release Alert on MuviDB

   {{1}} stars in {{2}}!

   🍿 Where to watch: {{3}}
   👥 View cast & crew on MuviDB: {{4}}

   Reply STOP to unsubscribe.
   ```
   *Sample values for Meta review:*
   - `{{1}}`: `Lateef Olofin`
   - `{{2}}`: `Jagun Jagun 2`
   - `{{3}}`: `In Cinemas`
   - `{{4}}`: `https://muvidb.com/film/jagun-jagun-2`
7. **Buttons**:
   - Type: `Visit Website`
   - Button text: `View on MuviDB`
   - URL Type: `Dynamic`
   - Website URL: `https://muvidb.com/film/{{1}}`
8. Submit the template. (Approval usually takes 1 to 10 minutes).

### Step D: Configure Webhook (Optional for STOP unsubscription)
1. In Meta App Dashboard, go to **WhatsApp** > **Configuration**.
2. In the **Callback URL** field, enter:
   `https://muvidb.com/api/whatsapp?action=webhook`
3. In **Verify token**, enter your `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (default: `muvidb_whatsapp_verify_token`).
4. Click **Verify and Save**.
5. Under **Webhook fields**, subscribe to `messages`.

---

## 3. Environment Variables (Vercel & `.env.local`)

Add these variables to your Vercel Project Settings and `.env.local`:

```ini
# Meta WhatsApp Cloud API Credentials
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_meta_system_user_token
WHATSAPP_BUSINESS_ACCOUNT_ID=your_meta_waba_id
WHATSAPP_MOVIE_ALERT_TEMPLATE=movie_release_alert
WHATSAPP_WEBHOOK_VERIFY_TOKEN=muvidb_whatsapp_verify_token
```

---

## 4. Database Migration SQL

Run this migration in your Supabase SQL Editor if you haven't yet pushed:
File location: [`supabase/migrations/20260927140000_whatsapp_movie_alerts.sql`](file:///c:/Users/User/Filmdba/lumi/supabase/migrations/20260927140000_whatsapp_movie_alerts.sql)

```sql
-- 1. Add WhatsApp fields to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

-- 2. Add notification preference to follows
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT true;

-- 3. Create deduplicated alert log
CREATE TABLE IF NOT EXISTS public.whatsapp_movie_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  phone text NOT NULL,
  followed_people_names text[] NOT NULL DEFAULT '{}',
  message_id text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_movie_alert_log_user_film UNIQUE (user_id, film_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_movie_alert_log_user_film
  ON public.whatsapp_movie_alert_log (user_id, film_id);

ALTER TABLE public.whatsapp_movie_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own whatsapp alerts" ON public.whatsapp_movie_alert_log;
CREATE POLICY "Users can read own whatsapp alerts" ON public.whatsapp_movie_alert_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```
