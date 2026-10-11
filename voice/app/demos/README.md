# Demo businesses

Every business is its own folder and shares nothing with the others except the engine
(`types.py` here, and `phone.py`, `cascade.py`, `live.py`, `session.py`, `email.py` in `app/`).

```
<business>/
  data/*.json   the business: profile, policies, staff, services, hours, inventory
  store.py      the only reader of data/ (and of any outside API); a live install swaps it for the client's system
  state.py      one call: its dataclasses, create_state and helpers
  prompt.py     the agent's instructions
  tools.py      the agent's operations
  view.py       what the dashboard shows
  __init__.py   builds the DemoDefinition
```

A built business is registered in `__init__.py` here. Each call starts from the JSON and keeps its
changes in memory, so nothing a caller books carries over to the next call.

## Phone lines

| Demo | Calls | Texts |
|---|---|---|
| Scheduling (Northline, Lune, Tidewell) | (720) 599-6395 | Shown on screen only |
| Law & professional (Alder & Finch, insurance, real estate) | (206) 887-9619 | **Yes, from (206) 887-9619**: intake forms and links, the account's only A2P-approved number (RankLadder texting campaign, registered to Digital Macaroni) |
| Retail (Form & Field, dealership, furniture) | (830) 239-2110 | Shown on screen only |
| Travel (Waypoint) | None yet | Shown on screen only |

Texts from (206) 887-9619 start with "Digital Macaroni demo:", link only to digitalmacaroni.io (no
shorteners), and go out only after the agent has asked on the call and said "Message and data rates may
apply. Reply STOP at any time to opt out."

## The twelve

| Demo (phone line) | Business | Folder | Built |
|---|---|---|---|
| Scheduling (Ellie) | Northline, heating & cooling | `northline/` | Yes |
| | Lune Salon & Med Spa | `lune/` | No |
| | Tidewell Clinic | `tidewell/` | No |
| Law & professional (Nora) | Alder & Finch, personal injury | `lawfirm/` | Yes |
| | Bluebird Insurance Agency | `insurance/` | No |
| | Juniper Row Realty | `realestate/` | No |
| Retail (Theo) | Form & Field, home goods | `formfield/` | Yes |
| | Auto dealership | `dealership/` | No |
| | Furniture showroom | `furniture/` | No |
| Travel (Linda) | Waypoint, flights | `travel/` | Yes |
| | Waypoint, hotels & stays | `hotels/` | No |
| | Waypoint, tours & packages | `tours/` | No |
