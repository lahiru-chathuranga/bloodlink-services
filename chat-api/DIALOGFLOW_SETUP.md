# Dialogflow ES setup (one-time, ~10 min)

Do this in your own Google account. When done, paste back the **Project ID** and the **service account JSON key contents** and I'll wire them into `chat-api/.env`.

## 1. Create the Dialogflow agent (this also creates the GCP project)
1. Go to https://dialogflow.cloud.google.com/ and sign in.
2. Click **Create Agent** (or the agent dropdown → "Create new agent").
3. Name it e.g. `bloodlink-chatbot`. Default language `en`, default time zone anything.
4. Under **Google Project**, choose "Create a new Google project" (or pick an existing one) — note the **Project ID** shown here (not the display name — the lowercase-with-dashes id, e.g. `bloodlink-chatbot-abc123`).
5. Click **Create**.

## 2. (Optional but recommended) Add a couple of intents
The backend already has a canned-fallback for anything unmatched, so this step isn't required to test the *pipe* end-to-end, but a real intent proves real NLU is working:
1. In the left sidebar, click **Intents → Create Intent**.
2. Name it `donation.eligibility`, add a few **Training phrases** like "Can I donate blood?", "Am I eligible to donate?".
3. Add a **Text Response** like "You can donate if you're 18-60, weigh at least 50kg, and haven't donated in the last 120 days.".
4. Save.

## 3. Create a service account + JSON key
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts and make sure the **same project** from step 1 is selected (top-left project picker).
2. Click **Create Service Account**. Name it e.g. `chat-api-dialogflow`.
3. Grant it the role **Dialogflow API Client** (search "Dialogflow" in the role picker).
4. Click **Done**.
5. Click into the new service account → **Keys** tab → **Add Key → Create new key → JSON**. This downloads a `.json` file.
6. Open that file in a text editor, copy the **entire contents**, and paste it back to me along with the Project ID from step 1.

## 4. What I'll do with it
- Set `DIALOGFLOW_PROJECT_ID` to the project id.
- Set `DIALOGFLOW_CREDENTIALS_JSON` to the JSON key contents (as a single-line string) in `chat-api/.env`.
- Restart `chat-api` and send a real test message through `POST /chat/messages` to confirm `matchedIntent` comes back populated instead of `null`.

Don't commit the JSON key file anywhere or paste it into any file that isn't `chat-api/.env` (already gitignored) — treat it like a password.
