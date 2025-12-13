Always use bun. Not pnpm or npm.

Install required components to the ui folder if they're not there by using a command like this one:
bunx --bun shadcn@latest add dropdown-menu

Use the shadcn mcp tools to get the available components.

Only create components after checking this registery first.

Don't add components to the /ui/ folder because that's only for shadcn components

Create custom ui components in /custom-ui/

Use shadcn components based on base-ui. Don't use radix ui for anything.

Use tailwind v4

Use typescript best practices

This project is a way to look at claude code conversations and debug them but we might add more ai agents later.