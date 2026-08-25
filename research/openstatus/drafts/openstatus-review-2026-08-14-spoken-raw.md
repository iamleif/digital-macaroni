# OpenStatus review: break something before trusting it

OpenStatus watches websites and online services. It checks them on a schedule, alerts the team when something is wrong, and gives customers a public page where they can see what is working.

Those jobs belong together. When an API stops responding, the team needs to hear about it. Customers need a plain update too. A monitor that sends a technical alert but leaves the public page green only solves half the problem.

OpenStatus is interesting because it combines both sides and keeps the code open. We would test it by breaking something safe on purpose. A row of green checks says almost nothing about whether an outage will be handled correctly.

## What OpenStatus actually does

A monitor is a repeated question. Does this web address return the right response? Is this network port open? Does this DNS record still point where it should? OpenStatus asks those questions from one or more locations and keeps the response time and result.

If a check fails, it can send an alert through email, Slack, Discord, a webhook, WhatsApp, SMS, PagerDuty, OpsGenie, or Grafana OnCall. The team can open an incident, mark the affected parts of the product, post updates, and tell subscribers when the service recovers.

The public status page is what customers see. It may list the website, API, file processing, and payment system as separate components. During an outage, customers should see the affected component, when the problem began, what the team knows, and the latest update.

OpenStatus also has tools for developers. It offers an API, a command-line tool, SDKs, Terraform support, and OpenTelemetry export. Terraform lets a team define monitors in configuration files and review changes with the rest of its infrastructure. The code is available under the AGPL-3.0 license, and the project documents self-hosting.

## Break a service you can safely break

The first useful test is a real failure on a disposable endpoint. Do not take down the production website. Create a small test service that behaves like the real one and let OpenStatus watch it.

First, stop it completely. Record when the failure begins, when OpenStatus notices, when the first alert arrives, and when the status page changes. Confirm that the person on call receives the alert on the device that matters after office hours.

Then make the service return a page that says “OK” with the wrong status code. After that, return a successful status code with the wrong content. A service can be online and still be broken. The monitor should test the part that customers actually need, not just whether a server answers.

Try a slow response too. If the normal checkout finishes in one second, a 20-second response may be an outage in practice. Set the timeout and alert threshold around customer harm, not a convenient default.

Finally, restore the service. Make sure the recovery alert arrives and the status page does not claim recovery before the service is stable. Watch for alert flapping, where a failing service sends “down,” “up,” and “down” messages every few minutes.

This route gives the product one clear job: tell the truth before a customer has to report the problem.

## Several locations can prevent a false alarm

OpenStatus can run a check from several regions. This helps separate a real outage from a problem at one monitoring location.

Imagine the site works in Oslo and New York but one probe in Singapore cannot reach it. Paging the whole team for a worldwide outage would be wrong. Ignoring Singapore would also be wrong if customers there are affected.

Decide the rule before the test. It might require failures from two regions before paging the main on-call person. A single-region failure might create a lower-priority alert for investigation. The public page should say which customers are affected if the trouble is local.

Starter can check each monitor from up to six of 28 regions. Pro and Scale can use all 28. More regions are not automatically better. They create more results, more possible noise, and more choices about when an incident is real. Use the places that match the customer base.

A private location runs a probe inside the company's own network. It is useful for an internal service that the public internet cannot reach. It is included on Pro and above. Test what happens when the private probe itself stops. A missing probe must not look identical to a healthy internal service.

## The status page is written for customers

Technical teams tend to publish the message they would send each other: “Elevated 5xx errors from the primary ingress.” Many customers only need to know that sign-in is failing, existing sessions still work, and the next update will arrive in 20 minutes.

Create an incident template for each major part of the product. Name the customer action that is affected. Do not guess at a cause before it is known. Give a time for the next update, even if the update says the team is still investigating.

Test a planned maintenance notice too. Subscribe with email and any other channel customers will use. Check the first notice, every update, and the final message. Make sure a subscriber can leave easily.

Open the page on a phone, with a screen reader if that matters to the audience, and on a slow connection. The page is supposed to reduce support questions during a stressful event. If customers cannot understand it quickly, the status page is adding another problem.

