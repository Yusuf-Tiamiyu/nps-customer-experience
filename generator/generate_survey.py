"""Synthetic customer-experience survey for a fictional diagnostic lab network.

Writes Raw_Data/Customer Survey Demo Diagnostics(1-N).xlsx in the same column
layout as a Microsoft Forms export, including its quirks (non-breaking spaces in
headers and answers, a typo in one question, free-typed branch names, "Nil" and
"N/A" non-answers), so the ETL has the same mess to clean as it would in real use.

Nothing here is real. Branches, referring clinics, people, emails and phone
numbers are invented; emails use example.com and phone numbers use +234 000.

Patterns built in for the analysis to find:
  * late urgent results are the strongest driver of a low recommend score
  * Ikorodu has slow results; Benin City's call centre is hard to reach
  * referring (external) clients are harder to please than walk-ins
  * from January 2026 a results-SMS and callback programme reduces call-centre
    and results complaints, and the score recovers
  * "Were your complaints addressed?" is answered "Yes" by many people who had
    no complaint, which inflates the apparent resolution rate

Run:  python generator/generate_survey.py
"""
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 20250301
N = 1350
START, END = datetime(2025, 3, 1), datetime(2026, 8, 31)
PROGRAMME_START = datetime(2026, 1, 1)
NBSP = " "

rng = np.random.default_rng(SEED)
OUT = Path(__file__).resolve().parent.parent / "Raw_Data"

HEADERS = ["ID", "Start time", "Completion time", "Email", "Name",
           "Which of our branches did you patronize?", "Category of client", "Gender", "Age Range",
           "Name of the Hospital / Clinic / Corporate where you were serviced.",
           f"Couriers /{NBSP} Specimen collection", "Phlebotomy / Nursing - Specimen collection",
           "Laboratory Urgent Results", "Laboratory Routine Results", "Call Center Team",
           "Customer Service Team", "Courier Service Team", "Reception Desk Team",
           "Phlebotomy (nursing) Team", "Technical / Lab Team", "Accounting / Invoicing Team",
           "Marketing Team", "Resolution of complaints by Marketing Officers",
           "Lab / Facility accessibility", f"Lab / Facility{NBSP}cleanliness", "Lab/ Facility reception area",
           f"Were your complaints{NBSP}adequately addresed ?",
           f"If you answered NO above,{NBSP}please give us more details and kindly indicate the laboratory involved.",
           "How likely are you to recommend our services to a friend or colleague?",
           "Do you have any suggestions to improve our service?",
           "Please leave your email.", "Please leave your phone number.",
           "Would you like us to contact you?\n If yes, kindly provide your contact details\n",
           "Your Name and Surname", "Email2", "Mobile / Phone"]

# branch: (raw labels as people type them, share of responses, effects)
BRANCHES = {
    "Lekki":        (["Lekki", "Lekki Phase 1", "lekki ", "LEKKI"], .16, {}),
    "Yaba":         (["Yaba", "Yaba, Lagos", "yaba"], .13, {}),
    "Ikorodu":      (["Ikorodu", "Ikorodu, Lagos"], .11, {"urgent": 2.2, "routine": 2.0}),
    "Abeokuta":     (["Abeokuta", "Abk"], .08, {}),
    "Abuja Central":(["Abuja", "Abuja Central", "Wuse, Abuja"], .14, {"reception": .6}),
    "Kano":         (["Kano"], .09, {"accounting": 1.6}),
    "Enugu":        (["Enugu", "Enugu GRA"], .10, {"urgent": .7, "routine": .7}),
    "Benin City":   (["Benin", "Benin City"], .10, {"callcentre": 2.6, "customer": 1.6}),
    "Calabar":      (["Calabar"], .03, {}),
    "Jos":          (["Jos"], .02, {}),
    "Lagos (unspecified)": (["Lagos"], .04, {}),
}

# touchpoint: header, chance it applies (walk-in, external), base chance of "Not satisfied", score weight
TOUCH = {
    "courier":     (HEADERS[10], (.25, .90), .10, 1.0),
    "phleb_spec":  (HEADERS[11], (.85, .35), .05, .6),
    "urgent":      (HEADERS[12], (.70, .92), .22, 3.0),
    "routine":     (HEADERS[13], (.85, .90), .16, 2.2),
    "callcentre":  (HEADERS[14], (.55, .85), .15, 1.4),
    "customer":    (HEADERS[15], (.85, .85), .12, 1.2),
    "courier_team":(HEADERS[16], (.20, .85), .07, .8),
    "reception":   (HEADERS[17], (.92, .45), .11, 1.0),
    "phleb_team":  (HEADERS[18], (.85, .30), .04, .5),
    "techlab":     (HEADERS[19], (.55, .80), .08, 1.2),
    "accounting":  (HEADERS[20], (.60, .80), .06, .8),
    "marketing":   (HEADERS[21], (.30, .80), .03, .3),
    "mkt_resolve": (HEADERS[22], (.35, .75), .07, .9),
    "access":      (HEADERS[23], (.90, .55), .03, .3),
    "clean":       (HEADERS[24], (.90, .50), .02, .3),
    "reception_area": (HEADERS[25], (.90, .50), .03, .3),
}
PROGRAMME_EFFECT = {"callcentre": .45, "urgent": .65, "routine": .7, "customer": .7}

