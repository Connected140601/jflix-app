# ANIU - Anime Streaming Website

A modern, static anime streaming website built with vanilla HTML, CSS, and JavaScript. Features a sleek dark theme design similar to AnimePahe, powered by the Anilist API for anime metadata and vidnest.fun for video streaming.

## Features

- **Modern Design**: Clean, responsive dark theme with gradient accents
- **Anilist API Integration**: Fetches anime data including posters, descriptions, ratings, and more
- **Video Streaming**: Embedded video player using vidnest.fun API
- **Multiple Sources**: Supports both standard and AnimePahe streaming sources
- **Sub/Dub Support**: Switch between subbed and dubbed versions
- **Episode Navigation**: Easy navigation between episodes
- **Search Functionality**: Search for anime by title
- **Responsive Layout**: Works on desktop, tablet, and mobile devices

## Project Structure

```
aniu/
├── index.html          # Homepage with trending/popular anime
├── anime.html          # Anime detail page with episode list
├── watch.html          # Video player page
├── css/
│   └── style.css       # Main stylesheet
├── js/
│   ├── app.js          # Homepage logic and API calls
│   ├── anime.js        # Anime detail page logic
│   └── watch.js        # Video player logic
└── assets/             # Static assets (images, etc.)
```

## APIs Used

### Anilist API
- **GraphQL Endpoint**: https://graphql.anilist.co
- **Client ID**: 26768
- Used for fetching anime metadata, posters, descriptions, and more

### vidnest.fun Streaming API
- **Standard Format**: `https://vidnest.fun/anime/[ANILIST_ID]/[EPISODE]/[SUB_OR_DUB]`
- **AnimePahe Format**: `https://vidnest.fun/animepahe/[ANILIST_ID]/[EPISODE]/[SUB_OR_DUB]`
- Used for embedded video streaming

## Local Development

Since this is a static website, you can serve it locally using any static file server:

### Using Python
```bash
python3 -m http.server 8000
```

### Using Node.js (http-server)
```bash
npx http-server -p 8000
```

### Using PHP
```bash
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Deployment to Cloudflare Pages

### Method 1: Direct Upload

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Create a new Pages project:
```bash
wrangler pages project create aniu
```

4. Deploy your site:
```bash
wrangler pages deploy . --project-name=aniu
```

### Method 2: Git Integration

1. Push your code to a Git repository (GitHub/GitLab)

2. Go to Cloudflare Dashboard → Pages → Create a project

3. Connect your Git repository

4. Configure build settings:
   - **Build command**: (leave empty for static sites)
   - **Build output directory**: `/`

5. Click "Save and Deploy"

### Method 3: Wrangler Configuration (Optional)

Create a `wrangler.toml` file for advanced configuration:

```toml
name = "aniu"
compatibility_date = "2024-01-01"

[pages]
build_output_dir = "."
```

Then deploy with:
```bash
wrangler pages deploy
```

## Customization

### Changing Colors
Edit the CSS variables in `css/style.css`:
```css
:root {
    --bg-primary: #0a0a0f;
    --bg-secondary: #12121a;
    --bg-card: #1a1a24;
    --accent: #7c3aed;
    /* ... */
}
```

### Modifying API Queries
Edit the GraphQL queries in the JavaScript files (`js/app.js`, `js/anime.js`, `js/watch.js`)

### Adding More Features
The modular structure makes it easy to add new pages and functionality.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

This project is for educational purposes only. Please respect the copyright of anime content and use legitimate streaming services when available.

## Credits

- [Anilist](https://anilist.co) - Anime metadata API
- [vidnest.fun](https://vidnest.fun) - Video streaming API
- Design inspired by [AnimePahe](https://animepahe.com)
