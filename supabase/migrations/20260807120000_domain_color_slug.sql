-- Domain (and project) colour stops being a hex string and becomes a palette
-- slug. A stored hex cannot theme-switch, and dark is a full peer of light
-- now — so the row names a slot (`health`) and the theme resolves it to a
-- light/dark pair through var(--domain-health) in app/globals.css.
--
-- The column stays `text`; what changes is the vocabulary it holds. Validation
-- remains Zod-side (ColorSlugSchema in lib/schemas/color.ts), as it was for the
-- hex it replaces — no CHECK here, mirroring 20260724170000_domain_color.sql.
--
-- Mapping is by domain name, not by colour distance: there are eight rows plus
-- the system Inbox, the palette was designed against these exact domains, and
-- the hexes being replaced were tuned for a warm linen ground two identities
-- ago, so their values carry no information worth preserving.
--
--   Engine → engine (Iris)      Health → health (Fern)
--   Family → family (Orchid)    Spirituality → spirit (Clay)
--   Finance → finance (Azure)   Code → code (Cyan)
--   Travel → travel (Brass)     Home → pine (a spare slot)
--
-- Home is not one of the seven seeded domains, but it is a live, coloured
-- domain and the palette carries two spares for exactly this. Anything else —
-- including every remaining hex on projects.color — goes null rather than
-- guessing a slot for it.

update stewardship_domains
set color = case lower(name)
	when 'engine' then 'engine'
	when 'health' then 'health'
	when 'family' then 'family'
	when 'spirituality' then 'spirit'
	when 'finance' then 'finance'
	when 'code' then 'code'
	when 'travel' then 'travel'
	when 'home' then 'pine'
	else null
end
where color is not null
	or lower(name) in ('engine','health','family','spirituality','finance','code','travel','home');

-- Projects have no name-based mapping to make: the column is free-form and the
-- picker never offered it. Clear anything that is not already a slug.
update projects
set color = null
where color is not null
	and color not in ('engine','health','family','spirit','finance','code','travel','pine','burgundy');