COMPLAINTS = {
    "urgent": ["My urgent result took more than 24 hours, it was needed the same day at {org}.",
               "Urgent samples are not treated as urgent. We waited two days for a result the doctor needed.",
               "The urgent test result was not ready when promised and nobody told us about the delay.",
               "Results for urgent investigations are too slow at the {branch} lab."],
    "routine": ["Routine results take too long, sometimes 5 days.", "Still waiting for my result after a week.",
                "Result delivery is slow, please stick to your time."],
    "callcentre": ["I called the call centre several times and nobody picked.",
                   "No response when we call, the line is always busy or switched off.",
                   "No follow up after I complained, I had to keep calling."],
    "customer": ["Customer service did not give any feedback on my complaint.",
                 "Nobody called back as promised."],
    "reception": ["The reception staff were rude and dismissive.", "Front desk attitude needs to improve, I was shouted at."],
    "accounting": ["I was overcharged and the invoice was wrong.", "Billing was confusing and the receipt was not sent."],
    "courier": ["The courier came late to pick up the sample from our clinic.", "Sample pickup was missed twice this month."],
    "courier_team": ["Courier staff were not available for pick up on Saturday."],
    "techlab": ["The result had a wrong name spelling and a value that looked incorrect.", "Result was inaccurate and had to be rerun."],
    "mkt_resolve": ["The marketing officer never resolved the issue I raised.", "Complaint not resolved by the marketing team."],
    "clean": ["The toilet was dirty and the waiting area needs cleaning."],
    "access": ["The lab is difficult to locate, there is no signboard."],
    "reception_area": ["The waiting area was crowded with not enough seating."],
    "phleb_spec": ["The nurse struggled to collect the blood sample and I had to be bled twice."],
    "phleb_team": ["The phlebotomist was not gentle and did not explain anything."],
    "marketing": ["The marketing officer has not visited our clinic in months."],
}
SUGGESTIONS_NEG = ["Please send results by email or SMS as soon as they are ready.",
                   "Employ more staff at the reception, the queue is too long.",
                   "Improve your turnaround time for urgent tests.",
                   "Make the call centre more responsive.",
                   "Give discounts to regular clients.",
                   "Put up a signboard so people can find the lab.",
                   "Open another branch closer to the mainland."]
SUGGESTIONS_POS = ["Keep up the good work.", "Thank you, the service was excellent.", "Well done, very efficient staff.",
                   "I am satisfied with the service.", "Great service, keep it up."]
NON_ANSWERS = ["Nil", "N/A", "None", "No", "nil", "Nothing for now", "-", "."]

FIRST = ["Adaeze", "Tunde", "Ngozi", "Ibrahim", "Funke", "Chinedu", "Aisha", "Emeka", "Bola", "Musa",
         "Kemi", "Uche", "Halima", "Segun", "Zainab", "Obinna", "Yetunde", "Sani", "Ifeoma", "Femi"]
LAST = ["Okafor", "Adeyemi", "Bello", "Eze", "Ogunleye", "Abubakar", "Nwosu", "Balogun", "Usman", "Okeke",
        "Afolabi", "Danjuma", "Obi", "Lawal", "Ekwueme", "Salami"]
ORGS = {"Greenfield Hospital": ["Greenfield Hospital", "GREENFIELD HOSPITAL", "Greenfield Hosp"],
        "Mercy Specialist Clinic": ["Mercy Specialist Clinic", "Mercy Clinic"],
        "St. Anne's Clinic": ["St. Anne's Clinic", "St Annes Clinic"],
        "Harbour Medical Centre": ["Harbour Medical Centre", "Harbour Medical Center"],
        "Crestview Hospital": ["Crestview Hospital Ltd", "Crestview Hospital"],
        "Oakwood Clinic": ["Oakwood Clinic", "OAKWOOD CLINIC"],
        "Bluewave Energy (staff clinic)": ["Bluewave Energy Plc", "Bluewave Energy"]}
SAT = f"Satisfied{NBSP}"


def when(i):
    """Responses grow over time: later months get more of them."""
    span = (END - START).total_seconds()
    t = START + timedelta(seconds=span * float(rng.beta(1.6, 1.0)))
    return t.replace(hour=int(rng.integers(7, 21)), minute=int(rng.integers(0, 60)))


