# NollyData Scraper

This is a standalone Node.js script designed to run on a Vultr VPS to scrape data from `nollydata.com` and push it directly into the Supabase database.

## Prerequisites
- Node.js installed on your Vultr server (v18+)
- PM2 or Tmux for running scripts in the background
- Supabase Project URL and Service Role Key

## Setup Instructions for Vultr

1. **SSH into your Vultr server:**
   ```bash
   ssh root@<YOUR_VULTR_IP>
   ```

2. **Clone the repository (or copy this folder over):**
   ```bash
   git clone https://github.com/Amichael10/muvidb.git
   cd muvidb/scripts/scraper
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Create a `.env` file:**
   Create a `.env` file in the `scripts/scraper` directory and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   *Note: Use the Service Role Key, not the anon key, since the scraper needs permission to insert records without being logged in.*

5. **Test the scraper locally:**
   Run the scraper to ensure it works. It is currently set to just run on the first 3 movies as a test.
   ```bash
   node nollydata_scraper.js
   ```

6. **Run in the background (Optional):**
   Once you verify it works and you remove the `.slice(0, 3)` limit in the script to run the full scrape, you can run it in the background using `pm2` so it doesn't stop when you close your SSH terminal:
   ```bash
   npm install -g pm2
   pm2 start nollydata_scraper.js --name "nollydata-scraper"
   ```
   To view logs:
   ```bash
   pm2 logs nollydata-scraper
   ```

## Note on HTML Selectors
Websites often change their HTML classes. If the scraper stops pulling data, you may need to inspect `nollydata.com` and update the Cheerio selectors (like `$('.synopsis')`) in `nollydata_scraper.js`.
