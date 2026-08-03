# Quiz asks — August 3, 2026

For the backend team. Two asks about the quiz. Both describe what we want.
You choose how to build it.

Update, same day: the owner opened the quiz to ALL registered accounts.
So the lock we need is smaller than first written — it only has to keep
guest accounts out.

## 1. Block guest accounts from the quiz on the server

- The quiz is now for every registered account.
- Guest accounts (the view-only accounts people get before they sign up)
  should not be able to play.
- Today they can: we tested it on August 3. A guest token started a quiz,
  answered a question, ended the session, and read the results — straight
  against the API.
- We want: the quiz endpoints refuse guest accounts with a clear "no
  access" error.
- Tell us what that error looks like (status code and message). The app
  will show the right screen for it.

## 2. Practice missed questions

- Today "practice again" starts a fresh session with new questions.
- We want a user to be able to practice only the questions they got wrong
  before.
- You design how it works. Tell us the shape when it is ready, and we will
  build the screen for it.
