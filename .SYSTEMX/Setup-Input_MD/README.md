# Setup Input Packets

This is the default import workspace for setup packet zips produced outside the
repo by a human or LLM during setup.

Use this folder when:

- A setup packet zip was exported to Downloads.
- The user or LLM returned one updated zip instead of many loose markdown files.
- The setup scripts need a stable repo-local place to unpack, validate, and
  inspect returned packet contents.

## Expected Flow

1. Run:

   ```bash
   bash .SYSTEMX/scripts/build-setup-packet.sh
   ```

2. The script asks `Mac` or `Windows`, stack mode, edition, packet tier, and
   packet shape.
3. One setup zip is written to the OS Downloads folder.
4. Return one updated setup zip and import it here.
5. Continue setup through `WSG-MENU`.

You can also inspect this folder by command:

```bash
bash .SYSTEMX/scripts/import-setup-packet.sh
```

In `WSG-MENU`, use:

- `2) Setup & Tooling` -> `10) Export setup packet zip (Downloads first)`
- `2) Setup & Tooling` -> `11) Import/validate setup packet zip`

## Safety

- Do not save live secrets here.
- Use placeholders for keys, tokens, service account JSON, Stripe secrets, and
  mailbox credentials.
- Real secrets belong in ignored env files or provider secret stores.

Imported packet folders and legacy markdown runs are ignored by git. Keep this
README as the tracked anchor.