def main():
    OUT.mkdir(exist_ok=True)
    names = list(BRANCHES)
    weights = np.array([BRANCHES[b][1] for b in names]); weights /= weights.sum()
    rows = []
    for i in range(1, N + 1):
        branch = rng.choice(names, p=weights)
        labels, _, eff = BRANCHES[branch]
        external = rng.random() < .45
        started = when(i)
        completed = started + timedelta(minutes=float(rng.gamma(2.2, 2.0)))
        after = started >= PROGRAMME_START

        ratings, unsat = {}, []
        for k, (hdr, app, base, w) in TOUCH.items():
            if rng.random() > app[1 if external else 0]:
                ratings[hdr] = "Not applicable"
                continue
            p = base * eff.get(k, 1.0) * (1.25 if external and k in ("urgent", "routine", "courier") else 1.0)
            if after:
                p *= PROGRAMME_EFFECT.get(k, 1.0)
            bad = rng.random() < min(p, .85)
            ratings[hdr] = "Not satisfied" if bad else (SAT if rng.random() > .03 else "Satisfied")
            if bad:
                unsat.append((k, w))

        # Recommend score: starts high and falls with each unhappy touchpoint, weighted
        load = sum(w for _, w in unsat)
        score = 9.65 - 1.15 * load - (0.4 if external else 0) + rng.normal(0, 1.05)
        nps = int(np.clip(round(score), 0, 10))

        org = None
        if external:
            org = str(rng.choice(ORGS[rng.choice(list(ORGS))]))
        elif rng.random() < .3:
            org = str(rng.choice(["Self", "walk in", "Walk-in", "Personal"]))

        complaint, addressed = None, None
        if unsat:
            worst = max(unsat, key=lambda x: x[1])[0]
            resolved = rng.random() < (.45 if not after else .62)
            addressed = "Yes" if resolved else "No"
            if not resolved or rng.random() < .25:
                complaint = str(rng.choice(COMPLAINTS[worst])).format(org=org or "our clinic", branch=branch)
        else:
            # Many people with nothing to complain about still answer the question
            r = rng.random()
            addressed = "Yes" if r < .78 else (None if r < .97 else "No")
        if complaint is None and addressed == "No" and rng.random() < .5:
            complaint = str(rng.choice(NON_ANSWERS))

        r = rng.random()
        if nps >= 9 and r < .45:
            suggestion = str(rng.choice(SUGGESTIONS_POS))
        elif nps <= 7 and r < .55:
            suggestion = str(rng.choice(SUGGESTIONS_NEG))
        else:
            suggestion = str(rng.choice(NON_ANSWERS)) if r < .8 else None

        wants_contact = "Yes" if (nps <= 6 and rng.random() < .45) or rng.random() < .08 else "No"
        name = email = phone = None
        if wants_contact == "Yes" or rng.random() < .25:
            f, l = rng.choice(FIRST), rng.choice(LAST)
            name = f"{f} {l}"
            email = f"{f.lower()}.{l.lower()}{int(rng.integers(1, 99))}@example.com"
            phone = f"+234 000 000 {int(rng.integers(1000, 9999))}"
        # A few people type their number into the suggestion box; the build log should flag it
        if suggestion and i % 211 == 0:
            suggestion = f"{suggestion} Call me on 0800000{int(rng.integers(1000, 9999))}."

        row = {h: None for h in HEADERS}
        row.update({
            "ID": i, "Start time": started, "Completion time": completed,
            "Email": "anonymous", "Name": None,
            HEADERS[5]: str(rng.choice(labels)), HEADERS[6]: "External (Location-based) Client" if external else "Walk-In Client",
            HEADERS[7]: str(rng.choice(["Female", "Male"])),
            HEADERS[8]: str(rng.choice(["18 - 40 yrs", "41 - 60 yrs", "Above 60 yrs"], p=[.58, .33, .09])),
            HEADERS[9]: org, HEADERS[26]: addressed, HEADERS[27]: complaint, HEADERS[28]: nps, HEADERS[29]: suggestion,
            HEADERS[32]: wants_contact, HEADERS[33]: name,
        })
        row.update(ratings)
        if email:
            if rng.random() < .5:
                row[HEADERS[30]], row[HEADERS[31]] = email, phone
            else:
                row[HEADERS[34]], row[HEADERS[35]] = email, phone
        rows.append(row)

    df = pd.DataFrame(rows, columns=HEADERS).sort_values("Start time")
    df["ID"] = range(1, len(df) + 1)
    out = OUT / f"Customer Survey Demo Diagnostics(1-{len(df)}).xlsx"
    df.to_excel(out, index=False)
    s = df[HEADERS[28]]
    before, after = s[df["Start time"] < PROGRAMME_START], s[df["Start time"] >= PROGRAMME_START]
    nps = lambda x: round(100 * ((x >= 9).mean() - (x <= 6).mean()))
    print(f"{len(df)} responses -> {out.name}")
    print(f"NPS overall {nps(s)}, before programme {nps(before)} (n={len(before)}), after {nps(after)} (n={len(after)})")


if __name__ == "__main__":
    main()