OpenStatus has a useful advantage here. Monitoring data and incident communication live close together. That can make it easier to show the right components and current numbers. The team still has to write useful messages. No chart can explain customer impact by itself.

## Self-hosting is control plus another service to run

OpenStatus is open source and can be self-hosted. That gives a team access to the code, its own data route, and more control over deployment. The repository has attracted thousands of stars and hundreds of forks, which shows strong developer interest for a project of this size.

Stars do not show whether pages arrived on time during a 3:00 a.m. outage. They also do not remove the work of self-hosting.

The team becomes responsible for the database, upgrades, backups, email and message delivery, security fixes, probes, certificates, and the monitoring system's own availability. If OpenStatus runs in the same cluster, cloud account, DNS setup, and network as the product it watches, one failure can take out both the service and its watchdog.

Host the important parts outside the failure zone they must detect. Keep a separate way to tell customers about an outage if the main status system is unavailable. Test an upgrade and a restore from backup before calling the self-hosted setup ready.

For many small teams, paying for the hosted service will be cheaper than owning that work. Self-hosting makes sense when control, internal access, data rules, or the ability to change the code is important enough to justify an operating plan.

## Pricing starts clearly and can rise quickly

The free Hobby plan includes one monitor and one status page with three components. It checks no more often than every ten minutes. That is useful for learning the product or watching a low-risk personal site. Ten minutes is too slow for many paid services.

Starter costs $30 per month. It includes 20 monitors, one-minute checks, up to six regions per monitor, three months of data, one status page with 20 components, a custom domain, subscribers, and ten notification channels.

Pro costs $100 per month. It includes 50 monitors, 30-second checks from all 28 regions, 12 months of data, five status pages, private locations, OpenTelemetry export, custom status-page themes, an audit log, and 20 notification channels.

Scale costs $500 per month. It still lists 50 monitors but raises status-page and component limits, keeps data for 24 months, and includes white-labeling. Enterprise terms cover larger limits, custom regions, contracts, security reports, and a dedicated service agreement.

Annual billing gives two months free. Starter is $300 per year, Pro is $1,000, and Scale is $5,000. The company states a 30-day refund policy.

The add-ons matter. An extra status page costs $20 per month. White-labeling costs $300 per month on Starter or Pro. Email authentication and IP restriction each cost $100 per month where not included. SAML single sign-on is listed at $250 per month on all three plans. Add-ons are billed monthly even when the main plan is annual.

List the real number of monitors, pages, components, regions, alert routes, users, and months of history. Add customer access rules and branding. A $30 plan can become a very different bill when a sales or security requirement calls for identity controls.

## The customer history is still thin

OpenStatus launched publicly in July 2023 and has strong attention in the developer community. The open code, self-hosting, and combined status-page approach are real differences in a crowded monitoring market.

The formal review record is extremely small. Product Hunt had two reviews. Trustpilot had one. A customer showcase adds an attributable comment but sits close to the vendor. Hacker News contains useful technical questions and market criticism, but many commenters were not long-term customers.

That means we cannot make a strong claim about years of alert reliability or support during serious incidents. We did not run a monitor or contact support either. Early posts mention infrastructure failures and changes of direction, but those belong to the project's history and should not be presented as current defects.

The right response to thin evidence is a harder trial. It is not blind trust, and it is not an automatic rejection.

## Who should choose OpenStatus?

OpenStatus is worth testing for a technical team that wants uptime checks, incident updates, and public status pages in one place. It is especially interesting if the team wants inspectable code, self-hosting, Terraform, an API, or private probes.

It is unnecessary if the existing monitor already catches the failures that matter, reaches the right person, and updates a trusted status page. It is also a poor self-hosting project for a team that does not want to operate another critical service.

Our decision rule is to break a disposable endpoint in several ways. Stop it. Slow it down. Return the wrong code and the wrong content. Fail one region. Silence one notification route. Open an incident, write customer updates, accept a subscription, and recover.

Measure detection time, alert delivery, false alarms, customer wording, and recovery. Then test the monitoring system's own outage. Keep OpenStatus if the right person and the customer get the right answer before either one has to guess.
