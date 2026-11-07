# TO-DO-List (SEPM project) - version 3

A multi-page task manager with a friendly AI assistant, deadline reminders, calendar, progress tracking,
achievements, and a Node.js + SQLite backend that saves everything you do.

## Run it

1. Install Node.js LTS (18 or newer) from nodejs.org.
2. Open a terminal in the folder that contains `server.js`.
3. `npm install`
4. `node server.js`
5. Open http://localhost:3000 in Google Chrome or Microsoft Edge.

## Pages

| Page | What it does |
|---|---|
| Dashboard | Today's attention list, progress ring, stats, welcome guide for new users |
| Tasks | Type or speak a task in plain words, search, filter, sort, edit, checklists |
| Board | Drag cards between To Do / In Progress / Done |
| Calendar | Month view of deadlines, click a day to see or add tasks |
| Reminders | Overdue, due today, next 7 days, snooze, desktop notifications |
| Focus | Pomodoro timer, sessions saved to tasks |
| Progress | Charts, on-time rate, activity history |
| Achievements | XP, levels and badges |
| AI Assistant | Natural chat: add, finish, move, delete tasks and plan your day (with Undo buttons) |
| Settings | Name, password, reminder time, voice language, data tools |
| Help | Tour of every page and answers to common questions |

## The AI assistant

It works with no setup in **offline mode**, understanding everyday sentences such as
"I need to buy milk tomorrow at 5pm", "I finished the report", "postpone the exam to next week",
"what's due this week?" or "I feel overwhelmed". Anything it does can be undone with the Undo button.

For open conversations on any topic, start the server with an Anthropic API key:

- PowerShell: `$env:ANTHROPIC_API_KEY="sk-ant-..."; node server.js`
- Mac/Linux: `ANTHROPIC_API_KEY=sk-ant-... node server.js`

Never commit your key to GitHub.

## Where data is saved

`todo.db` (SQLite) next to `server.js`: users, tasks, checklists, focus sessions, AI chat history and an
activity log. Delete `todo.db` to start fresh. Upgrading from an older version keeps your data.

## Working as a team

Use branches and pull requests (see your team's GitHub workflow). `todo.db` and `.env` are in `.gitignore`.
