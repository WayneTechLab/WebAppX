# Printable portal evaluator worksheet

Print the [one-page A4 worksheet](../output/pdf/portal-evaluator-checklist.pdf)
at actual size. It provides spaces for evaluator/date, source commit/build,
the exact browser origin, observed results for HR/CMS/CRM/recovery and follow-up
evidence. It is a paper worksheet with blank writing lines, not a completed
acceptance record or an interactive PDF form.

Use the matching timed demonstrations for actors, exact controls and complete
expected records:

- [HR - five-minute script](demos/HR-FIVE-MINUTE.md)
- [CMS - five-minute script](demos/CMS-FIVE-MINUTE.md)
- [CRM - five-minute script](demos/CRM-FIVE-MINUTE.md)
- [Recovery - ten-minute script](demos/RECOVERY-TEN-MINUTE.md)

The scripts are designed for those human pacing budgets. Automation elapsed
time is separate evidence. Start in a fresh evaluation browser context with
`webappx-portal-smoke-v1`, and record scheme, hostname and port from the actual
printed local origin. Preserve your ordinary browser profile and saved work.
These expectations describe fictional native simulations and establish no
connected provider or real payroll acceptance.

The printed HR scenario expects 17.75 hours, $532.50 gross, $106.50 illustrative
withholding, $25 benefits and $401 net. CMS freezes published revision 2 after
a revision-3 draft edit. CRM converts a $1,750.25 opportunity and moves it through
the stated open stages, retaining $8,250.25 open pipeline. Recovery selects only
CMS and checks HR/CRM continuity before reversing the selection with Undo.
Different older native and SDK demonstrations retain their own starting states
and totals; do not combine their expected receipts with this worksheet.

## Reproduce and review the print artifact

The optional [ReportLab generator](../scripts/generate-evaluator-checklist.py)
uses only public authored text and the reviewed seed digest. It writes the fixed
`output/pdf/portal-evaluator-checklist.pdf` path through an atomic replacement
and refuses linked output paths. Install ReportLab in your own documentation
tool environment when regenerating; it is not required to run WebAppX.

```bash
python3 scripts/generate-evaluator-checklist.py
pdfinfo output/pdf/portal-evaluator-checklist.pdf
pdftoppm -png -singlefile output/pdf/portal-evaluator-checklist.pdf /local/worksheet-review
```

The last path is an operator-selected local rendering destination. Require
exactly one page, then inspect the rendered PNG for clipping, overlaps, readable
text and usable writing space. Text extraction alone cannot prove print layout.
The generator uses deterministic PDF metadata; the actual worksheet review date
is printed on the page and execution evidence belongs in a dated QA receipt.

Initial local review confirmed one A4 page, all four exercise sections, exact
origin and observation fields, complete expected totals and a legible rendered
layout. This verifies the printable artifact; completing its blank fields is
the evaluator's later observation.
