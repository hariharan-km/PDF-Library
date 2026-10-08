### PDF Library --->  Live Link **pdfxlib.vercel.app**

# PDF Library on Vercel

This page uploads PDFs to a **private Vercel Blob store**, lists uploaded files, and creates short-lived download links. API access requires the shared access code you configure as an environment variable.

## Deploy

1. Import the `outputs` folder as the project root in Vercel (or set the project Root Directory to `outputs`).
2. In the Vercel project, create a **Private Blob** store under **Storage** and connect it to this project. Make sure the Production environment is connected.
3. In **Settings → Environment Variables**, add `UPLOAD_PASSWORD` with a long, unique access code. Apply it to Production (and Preview if needed), then redeploy.
4. Deploy the project. Open the deployed URL and enter the access code to view or upload PDFs.

Vercel Blob's connected project credentials are used by the API. Do not add Blob tokens or the access code to this repository. Download links are signed and expire after 15 minutes.

## Notes

- Uploads are limited to 4 MB per file because this simple implementation sends each PDF through a Vercel Function; Vercel Functions have a 4.5 MB request body limit. The page refuses larger files before upload.
- The app uses one shared access code, with no separate user accounts. Anyone who has the code can view and upload PDFs.
- `@vercel/blob` is installed by Vercel during deployment from `package.json`.
