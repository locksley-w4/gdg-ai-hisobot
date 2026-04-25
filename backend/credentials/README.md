# Credentials folder

This folder stores the Google Cloud service account JSON key file for Vertex AI access.

## Setup

1. Download your service account JSON key from the Google Cloud Console.
2. Rename it to `service-account.json` and place it here.
3. Make sure the `GOOGLE_APPLICATION_CREDENTIALS` in `.env` points to `./credentials/service-account.json`.

> **Important:** Never commit the actual JSON key file to version control.
> The `service-account.json` file is listed in `.gitignore`.
