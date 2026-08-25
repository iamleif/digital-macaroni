OpenStatus watches websites and online services. It checks them on a schedule, alerts the team when something is wrong, and gives customers a public page where they can see what is working.

Those jobs belong together. When an API stops responding, the team needs to hear about it. Customers need a plain update too. A monitor that sends a technical alert but leaves the public page green only solves half the problem.

OpenStatus is interesting because it combines both sides and keeps the code open. We would test it by breaking something safe on purpose. A row of green checks says almost nothing about whether an outage will be handled correctly.

We recommend OpenStatus for a technical team that wants an open status page and is comfortable with a younger product.

## What OpenStatus actually does

A monitor is a repeated question. Does this web address return the right response? Is this network port open? Does this DNS record still point where it should? OpenStatus asks those questions from one or more locations and keeps the response time and result.

If a check fails, it can alert the team through email, Slack, Discord, a webhook, WhatsApp, SMS, PagerDuty, OpsGenie, or Grafana OnCall. The team can open an incident, mark the affected parts, post updates, and tell subscribers when the service recovers.

The status page is what customers see. It may list the website, API, file processing, and payments as separate parts. During an outage, customers should see what is affected, when the problem began, what the team knows, and when another update will arrive.

OpenStatus also has an API, a command-line tool, SDKs, Terraform support, and OpenTelemetry export. Terraform lets a team define monitors in files and review changes with the rest of its infrastructure. The code uses the AGPL-3.0 license, and the project documents self-hosting.

## Break a service you can safely break

Create a small test service that behaves like the real one. Do not take down production.

Stop the test service. Record when the failure begins, when OpenStatus notices, when the first alert arrives, and when the status page changes. Confirm that the person on call receives the alert on the device that matters outside office hours.

Then return a page with the wrong status code. After that, return a successful status code with the wrong content. A service can be online and still be broken. The monitor should test the action customers need, not just whether a server answers.

Try a slow response too. If checkout normally finishes in one second, a 20-second answer may be an outage in practice. Set the timeout around customer harm, not a convenient default.

Restore the service. Make sure the recovery alert arrives and the page does not claim recovery before the service is stable. Watch for repeated down and up alerts from a service that remains unstable.

This route gives the product one clear job: tell the truth before a customer has to report the problem.

## Several locations can prevent a false alarm

OpenStatus can run checks from several regions. This helps separate a real outage from a problem at one monitoring location.

Imagine the site works in Oslo and New York, but a probe in Singapore cannot reach it. Paging the whole team for a global outage would be wrong. Ignoring Singapore would also be wrong if customers there are affected.

Decide the rule before the test. The main page might require failure from two regions. One failed region might send a lower-priority alert. The customer update should say where the trouble is when the effect is local.

Starter can use up to six of 28 regions for each monitor. Pro and Scale can use all 28. More regions are not always better. They make more results and more possible noise. Use the places that match the customer base.

A private location runs a check inside the company's network. It is useful for an internal service the public internet cannot reach. Test what happens when the private probe stops. A dead probe must not look like a healthy internal service.

## Write the status page for customers

Technical teams may publish a message such as “Elevated 5xx errors from the primary ingress.” Many customers only need to know that sign-in is failing, existing sessions still work, and another update will come in 20 minutes.

Prepare a short template for each major part of the product. Name the customer action that is affected. Do not guess at a cause. Give a time for the next update, even if the team is still investigating.

Test planned maintenance too. Subscribe with email and the other channels customers will use. Check the first notice, later updates, recovery, and the unsubscribe route.

Open the page on a phone and a slow connection. Test keyboard and screen-reader use if those needs apply. The page should reduce support questions during a stressful event. If customers cannot understand it quickly, it adds another problem.

Monitoring data and customer updates live close together in OpenStatus. That is useful. The team still has to write clearly. A response-time chart cannot explain customer impact by itself.

## Self-hosting gives control and work

OpenStatus is open source and can be run on the team's own infrastructure. The repository has thousands of stars and hundreds of forks. That shows serious developer attention for a project of this size.

Stars do not show whether an alert arrived during a 3:00 a.m. outage. They also do not operate the self-hosted service.

The team becomes responsible for the database, upgrades, backups, message delivery, security fixes, probes, certificates, and the monitor's own uptime. If OpenStatus runs in the same cluster, cloud account, DNS setup, and network as the product it watches, one failure may take out both the service and its watchdog.

Host the watchdog outside the thing it watches. Keep another way to update customers if the main status system is unavailable. Test an upgrade and a backup restore before depending on the self-hosted version.

For many small teams, the hosted product will cost less than owning this work. Self-hosting makes sense when code access, internal checks, data rules, or deployment control justify the extra service.

## Pricing starts low but the add-ons matter

Hobby is free. It includes one monitor and one status page with three parts. It checks no more often than every ten minutes. That is fine for learning or a low-risk personal site. It is too slow for many paid services.

Starter costs $30 per month. It includes 20 monitors, one-minute checks, up to six regions per monitor, three months of data, one page with 20 parts, a custom domain, subscribers, and ten notification routes.

Pro costs $100 per month. It includes 50 monitors, 30-second checks from all 28 regions, 12 months of data, five pages, private locations, OpenTelemetry export, custom themes, an audit log, and 20 notification routes.

Scale costs $500 per month. It raises page and component limits, keeps data for 24 months, and includes white-labeling. Enterprise terms cover larger limits, custom regions, security reports, contracts, and a dedicated service agreement.

Annual billing gives two months free. Starter is $300 per year, Pro is $1,000, and Scale is $5,000. The company states a 30-day refund policy.

An extra page costs $20 per month. White-labeling costs $300 per month on Starter or Pro. Email login and IP restriction each cost $100 per month where not included. SAML single sign-on is listed at $250 per month. These add-ons are billed monthly even when the main plan is annual.

Count the real monitors, pages, regions, alert routes, history, branding, and customer access rules. A $30 plan can become a different bill when a security requirement calls for identity controls.

## The customer history is thin

OpenStatus launched publicly in July 2023. Its open code, self-hosting, and combined monitoring and status page are real differences in a crowded market.

There are very few formal customer reviews. Product Hunt had two. Trustpilot had one. A customer showcase adds a named comment but sits close to the vendor. Hacker News contains useful technical questions, but many commenters were not long-term users.

We cannot use that record to promise years of alert reliability or strong support during an incident. We did not run a monitor or contact support either. Early posts mention infrastructure problems and changes in direction, but those are history, not current defect claims.

Thin evidence calls for a harder trial. It does not call for blind trust or automatic rejection.

## Who should choose OpenStatus?

OpenStatus is worth testing for a technical team that wants checks, incident updates, and public status pages in one place. It is especially interesting if the team wants inspectable code, self-hosting, Terraform, an API, or private probes.

It is unnecessary if the current monitor already finds the failures that matter, reaches the right person, and updates a trusted page. It is also a poor self-hosting project for a team that does not want to operate another critical service.

Our rule is to break a disposable endpoint in several ways. Stop it. Slow it down. Return the wrong code and the wrong content. Fail one region. Silence one alert route. Open an incident, write customer updates, add a subscriber, and recover.

Measure detection time, alert delivery, false alarms, customer wording, and recovery. Then test the monitoring system's own outage. Keep OpenStatus if the right person and the customer get the right answer before either one has to guess.
