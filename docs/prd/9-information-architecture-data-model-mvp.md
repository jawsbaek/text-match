# 9. Information Architecture / Data Model (MVP)

Entities

- Service(id, code, name, owners[])
- Namespace(id, service_id, name)
- Key(id, service_id|null for common, namespace_id, key_name, tags[], status)
- Translation(id, key_id, locale, value, status, version, checksum)
- Suggestion(id, translation_id, source, score, violations[])
- GlossaryTerm(id, term, locale, preferred, discouraged, aliases[])
- ReleaseBundle(id, service_id, locales[], created_at, snapshot_ref)
- User(id, email), Role(id, name), Permission(map)
- Event(id, actor, action, entity_ref, before, after, created_at)
