[WIP so expect some small bugs]

## Summary:

This app lets you view your full conversations with Claude Code by making the jsonl conversation files that Claude Code stores in `~/.claude/projects` look nice.

Doesn't hide anything including tool calls, warmup messages, etc.

Great for diving into what actually goes on behind the scenes when you're using Claude Code.

System message is attached server side so this doesn't include that but it includes almost everything else.

## How to use it:

Clone the repo then `bun i` then `bun run dev`

Then just click on the folder browser in the top left corner and pick the ~/.claude/projects folder (automatically copied to you clipboard so just hit cmd + v in the file picker).

## Screenshots:

### User messages and hidden meta info example:
<img width="1713" height="1333" alt="2025-12-28_Vivaldi Snapshot_08-11-38" src="https://github.com/user-attachments/assets/e7603d39-ef8b-4865-ab01-b35d79778a7f" />

### Agent replies example:
<img width="1713" height="1333" alt="2025-12-28_Vivaldi Snapshot_08-11-57" src="https://github.com/user-attachments/assets/e505dd39-1bbb-43fc-804b-344c31d0fba5" />

### Export as MD to file or clipboard:
<img width="1667" height="1325" alt="2025-12-28_Vivaldi Snapshot_09-34-16" src="https://github.com/user-attachments/assets/d531ca6e-75ab-44da-96b7-b0e8f637f894" />

### Welcome screen:
<img width="1657" height="1330" alt="2025-12-28_Vivaldi Snapshot_08-38-15" src="https://github.com/user-attachments/assets/a7eddbad-3ec5-4a2c-8bcd-3b200a80f8e3" />
