# JFlix Cloudflare Pages Deployment Guide

This guide will help you deploy JFlix with the comment, reaction, and view count features to Cloudflare Pages using Cloudflare D1 database.

## Prerequisites

1. **Cloudflare Account** - Sign up at https://dash.cloudflare.com/
2. **Wrangler CLI** - Install Node.js and run:
   ```bash
   npm install -g wrangler
   ```
3. **Git** - For version control (optional but recommended)

## Step 1: Configure wrangler.toml

1. Open `wrangler.toml` in your project directory
2. Replace `YOUR_DATABASE_ID` with your actual Cloudflare D1 database ID (you'll get this in Step 2)
3. Update the `name` field if you want a different project name

## Step 2: Create Cloudflare D1 Database

1. Login to Cloudflare:
   ```bash
   wrangler login
   ```

2. Create a D1 database:
   ```bash
   wrangler d1 create jflix-db
   ```

3. Copy the database ID from the output and update `wrangler.toml`

4. Initialize the database with the schema:
   ```bash
   wrangler d1 execute jflix-db --file=schema.sql
   ```

## Step 3: Deploy the Worker

1. Deploy the worker:
   ```bash
   wrangler deploy
   ```

2. Note the worker URL (e.g., `https://jflix.YOUR_ACCOUNT.workers.dev`)

## Step 4: Update API URL in JavaScript Files

1. Open `js/nickname-manager.js`
2. Update the default API URL on line 4:
   ```javascript
   this.apiUrl = apiUrl || 'https://jflix.YOUR_ACCOUNT.workers.dev/api';
   ```

3. Open `js/player-api.js`
4. Update the default API URL on line 4:
   ```javascript
   this.apiUrl = apiUrl || 'https://jflix.YOUR_ACCOUNT.workers.dev/api';
   ```

## Step 5: Deploy to Cloudflare Pages

### Option A: Using Wrangler (Recommended)

1. Create a Git repository and push your code to GitHub/GitLab

2. Connect your repository to Cloudflare Pages:
   - Go to Cloudflare Dashboard → Workers & Pages
   - Click "Create application"
   - Select "Pages" tab
   - Connect your Git repository

3. Configure build settings:
   - Build command: Leave empty (static site)
   - Build output directory: `/` (root directory)

4. Deploy

### Option B: Direct Upload

1. Upload your files to Cloudflare Pages:
   ```bash
   wrangler pages publish . --project-name=jflix
   ```

## Step 6: Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages → jflix
2. Click "Custom domains"
3. Add your domain (e.g., `jflix.uk`)
4. Follow the DNS configuration instructions

## Step 7: Test the Features

1. Visit your deployed site
2. Navigate to the player page
3. Test the following:
   - Nickname creation modal should appear
   - Create a nickname
   - View count should display
   - Reaction buttons should work
   - Comment submission should work
   - Comment deletion (for your own comments)

## API Endpoints

The following API endpoints are available:

### Comments
- `GET /api/comments?mediaType=movie&mediaId=123&seasonNumber=1&episodeNumber=1&limit=50`
- `POST /api/comments` - Body: `{ mediaType, mediaId, seasonNumber, episodeNumber, userId, nickname, commentText }`
- `DELETE /api/comments?id=123&userId=user-id`

### Reactions
- `GET /api/reactions?mediaType=movie&mediaId=123&seasonNumber=1&episodeNumber=1&userId=user-id`
- `POST /api/reactions` - Body: `{ mediaType, mediaId, seasonNumber, episodeNumber, userId, reactionType }`

### View Counts
- `GET /api/views?mediaType=movie&mediaId=123&seasonNumber=1&episodeNumber=1`
- `POST /api/views` - Body: `{ mediaType, mediaId, seasonNumber, episodeNumber }`

### Users
- `POST /api/users` - Body: `{ userId, nickname }`
- `GET /api/users?userId=user-id`

## Database Schema

The database includes the following tables:
- `users` - User nicknames and IDs
- `comments` - User comments
- `reactions` - User reactions (like, love, laugh, wow, sad, angry)
- `reaction_counts` - Aggregated reaction counts
- `view_counts` - View count tracking

## Troubleshooting

### CORS Errors
If you encounter CORS errors, ensure your worker returns the correct CORS headers (already configured in `worker.js`).

### Database Not Found
Make sure you've created the D1 database and updated the database ID in `wrangler.toml`.

### API URL Issues
Verify that the API URL in your JavaScript files matches your deployed worker URL.

### Nickname Not Saving
Check that the user ID is being generated correctly in localStorage and that the API is receiving the correct data.

## Local Development

To test locally with Wrangler:

1. Start the local development server:
   ```bash
   wrangler dev
   ```

2. Update API URLs to `http://localhost:8787/api` for testing

3. Test the features locally before deploying

## Security Notes

- The current implementation uses localStorage for user IDs (client-side)
- For production, consider implementing proper authentication
- Add rate limiting to prevent spam
- Implement content moderation for comments

## Cost

- Cloudflare D1: Free tier includes 5GB storage and 25M reads/day
- Cloudflare Workers: Free tier includes 100K requests/day
- Cloudflare Pages: Free tier with unlimited bandwidth

## Support

For issues with:
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Pages: https://developers.cloudflare.com/pages/
