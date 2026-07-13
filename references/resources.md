# Authoritative Resource Strategy

Raspberry Pi Maker uses a curated, machine-readable catalog at
`data/resources.json`. Use `pi_resource_search` to find entries and
`pi_board_compare` to compare indexed board profiles.

## Coverage

The catalog deliberately covers resources at two levels:

- The official Raspberry Pi hardware catalog and Product Information Portal
  cover the complete historical and current product range, including model
  revisions, legacy boards, obsolescence notices, mechanical drawings, and
  controlled product documents.
- Individual entries make current and commonly encountered boards,
  accessories, software stacks, sensors, displays, converters, and drivers
  discoverable by their everyday names and aliases.

No static community package can safely mirror every third-party module sold
under a common name. For generic modules such as HC-SR04, RC522, DHT22, GY-521,
relay boards, or motor-driver boards, identify the exact PCB marking and seller
documentation before trusting a pinout. The underlying chip datasheet does not
describe every breakout board.

## Source Priority

Use sources in this order:

1. exact board/module manufacturer documentation and current errata
2. Raspberry Pi official documentation and Product Information Portal
3. upstream software documentation
4. the exact breakout vendor's guide and schematic
5. reputable supplier integration guides
6. community posts only as corroborating evidence

For safety-critical values such as absolute maximum ratings, supply voltage,
logic thresholds, current, timing, thermal limits, and connector orientation,
open the current source document and verify its revision. Do not rely on the
catalog summary alone.

## Copyright And Availability

"Publicly accessible" is not the same as "public domain." Raspberry Pi's
documentation states that it is licensed under CC BY-SA 4.0, while product
briefs and third-party datasheets can have different publisher terms. The
plugin therefore stores links, attribution, short original summaries, and
safety metadata; it does not bundle or republish third-party PDFs.

## Freshness

Every release must validate the catalog schema, unique identifiers, HTTPS
links, publishers, authorities, lifecycle tags, and review date. Before a
release, maintainers should also spot-check current-board, official-accessory,
and high-risk-component links and update the top-level `reviewedOn` date.
