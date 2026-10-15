"""Findings and charts for the README, computed from the dashboard's own output (dist/data.json),
so the write-up and the dashboard can't disagree.

    python analysis/analyse.py      (after: node etl/build.js --force)
"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "charts"
OUT.mkdir(exist_ok=True)
PROGRAMME = "2026-01-01"

SURFACE, INK, MUTED, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
BLUE, RED, GREY = "#2a78d6", "#e34948", "#c9c8c3"
plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "font.family": "Segoe UI", "font.size": 10, "text.color": INK,
    "axes.edgecolor": GRID, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False,
})

data = json.loads((ROOT / "dist" / "data.json").read_text(encoding="utf-8"))
r = pd.DataFrame(data["records"])
r = r[r["nps"].notna()].copy()
r["after"] = r["date"] >= PROGRAMME


def nps(scores):
    return round(100 * ((scores >= 9).mean() - (scores <= 6).mean()))


def pct(mask):
    return round(100 * mask.mean(), 1)


# ---- numbers quoted in the README ----------------------------------------------
had = r[r["complaintsAddressed"].notna() & (r["dissatCount"] > 0)]
answered = r[r["complaintsAddressed"].notna()]
urgent = r[r["labUrgent"].isin(["Satisfied", "Not satisfied"])]
calls = r[r["callCenter"].isin(["Satisfied", "Not satisfied"])]
det = r[r["band"] == "Detractor"]
f = {
    "responses": len(r),
    "nps_overall": nps(r["nps"]),
    "nps_before": nps(r.loc[~r["after"], "nps"]), "nps_after": nps(r.loc[r["after"], "nps"]),
    "nps_walkin": nps(r.loc[r["clientCategory"].str.startswith("Walk"), "nps"]),
    "nps_external": nps(r.loc[r["clientCategory"].str.startswith("External"), "nps"]),
    "urgent_unhappy_pct": pct(urgent["labUrgent"] == "Not satisfied"),
    "nps_urgent_unhappy": nps(urgent.loc[urgent["labUrgent"] == "Not satisfied", "nps"]),
    "nps_urgent_happy": nps(urgent.loc[urgent["labUrgent"] == "Satisfied", "nps"]),
    "detractors_unhappy_urgent_pct": pct(det["labUrgent"] == "Not satisfied"),
    "ikorodu_urgent_unhappy_pct": pct(urgent.loc[urgent["site"] == "Ikorodu", "labUrgent"] == "Not satisfied"),
    "others_urgent_unhappy_pct": pct(urgent.loc[urgent["site"] != "Ikorodu", "labUrgent"] == "Not satisfied"),
    "callcentre_unhappy_before": pct(calls.loc[~calls["after"], "callCenter"] == "Not satisfied"),
    "callcentre_unhappy_after": pct(calls.loc[calls["after"], "callCenter"] == "Not satisfied"),
    "urgent_unhappy_before": pct(urgent.loc[~urgent["after"], "labUrgent"] == "Not satisfied"),
    "urgent_unhappy_after": pct(urgent.loc[urgent["after"], "labUrgent"] == "Not satisfied"),
    "resolved_as_reported": pct(answered["complaintsAddressed"] == "Yes"),
    "yes_from_no_complaint_pct": round(100 * ((answered["dissatCount"] == 0) & (answered["complaintsAddressed"] == "Yes")).sum()
                                       / (answered["complaintsAddressed"] == "Yes").sum(), 1),
    "resolved_real": pct(had["complaintsAddressed"] == "Yes"),
    "resolved_real_before": pct(had.loc[~had["after"], "complaintsAddressed"] == "Yes"),
    "resolved_real_after": pct(had.loc[had["after"], "complaintsAddressed"] == "Yes"),
    "top_theme": r["themePrimary"].dropna().value_counts().index[0],
}
sites = r.groupby("site")["nps"].agg(responses="size", nps=nps).sort_values("nps")
f["lowest_site"], f["lowest_site_nps"] = sites.index[0], int(sites["nps"].iloc[0])
(ROOT / "analysis" / "findings.json").write_text(json.dumps(f, indent=1))
print(json.dumps(f, indent=1))
print(sites.to_string())

# ---- chart 1: quarterly NPS --------------------------------------------------------
r["q"] = pd.PeriodIndex(pd.to_datetime(r["date"]), freq="Q")
q = r.groupby("q")["nps"].agg(responses="size", nps=nps)
q = q[q["responses"] >= 30]  # too few responses to score a quarter
fig, ax = plt.subplots(figsize=(8.5, 3.6), dpi=150)
x = range(len(q))
colors = [BLUE if p.start_time >= pd.Timestamp(PROGRAMME) else "#9ec5f4" for p in q.index]
ax.bar(x, q["nps"], color=colors, width=0.62)
for i, (v, n) in enumerate(zip(q["nps"], q["responses"])):
    ax.text(i, v + 1.2, f"{v:+d}", ha="center", color=INK, fontsize=9)
    ax.text(i, -6.5, f"n={n}", ha="center", color=MUTED, fontsize=8)
ax.set_xticks(list(x), [f"Q{p.quarter} {p.year}" for p in q.index])
ax.axhline(0, color=GRID, lw=1)
ax.set_ylim(-9, max(q["nps"]) + 8)
ax.yaxis.set_visible(False); ax.tick_params(length=0)
fig.text(0.01, 0.97, "Net Promoter Score by quarter", fontsize=12, weight="bold", va="top")
fig.text(0.01, 0.88, "Dark bars: after the callback programme began in January 2026. Q3 2026 covers July and August only", color=MUTED, va="top")
fig.subplots_adjust(top=0.78, left=0.02, right=0.99, bottom=0.12)
fig.savefig(OUT / "nps_by_quarter.png")

# ---- chart 2: what an unhappy touchpoint does to the score -------------------------
rows = []
for t in data["config"]["touchpoints"]:
    k = t["key"]
    unhappy, happy = r[r[k] == "Not satisfied"], r[r[k] == "Satisfied"]
    if len(unhappy) >= 40:
        rows.append((t["label"], nps(happy["nps"]), nps(unhappy["nps"]), len(unhappy)))
tp = pd.DataFrame(rows, columns=["touchpoint", "happy", "unhappy", "n"]).sort_values("unhappy", ascending=False)
fig, ax = plt.subplots(figsize=(8.5, 4.2), dpi=150)
y = range(len(tp))
ax.hlines(y, tp["unhappy"], tp["happy"], color=GREY, lw=2)
ax.scatter(tp["happy"], y, color=BLUE, s=36, zorder=3, label="Satisfied with it")
ax.scatter(tp["unhappy"], y, color=RED, s=36, zorder=3, label="Not satisfied with it")
ax.set_yticks(list(y), tp["touchpoint"])
ax.axvline(0, color=GRID, lw=1)
ax.set_xlim(-100, 60)
ax.xaxis.grid(True, color=GRID); ax.set_axisbelow(True); ax.tick_params(length=0)
ax.legend(loc="lower left", frameon=False, fontsize=9)
ax.set_xlabel("Net Promoter Score", color=MUTED)
fig.text(0.01, 0.97, "Customers unhappy with urgent results are the least likely to recommend", fontsize=12,
         weight="bold", va="top")
fig.text(0.01, 0.905, "NPS of customers satisfied vs not satisfied with each part of the service (40+ unhappy responses)",
         color=MUTED, va="top")
fig.subplots_adjust(top=0.82, left=0.29, right=0.98, bottom=0.12)
fig.savefig(OUT / "nps_by_touchpoint.png")
print("charts written")
