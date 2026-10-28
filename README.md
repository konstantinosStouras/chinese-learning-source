# Chinese Practice — first SATLE prototype

Student website: https://www.stouras.com/chinese/
Teaching area: https://www.stouras.com/chinese/admin/
Firebase project: `stouras-chinese` (isolated from other simulations).

## What is included

Two main pathways with three independently editable cohorts: HSK1 beginner (15 students), Business Chinese HSK4–5 (8), and HSK5 (6). Each has 12 weeks. Week 1 contains clearly labelled demonstration content; other weeks start as unpublished drafts. Beginner samples use the seven characters in Lucy's handout. Advanced samples are original illustrative vocabulary, pending lecturer review.

Student practice includes stroke-order animation and guided drawing (Hanzi Writer), pinyin with tone checking, device speech playback when a Mandarin voice is installed, 20-second microphone recordings and local playback. Registered accounts with verified email addresses can practise and save records. Registration supports Google or email/password, with first and last names. Admins manage weekly vocabulary, repetitions, hints, activities, draft/publish status and private conversations with learners. Every verified registered user can use AI feedback without lecturer approval. The owner can promote registered users and enable a shared `teacher` login by choosing a password.

Google sign-in automatically recognises only the verified `kstouras@gmail.com` Google account as owner. Email/password users cannot claim owner access simply by registering that address. Other admin roles are stored in a protected collection. Shared credentials never appear in source code.

AI keys are stored only in Google Secret Manager. The callable backend supports OpenAI `gpt-transcribe` for recognised-word feedback, and Azure Speech for pronunciation accuracy/fluency/completeness. OpenAI results are never represented as tone scores. Azure scores also need teacher calibration before assessment use. No provider key is preloaded. Raw recordings are not stored by this project; requested feedback and transcripts are saved. Daily limits: 40 requests per user and 300 globally. Max 2 backend instances, zero warm instances.

## Local development

Node 22 is required. Run `npm ci`, `npm --prefix _chinese-firebase/functions ci`, `npm test`, `npm run build` and `npm run serve`. Open http://localhost:4173/chinese/. Production assets are in `site/chinese/`. The build does not delete bundled character data. Run `node tools/assets.mjs` to refresh the 23 sample characters and their licence.

Firebase functions: run `npm ci` in `_chinese-firebase/functions`. Every deployment must explicitly pass `--project stouras-chinese`; the predeploy guard reads `.firebaserc` and refuses mismatched projects.

```
cd _chinese-firebase
firebase deploy --only firestore:rules,functions:chinese --project stouras-chinese
# The first deployment of the retry-enabled deletion worker also requires --force.
```

Source lives in `konstantinosStouras/chinese-learning-source` (main), built `site/chinese/` assets in `konstantinosStouras/chinese-learning` (main). Commit and push both, then trigger the homepage `sync-projects.yml` workflow. The homepage contains submodule pointers: do not copy into or replace those paths. Wait for its checks and Pages publication, then compare live assets with the build. Local provisioning helpers and synthetic test data are not published.

## Activation

The project needs an active Google Cloud billing account to deploy the secure functions. Secret Manager secrets `chinese-openai` and `chinese-azure` must be created in this project. The runtime service account needs secret-version access and addition permissions on those two secrets. No service-account private keys are created.

After backend deployment: sign in at the admin URL with the owner Google account, open Settings, choose a provider and save its API key. Azure additionally needs the Speech resource name. Set a shared password if that login is wanted. Lucy signs in with Google once; the owner can then appoint her in People & practice. Students verify their email, then can use metered AI feedback automatically.

Before a classroom pilot: review vocabulary, calibrate pronunciation against Lucy's rubric, confirm university participant information and retention arrangements, and test real microphones and touch input on the actual student devices. No claims of universal browser compatibility or assessment validity are made.

## Dependencies and references

Hanzi Writer (MIT): https://hanziwriter.org/docs.html
Character data: Make Me a Hanzi, Arphic Public License (included in `site/chinese/characters/LICENSE.txt`).
OpenAI file transcription: https://developers.openai.com/api/docs/guides/speech-to-text
Azure pronunciation assessment: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment
Azure short-audio REST interface: https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short

Not included in this first version: automatic lesson generation, textbook ingestion, live classroom sessions, spaced repetition scheduling, paragraph polishing, exam timing and graded assessments.

## People, messages and deletion

People & practice reads the Firebase Auth directory through an admin-only callable, joining first/last names and module details. Pages of 100 accounts have a Load more control; search filters the loaded directory. The directory includes accounts whose profile setup is incomplete. Only the owner can appoint admins or delete another admin; another admin cannot delete the owner.

Private conversations live in threads/{learnerUid}/items. Admins start a conversation and verified learners can reply through Messages. Message contents remain on the website; optional email notifications link back to the private conversation. All writes go through the callable, which checks identity, target, length and daily limits (500 admin / 100 learner messages). Send requests carry an idempotency key. Sequence numbers support older-message pagination and read receipts without marking a concurrently arriving message read. Firestore allows a learner to read only their own thread head for the unread badge; message contents are read through the callable.

Account deletion requires reauthentication, exact DELETE confirmation, and server authorization. The callable creates a protected accountDeletions marker. That marker immediately blocks app data and API access. The deployed purgeChineseAccount trigger disables/revokes sign-in, removes profile, roles, practice, transcripts, quotas and messages, deletes Auth last, and retains only a minimal completed marker without name/email. The worker is idempotent and retries failures. Shared teacher deletion is excluded; owner self-deletion is allowed, while another admin cannot delete the owner. Monitor failed worker executions; do not remove pending markers while a purge is unfinished.

Tests cover permission boundaries and escaping; live synthetic tests also exercise private two-way messaging, duplicate-send prevention and both deletion paths with cleanup. Never test destructive controls on real users.

## Message email notifications

The owner connects kstouras@gmail.com in Settings → Message emails using a Google app password (2-Step Verification required). The backend verifies SMTP authentication before storing the credential in Secret Manager `chinese-mail`; runtime access/version-add permissions are scoped to that secret. Never commit the password. Only the verified owner Google account can connect or pause this sender. Setup: https://support.google.com/accounts/answer/185833

New admin messages queue notifications through notifyChineseMessage; old messages and learner replies do not send mail. Only active, verified accounts receive mail, with account-level opt-out and deletion checks. Notifications contain no message content and use a fixed #messages link, continuing through sign-in to the current user’s conversation. #account opens notification preferences. Synthetic .invalid/.test addresses are excluded. Gmail must be connected before sending works.

The worker uses a transaction lease, stable Message-ID, sent status and a five-attempt retry limit. Sent means SMTP accepted, not confirmed inbox delivery. SMTP cannot guarantee exactly-once delivery if the process stops between acceptance and recording status. Admins can see pending/sent/skipped/failed status in each conversation. Messages skipped while mail is off are not sent retrospectively. Gmail quotas still apply. Unit tests use a fake transport; a real inbox test requires connecting the sender.
