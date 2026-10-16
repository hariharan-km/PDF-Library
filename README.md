### Doc & Media Vault (PDF & Image Library) ---> Live Link **[pdfxlib.vercel.app](https://pdfxlib.vercel.app/)**

# PDF & Image Library on Vercel

This app allows you to upload, list, preview, download, **edit/replace**, **rename**, and **delete** both **PDFs** and **Images** (PNG, JPG, WEBP, GIF, SVG, AVIF) in a **private Vercel Blob store**. API access requires the shared access code configured in your Vercel project environment variables.

## Features

- **Multi-Format Support**: Upload and organize both PDF documents and images (PNG, JPG, JPEG, WEBP, GIF, SVG, AVIF).
- **Interactive Previews**: High-resolution Lightbox image viewer and in-browser PDF reader.
- **Dual Display Modes**: Switch between **List View** and **Grid / Gallery View**.
- **Instant Filtering**: Filter by category (`All Files`, `PDFs`, `Images`) or live search by file name.
- **Secure File Operations**: Rename, download, replace content, or delete with single-click confirmation.
- **Local Development Fallback**: Built-in dev server works locally using `.local_storage` even without Vercel credentials.

## Deploy to Vercel

1. Import this repository into Vercel.
2. In the Vercel project dashboard, create a **Blob Store** under **Storage** and connect it to your project.
3. In **Settings → Environment Variables**, add `UPLOAD_PASSWORD` with your desired access code (e.g. `1234` or any secret password).
4. Deploy the project. Open the deployed URL and enter your access code to view, upload, and manage your PDFs and images!

## Local Development

Run the local development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser. Default local access code is `1234` (or whatever is set in your `.env.local`).

## Notes

- Uploads are kept under 4 MB per file because Vercel Functions have a 4.5 MB request body limit.
- The app uses one shared access code for authorized team or personal access.
- Download links generated via Vercel Blob use signed tokens that expire securely after 15 minutes.
