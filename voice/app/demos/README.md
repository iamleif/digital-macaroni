# Demo businesses

Every business is its own folder and shares nothing with the others except the engine
(`types.py` and the appointment engine `booking.py` here, and `phone.py`, `cascade.py`, `live.py`, `session.py`, `email.py` in `app/`).

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

Every business has its own number; the number alone decides which agent answers (`app/config.py`).
Bought October 11, 2026 on the Twilio account; about $1.15 a month each.

| Business | Number | Area code is |
|---|---|---|
| Northline | (720) 599-6395 | Denver |
| Lune | (323) 312-3248 | Los Angeles |
| Tidewell | (971) 366-2375 | Portland |
| Alder & Finch | (206) 887-9619 | Seattle; **the only number that texts** |
| Bluebird Insurance | (478) 707-3907 | Macon, GA |
| Juniper Row Realty | (512) 645-1952 | Austin |
| Form & Field | (830) 239-2110 | Texas Hill Country |
| Woodward Motor Co. | (313) 351-1780 | Detroit |
| Furniture showroom | (312) 820-9899 | Chicago |
| Waypoint flights | (929) 333-3608 | New York |
| Palmetto Stays | (786) 305-3013 | Miami |

Only (206) 887-9619 is A2P-approved, so it sends every real text for the law & professional businesses
(Alder & Finch, insurance, real estate): intake forms and links. Every other business shows its texts on screen.
Texts from (206) 887-9619 start with "Digital Macaroni demo:", link only to digitalmacaroni.io (no
shorteners), and go out only after the agent has asked on the call and said "Message and data rates may
apply. Reply STOP at any time to opt out."

## The eleven

| Demo (phone line) | Business | Folder | Built |
|---|---|---|---|
| Scheduling (Ellie) | Northline, heating & cooling | `northline/` | Yes |
| | Lune Salon & Med Spa, Los Angeles | `lune/` | Yes |
| | Tidewell Clinic, Portland | `tidewell/` | Yes |
| Law & professional (Nora) | Alder & Finch, personal injury | `lawfirm/` | Yes |
| | Bluebird Insurance Agency, Macon GA | `insurance/` | Yes |
| | Juniper Row Realty, Austin (real RentCast listings) | `realestate/` | Yes |
| Retail (Theo) | Form & Field, home goods | `formfield/` | Yes |
| | Woodward Motor Co., auto dealership | `dealership/` | No |
| | Furniture showroom | `furniture/` | No |
| Travel (Linda) | Waypoint, flights | `travel/` | Yes |
| | Palmetto Stays, hotels (live LiteAPI hotels and rates) | `hotels/` | Yes |
