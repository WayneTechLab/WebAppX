# SYSTEMX Long-Term Warnings

Production risk compounds over time. A successful first deploy does not prove
that a system will remain safe, affordable, compatible, or compliant.

- Cloud providers, SDKs, browsers, operating systems, prices, quotas, and
  support lifecycles change. Track the services you depend on.
- Firebase rules, IAM policies, authorized domains, and billing settings can
  drift as teams and requirements change. Review them regularly.
- Dependencies, hosted workflow services, MCP servers, and AI tools are supply-chain
  dependencies. Pin, review, update, and remove them deliberately.
- Agents and subagents multiply token and tool consumption. They can also
  duplicate work, make incorrect inferences, or expose context too broadly.
- AI output is untrusted until it is reviewed, tested, and approved by a human
  accountable for the resulting change.
- “Auto deploy” should never mean “unreviewed deploy.” Production changes need
  explicit authority, observable evidence, and a rollback plan.
- Privacy, accessibility, consumer protection, export control, tax, employment,
  and sector-specific requirements vary by location and product. Obtain advice
  appropriate to the jurisdiction.

This template is subject to change and modification. Fork, clone, and copy it
only after reviewing it for your use case; maintain your own release branch and
records. See [SYSTEMX Sync & Controlled Updates](SYSTEMX-Sync-and-Controlled-Updates).
