# OpenStatus spoken review brief

OpenStatus checks whether a website or online service works, alerts the team when it fails, and gives customers a public page for incident updates. Those jobs belong together because a technical alert and a customer message should describe the same outage.

The code is open, and a technical team can host it or manage checks through developer tools. The main uncertainty is long-term reliability because formal customer history is very thin.

I would break a disposable endpoint several ways and measure detection, paging, customer updates, and recovery. I would also break the monitor itself before trusting it.
