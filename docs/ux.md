<!-- cspell:ignore Arbeiter Vorarbeiter Crewmeister -->
# UX and flows

HullOps is meant for people who work on a shipyard, not for people who like software. This page is the thinking behind how it should feel: who uses it, what they do, and what "simple enough" means. It also marks what is built and what is still a plan.

## Where it starts

Today planning and communication on the yard run through WhatsApp, and working hours and leave live in Crewmeister. Chat is fast but it loses things: which crew is on which vessel next week, who asked for what, whether the office said yes. The goal is to move the **planning** into one place and keep chat for what is live.

## Who uses it, and on what

These are assumptions to check with real users, not facts.

| Role | Does what | Mostly on |
|---|---|---|
| Team lead (*Vorarbeiter*) | Asks for workers for his vessel for the coming week, follows his vessel's orders | A PC in the container office, sometimes a phone |
| Project lead (office) | Plans orders, staffs them, answers the team leads, invoices the customer | A PC |
| Worker (*Arbeiter*) | Sees today's orders and reports their status | A phone, on the yard |
| Administrator | Manages accounts | A PC |

## The bar: explainable in an hour

The test for every screen: **any new user, whatever the role, can use it after one hour of explanation on their first day**, without being "a phone and PC wizard". That holds for the worker with a phone on the yard, the team lead in the container office, the project lead at the office and the administrator alike. Nobody gets a harder app because their job is more complicated; a project lead's screens simply do more things, in the same way. That leads to these rules:

1. **Choose, don't type.** Work, vessel, method, surface, dates, crew: everything that can be categorized is a button. Free text is for real exceptions ("Other…" or an optional note).
2. **One pattern everywhere.** Big labelled buttons, and one clearly marked button at the bottom to save. No hidden menus, no swipes, no long presses. If you understand one screen you understand them all.
3. **Each role sees only its own work.** A worker's start page is "my orders today"; a team lead's is "my vessel". Not one menu with everything for everyone.
4. **Everything visible, top to bottom.** A form shows all its steps from the start, numbered, with sensible choices already made (today, one week, last order's yard, last week's crew). Nothing pops up unexpectedly.
5. **Use the yard's words**, in the user's language (German by default for the yard).
6. **Forgiving.** A mistake can be corrected or cancelled; only finishing an order asks "sure?".
7. **Safe to practice.** A practice account with made-up data, and a short "how it works" page.

## The three moments that matter

### 1. Team lead: next week's request (PC)

With automatic planning (below) this screen is what opens when he chooses **Change**; most weeks he only checks and presses OK.

```
 Good morning Heinz                                      Naval Vessel N1
 ───────────────────────────────────────────────────────────────────
  Request for next week (26 Oct - 1 Nov)
  Not filled in yet                           [ Fill in now ]

  Orders on your vessel:  3 running · 1 late
```
```
 How many people do you need?           [ - ]   10   [ + ]

 Who would you like to keep?   (as last week)
  [x] Piotr    [x] Sofia    [x] Mehmet    [ ] Anna    [ ] Tom
                       Anna: already requested for another vessel

 Note (only if needed)  [                                    ]

                                   [ Send to the office ]
```
He keeps the same people on the same vessel by default, and only changes what differs.

### 2. Project lead: a new order (PC)

```
 1  Which vessel?     [ Calypso ]  [ Naval Vessel N1 ]
 2  What kind?        [ Cleaning ]  [ Protection ]
 3  What exactly?     [ High-pressure ] [ Blasting ] [ Manual ] [ Other… ]
                      Where?  [ Hull ] [ Deck ] [ Interior ] [ Other… ]
 4  When?             [ Today ] [ Tomorrow ] [ Next Monday ]
                      How long?  [ 1 day ] [ 3 days ] [ 1 week ] [ 2 weeks ]
 5  Who?              [ Mehmet ] [ Sofia ] [ Piotr ]        (can be later)

 Summary: High-pressure, hull · Calypso · 26 Oct - 1 Nov
                                              [ Create order ]
```
The yard and berth come from the last order on that vessel; nobody invents a title.

### 3. Worker: reporting status (phone)

```
 My orders today
 ┌──────────────────────────────────────┐
 │ High-pressure, hull        Calypso   │
 │ Started                              │
 │             [   DONE   ]             │
 └──────────────────────────────────────┘
```
One big button per order.

## Planning that mostly happens by itself

In practice the same people stay on the same vessel week after week. So the app **carries last week's crew over to next week by itself**, except for workers who are not available. Entering a request becomes the exception, not the routine, and that is much less work for everyone.

What the team lead sees on Monday, instead of an empty form:

```
 Request for next week (26 Oct - 1 Nov)               planned automatically
  10 people · same crew as last week
  Piotr, Sofia, Mehmet        Anna: not available (leave) → 1 more needed

                                          [ OK ]   [ Change ]
```

**Changes in a busy week** keep going through WhatsApp: the team lead tells the project lead, and the **project lead changes the plan in the app**, for example by moving workers to a vessel with more work. The app helps with warnings (a worker asked for by two vessels; a vessel that is short) instead of replacing the conversation.

How it works, as rules that can be tested:

1. Last week's request is the starting point: the same total and the same workers asked for by name.
2. A named worker is kept only if available that week (active, and not away). The total stays the same, so a missing worker shows up as "1 more needed" instead of silently shrinking the request.
3. A request someone entered by hand is **never overwritten**; only vessels without a request for that week are filled in.
4. An automatically planned request is marked as such, so nobody mistakes it for something a person decided.
5. It runs once a week for the coming week, and the project lead can also trigger it.

This needs **availability data** (who is on leave). That comes from Crewmeister later (see the README); until then the office marks workers as unavailable, and the demo uses sample data.

## How to know it works

- **Three tasks per role**, for every role without exception, each doable by a new user after ten minutes of explanation. Team lead: fill in next week's request, look at his vessel's orders, report a status. Project lead: create an order, see the week's staffing and where it falls short, answer a request. Worker: find today's orders, report a status.
- **One real team lead tries it** while someone watches and says nothing. Where he hesitates is where the screen is wrong.
- Count taps and typed characters per task, and aim to shrink both.

## Open questions

- **Confirmation.** Today the office answers "ok" in WhatsApp. Should a request show as *confirmed* (possibly with a changed number) so the team lead doesn't have to ask?
- **Reminders.** With automatic planning a request is rarely missing; a vessel that had no request last week has nothing to carry over and shows up for the office.
- **Availability.** Seeing who is on leave while choosing the crew needs Crewmeister (see the README).

## Where we are

| Built | Planned |
|---|---|
| Status buttons for workers and team members; comments; team management | A start page and menu per role |
| Weekly request per vessel with workers by name, a team lead per vessel, a warning for double-booked workers | Number stepper and last week's crew pre-ticked as shown above |
| Order form with a vessel list and choices for service, protection kind and materials | The full choice-based order form shown above (method, surface, dates and crew as buttons) |
| Mobile first layout, installable as a PWA, English and German | Editing and cancelling orders; confirmation; practice account |
| | Automatic planning from last week, and availability (leave) as the input it needs |
