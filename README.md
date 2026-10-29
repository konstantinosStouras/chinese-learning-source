# Chinese Practice — first SATLE prototype

Student website: https://www.stouras.com/chinese/
Teaching area: https://www.stouras.com/chinese/admin/
Firebase project: `stouras-chinese` (isolated from other simulations).

## What is included

Two main pathways with three independently editable cohorts: HSK1 beginner (15 students), Business Chinese HSK4–5 (8), and HSK5 (6). Each has 12 weeks. Week 1 contains clearly labelled demonstration content; other weeks start as unpublished drafts. Beginner samples use the seven characters in Lucy's handout. Advanced samples are original illustrative vocabulary, pending lecturer review.

Student practice includes stroke-order animation and guided drawing (Hanzi Writer), pinyin with tone checking, device speech playback when a Mandarin voice is installed, 20-second microphone recordings and local playback. Registered accounts with verified email addresses can practise and save records. Registration supports Google or email/password, with first and last names. Admins manage weekly vocabulary, repetitions, hints, activities, draft/publish status and private conversations with learners. Every verified registered user can use AI feedback without lecturer approval. The owner can assign teacher access to registered users and enable a shared `teacher` login by choosing a password.

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

## Speaking review

Speaking feedback shows the correct character, pinyin and English meaning first, then the exact submitted recording, followed by recognised-word feedback, the lecturer's hint and English guidance for the target tones. The submitted recording replays when feedback arrives (with native play controls when autoplay is blocked). “Play model, then my voice” plays both in sequence. New takes, navigation and Stop audio cancel pending playback; delayed responses cannot replace a newer take.

A device Mandarin voice is preferred. Without one, the verified learner can request a server-generated OpenAI `gpt-realtime-2.1-mini` / `cedar` example of the published lesson word. WAV audio is cached in server-only `modelAudio` documents by model, character and pinyin. The server validates the generated transcript against the target; no arbitrary student prompt is accepted. The API key stays in Secret Manager. New example generations share the existing daily 40-per-user / 300-site AI quota; cached playback is free of further generation requests. Example audio is labelled AI-generated. Learner recordings remain temporary in the browser and are never stored in this cache.

Tone guidance describes the written target; transcription cannot identify an individual learner's tone error. Lecturer hints remain the source for sound-specific coaching. Tests cover feedback ordering, escaping, tone notation, playback order/cancellation, autoplay fallback, verified access, provider gating and example caching. A live model request produced a valid Mandarin WAV; browser QA used a synthetic recording and real example audio.

References: https://developers.openai.com/api/docs/guides/realtime-conversations and https://www.polyu.edu.hk/bepth/introduction-to-phonetics/tones/basic-tones/?sc_lang=en

## Website feedback

Visitors can open Feedback in the header or footer (direct link: /chinese/#feedback). No account is required. They can submit text, up to five screenshots, or both, with optional name and reply email. The browser accepts PNG/JPEG/WebP under 10 MB and converts them to bounded JPEGs before upload; previews support removal, paste and drag/drop. A retry reuses its request ID to prevent duplicate submissions.

Teaching administrators open Feedback inbox in the teaching space to read submissions and screenshots and mark items closed/reopen them. Replies use the optional supplied email address. No automatic feedback email is sent. Records and image documents are server-only under siteFeedback; existing default-deny Firestore rules prevent client reads and writes. The callable checks administrator authorization for reading and changing status. Submission is limited to ten per network per UTC day and 200 globally. Only a daily hashed IP is kept in quota document IDs, not raw IPs. Website feedback is separate from account/practice records and is not removed by account deletion.


## Access roles

All registered accounts default to Student. The verified Google owner account (kstouras@gmail.com) is the sole Admin and inherits student and teacher access. Owner-assigned Teachers can edit, preview, publish and unpublish weekly lesson content, and use People to delete student or teacher accounts, but cannot delete the administrator, assign roles, manage API keys/providers/mail settings, read other users’ messages, or open the feedback inbox. The existing protected admins collection now stores teacher assignments; legacy entries and the shared teacher account grant only teacher access, never technical administrator access.

The Admin uses People & practice → Make teacher / Make student to change assignments. Lucy Liu (lucy.liu@ucd.ie) is assigned Teacher. Authorization is enforced in the callable backend and Firestore rules as well as navigation. Teachers currently edit the shared curriculum across modules and weeks; no per-teacher week allocation is configured.


## Account menu and photos

The avatar opens a compact dropdown with profile identity, navigation and a prominent Sign out button. Profile & account settings supports a 192-pixel square custom JPEG avatar derived in the browser from PNG/JPEG/WebP (5 MB input limit); Google account photos are the default. Uploaded avatars are stored privately on the user profile and removed with account deletion. Account deletion is inside a collapsed section in profile settings and still requires reauthentication and typing DELETE.


## Personal performance and module assignments

Performance in the account dropdown shows a separate dashboard per module: twelve weekly rows and attempt-weighted module averages for writing without stroke retries, pinyin correctness, OpenAI word recognition and Azure pronunciation accuracy (when available). It uses existing attempts and speechFeedback records belonging only to the caller. Old speaking completion flags are never treated as accuracy. Empty weeks stay unscored. Suggestions highlight words with recorded retries, incorrect answers or recognition mismatches.

Teachers and the administrator can assign one or more modules in People → Assign modules. Assignments are private enrollment documents and do not remove historical results or restrict existing lesson browsing. Account deletion removes enrollments too. No cross-module grade or combined score across unlike skills is calculated.
