# Quiz asks — August 3, 2026

For the backend team. Two asks about the quiz. Both describe what we want.
You choose how to build it.

## 1. Lock the quiz on the server

- Our app shows the quiz only to researchers, admins, and superadmins.
- But that rule lives only in the app. The server does not check roles.
- We tested this on August 3. A guest account with no email started a quiz,
  answered a question, ended the session, and read the results — straight
  against the API.
- We want: the quiz endpoints accept only researcher, admin, and superadmin
  accounts. Everyone else gets a clear "no access" error.
- Tell us what that error looks like (status code and message). The app will
  show the right screen for it.

## 2. Practice missed questions

- Today "practice again" starts a fresh session with new questions.
- We want a user to be able to practice only the questions they got wrong
  before.
- You design how it works. Tell us the shape when it is ready, and we will
  build the screen for it.
